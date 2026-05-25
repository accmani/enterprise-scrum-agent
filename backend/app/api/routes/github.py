from fastapi import APIRouter
from pydantic import BaseModel
import httpx
import json

from app.config import settings

router = APIRouter()


def _gh_headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github.v3+json",
    }


@router.get("/release-branches")
async def list_release_branches():
    if not settings.github_token or not settings.github_repo:
        return {"branches": ["release/june-2026"], "configured": False}
    try:
        resp = httpx.get(
            f"https://api.github.com/repos/{settings.github_repo}/branches",
            headers=_gh_headers(),
            params={"per_page": 50},
            timeout=10,
        )
        if resp.status_code == 200:
            releases = [b["name"] for b in resp.json() if b["name"].startswith("release/")]
            return {"branches": releases, "configured": True}
    except Exception:
        pass
    return {"branches": ["release/june-2026"], "configured": False}


class CreateBranchRequest(BaseModel):
    name: str


@router.post("/release-branch")
async def create_release_branch(body: CreateBranchRequest):
    branch_name = body.name if body.name.startswith("release/") else f"release/{body.name}"

    if not settings.github_token or not settings.github_repo:
        return {"created": False, "branch": branch_name, "error": "GitHub not configured"}

    base_url = f"https://api.github.com/repos/{settings.github_repo}"
    try:
        # Get SHA from develop (fall back to main)
        for base in (settings.base_branch, "main"):
            ref_resp = httpx.get(f"{base_url}/git/ref/heads/{base}", headers=_gh_headers(), timeout=10)
            if ref_resp.status_code == 200:
                sha = ref_resp.json().get("object", {}).get("sha")
                break
        else:
            return {"created": False, "branch": branch_name, "error": "Could not get base branch SHA"}

        create_resp = httpx.post(
            f"{base_url}/git/refs",
            headers=_gh_headers(),
            json={"ref": f"refs/heads/{branch_name}", "sha": sha},
            timeout=10,
        )
        if create_resp.status_code in (200, 201):
            return {"created": True, "branch": branch_name}
        msg = create_resp.json().get("message", "Branch creation failed")
        return {"created": False, "branch": branch_name, "error": msg}
    except Exception as exc:
        return {"created": False, "branch": branch_name, "error": str(exc)}
