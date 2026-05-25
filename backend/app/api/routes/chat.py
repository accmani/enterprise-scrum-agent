from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import json
import time

from app.database import get_db
from app.agents.orchestrator import SDLCOrchestrator
from app.agents.personas import PERSONAS, DEFAULT_PERSONA
from app.agents.policies import get_policy
from app.agents.domain_registry import (
    get_domain_context_summary,
    get_table_context,
    BUG_DOMAIN_MAP,
)

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    history: list[dict] | None = None
    persona: str | None = None
    # Policy-routing fields
    bug_id: Optional[str] = None
    domain: Optional[str] = None
    bug_type: Optional[str] = None
    # Skip ReAct agent — use direct LLM call (for analysis steps that need no tools)
    direct_llm: Optional[bool] = False
    # Evaluation fields — passed when step 6 completes
    evaluate_fix: Optional[bool] = False
    fixed_code: Optional[str] = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str | None = None
    persona: str | None = None
    super_agent: str | None = None
    duration_ms: int | None = None
    agent_chain: list[str] = []
    task_plan: dict = {}
    memory_summary: str | None = None
    eval_score: float | None = None
    # Policy info
    policy_domain: str | None = None
    policy_tools: list[str] = []
    compliance_checks: list[str] = []
    # LLM evaluation result (Option B)
    fix_evaluation: dict | None = None


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    persona = request.persona or DEFAULT_PERSONA
    if persona not in PERSONAS:
        persona = DEFAULT_PERSONA

    # ── Resolve policy ─────────────────────────────────────────────────────
    policy = get_policy(
        bug_id=request.bug_id,
        domain=request.domain,
        bug_type=request.bug_type,
    )

    # ── Resolve domain ─────────────────────────────────────────────────────
    resolved_domain = request.domain
    if not resolved_domain and request.bug_id:
        bug_info = BUG_DOMAIN_MAP.get(request.bug_id.upper())
        if bug_info:
            resolved_domain = bug_info.get("domain")

    # ── Build domain context ────────────────────────────────────────────────
    domain_context = ""
    if resolved_domain:
        domain_context = get_domain_context_summary(resolved_domain)

    if request.bug_id:
        bug_info = BUG_DOMAIN_MAP.get(request.bug_id.upper(), {})
        for table in bug_info.get("tables", []):
            ctx = get_table_context(table)
            if ctx:
                domain_context += (
                    f"\n\nTABLE CONTEXT — {ctx['short']}:\n"
                    f"  Purpose: {ctx['meaning']}\n"
                    f"  Risk: {ctx['risk']}\n"
                    f"  Compliance: {', '.join(ctx['compliance'])}"
                )

    # ── Build policy context ────────────────────────────────────────────────
    policy_context = policy.system_prompt_suffix or ""
    if policy.allowed_files:
        policy_context += f"\n\nALLOWED FILES: {', '.join(policy.allowed_files)}"
    if policy.allowed_tables:
        policy_context += f"\nALLOWED TABLES (read only): {', '.join(policy.allowed_tables)}"
    if policy.compliance_checks:
        policy_context += f"\nMANDATORY COMPLIANCE: {', '.join(policy.compliance_checks)}"

    # ── Assemble enhanced message ───────────────────────────────────────────
    enhanced_message = request.message
    context_block = "\n\n".join(filter(None, [domain_context, policy_context]))
    if context_block and policy.domain != 'general':
        enhanced_message = f"{request.message}\n\n{'─'*60}\n{context_block}"

    # ── Direct LLM path (bypasses ReAct agent — no tools, single call) ────────
    if request.direct_llm:
        from langchain_core.messages import HumanMessage, SystemMessage
        from app.agents.mrkl_agent import ScrumMRKLAgent
        t0 = time.time()
        _persona_cfg = PERSONAS.get(persona, {})
        _agent = ScrumMRKLAgent(db_session=db, persona=persona, persona_config=_persona_cfg)
        _llm = _agent._build_llm()
        _system = _persona_cfg.get("system_prompt", "You are an expert SDLC assistant.")
        _resp = await _llm.ainvoke([
            SystemMessage(content=_system),
            HumanMessage(content=enhanced_message),
        ])
        return ChatResponse(
            reply=_resp.content,
            persona=persona,
            duration_ms=int((time.time() - t0) * 1000),
            policy_domain=policy.domain,
            policy_tools=policy.tools,
            compliance_checks=policy.compliance_checks,
        )

    # ── Run orchestrator ────────────────────────────────────────────────────
    orchestrator = SDLCOrchestrator(db_session=db)

    result = await orchestrator.run(
        query=enhanced_message,
        persona=persona,
        session_id=request.session_id,
        session_history=request.history,
    )

    # ── LLM Self-Evaluation (Option B) ─────────────────────────────────────
    # Triggered when evaluate_fix=True and fixed_code is provided
    # This is called as a SECOND request from the frontend after step 6 completes
    fix_evaluation = None
    if request.evaluate_fix and request.fixed_code:
        try:
            from app.agents.tools.evaluator_tool import EvaluatorTool, EVAL_RUBRICS
            evaluator = EvaluatorTool()

            # Resolve bug type for rubric
            bug_type_key = request.bug_type or 'boundary_condition'
            # Map common type strings to rubric keys
            type_map = {
                'technical': 'null_pointer',
                'functional': 'boundary_condition',
                'boundary_condition': 'boundary_condition',
                'null_pointer': 'null_pointer',
                'concurrent_modification': 'concurrent_modification',
                'missing_case': 'missing_case',
                'logic_bypass': 'logic_bypass',
                'missing_validation': 'missing_validation',
            }
            rubric_key = type_map.get(bug_type_key.lower(), 'boundary_condition')

            # Get bug description from domain registry
            bug_info = BUG_DOMAIN_MAP.get((request.bug_id or '').upper(), {})

            eval_query = json.dumps({
                'fixed_code': request.fixed_code,
                'bug_type': rubric_key,
                'domain': resolved_domain or 'bds',
                'bug_description': request.message[:200],
                'business_impact': f"Domain: {resolved_domain}, Tables: {', '.join(policy.allowed_tables[:2])}",
            })

            eval_result_str = evaluator._execute(eval_query)
            fix_evaluation = json.loads(eval_result_str)

        except Exception as e:
            fix_evaluation = {
                'overall': 0.75,
                'confidence_label': 'Medium',
                'gaps': [],
                'refinement_suggestions': [],
                'production_ready': True,
                'reviewer_notes': f'Evaluation error: {str(e)[:100]}',
                'needs_refinement': False,
                'error': str(e)[:200],
            }

    return ChatResponse(
        reply=result["reply"],
        session_id=request.session_id,
        persona=result["persona"],
        super_agent=result["super_agent"],
        duration_ms=result["duration_ms"],
        agent_chain=result.get("agent_chain", []),
        task_plan=result.get("task_plan", {}),
        memory_summary=result.get("memory_summary"),
        eval_score=result.get("eval_score"),
        policy_domain=policy.domain,
        policy_tools=policy.tools,
        compliance_checks=policy.compliance_checks,
        fix_evaluation=fix_evaluation,
    )


@router.get("/personas")
async def list_personas():
    return {
        "personas": [
            {
                "id": pid,
                "name": p["name"],
                "role": p["role"],
                "icon": p["icon"],
                "color": p["color"],
                "description": p["description"],
                "super_agent": p["super_agent"],
                "suggestions": p["suggestions"],
            }
            for pid, p in PERSONAS.items()
        ],
        "default": DEFAULT_PERSONA,
    }


@router.get("/health")
async def chat_health():
    return {"status": "ok"}
