from fastapi import APIRouter
from app.agents.tools.jira_tool import JiraTool
from app.agents.tools.sprint_tool import SprintTool
from app.agents.tools.story_tool import StoryTool
import json

router = APIRouter()


@router.get("/issues")
async def list_jira_issues():
    tool = JiraTool()
    result = tool._execute("list issues")
    return json.loads(result)


@router.get("/sprints")
async def list_jira_sprints():
    tool = SprintTool()
    result = tool._handle_query("list all sprints")
    return json.loads(result)


@router.get("/sprints/active")
async def get_active_sprint():
    tool = SprintTool()
    result = tool._handle_query("get active sprint with issues")
    return json.loads(result)


@router.get("/stories")
async def list_jira_stories():
    tool = StoryTool()
    result = tool._handle_query("list all stories")
    return json.loads(result)


@router.get("/stories/backlog")
async def list_jira_backlog():
    tool = StoryTool()
    result = tool._handle_query("list backlog stories")
    return json.loads(result)