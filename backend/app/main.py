from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.database import init_db, seed_claims

# Import models so Base.metadata knows about all tables before create_all runs
import app.models.sprint      # noqa: F401
import app.models.story       # noqa: F401
import app.models.metrics     # noqa: F401
import app.models.claims      # noqa: F401

from app.api.routes import chat, sprints, stories, standup, jira
from app.api.routes import metrics
from app.api.routes import github


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_claims()
    yield


app = FastAPI(
    title="Enterprise SDLC Agent API",
    description=(
        "AI-powered SDLC management with hierarchical MRKL agents. "
        "Includes Orchestrator → Super Agents (Planning, Engineering, QA, Delivery) "
        "→ Utility Agents (Jira, GitHub, DB, Metrics)."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router,    prefix="/api/chat",    tags=["chat"])
app.include_router(sprints.router, prefix="/api/sprints", tags=["sprints"])
app.include_router(stories.router, prefix="/api/stories", tags=["stories"])
app.include_router(standup.router, prefix="/api/standup", tags=["standup"])
app.include_router(jira.router,    prefix="/api/jira",    tags=["jira"])
app.include_router(metrics.router, prefix="/api/metrics", tags=["metrics"])
app.include_router(github.router,  prefix="/api/github",  tags=["github"])


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "enterprise-sdlc-agent",
        "version": "2.0.0",
        "agents": {
            "orchestrator": "SDLCOrchestrator",
            "super_agents": ["Planning", "Engineering", "QA", "Delivery"],
            "utility_agents": ["jira_integration", "github_integration", "db_agent", "metrics_tool"],
        },
    }
