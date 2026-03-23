"""Community Contribution Portal — submit, review, and publish community contributions.

Supports: plugins, nuclei templates, knowledge sources, tools, agent configs.
Workflow: submit → review → approve/reject → publish to registry.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging
import time
import uuid

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v2/community", tags=["community"])

# In-memory stores
_submissions: dict[str, dict] = {}
_reviews: dict[str, list[dict]] = {}  # submission_id → reviews


class Submission(BaseModel):
    title: str
    description: str
    type: str  # "plugin", "template", "knowledge_source", "tool", "agent"
    author: str
    content: dict  # Type-specific content (plugin manifest, template YAML, tool config, etc.)
    tags: list[str] = []
    repository_url: str = ""
    license: str = "MIT"


class Review(BaseModel):
    reviewer: str
    verdict: str  # "approve", "reject", "needs_changes"
    comment: str
    security_check: bool = False  # Did reviewer check for malicious content?


class SearchQuery(BaseModel):
    query: str = ""
    type: str = ""
    tags: list[str] = []
    status: str = ""  # "pending", "approved", "rejected", "published"
    sort: str = "newest"  # "newest", "popular", "rating"


# === Submission CRUD ===

@router.post("/submit", status_code=201)
async def submit_contribution(body: Submission):
    """Submit a new contribution for community review."""
    submission_id = f"contrib-{uuid.uuid4().hex[:12]}"
    submission = {
        "id": submission_id,
        "title": body.title,
        "description": body.description,
        "type": body.type,
        "author": body.author,
        "content": body.content,
        "tags": body.tags,
        "repository_url": body.repository_url,
        "license": body.license,
        "status": "pending",
        "submitted_at": time.time(),
        "updated_at": time.time(),
        "review_count": 0,
        "approval_count": 0,
        "install_count": 0,
        "rating": 0.0,
    }
    _submissions[submission_id] = submission
    logger.info("New community submission: %s (%s) by %s", body.title, body.type, body.author)
    return submission


@router.get("/submissions")
async def list_submissions(
    type: str = "",
    status: str = "",
    author: str = "",
    tag: str = "",
    limit: int = 50,
    offset: int = 0,
):
    """List community submissions with filters."""
    results = list(_submissions.values())

    if type:
        results = [s for s in results if s["type"] == type]
    if status:
        results = [s for s in results if s["status"] == status]
    if author:
        results = [s for s in results if s["author"] == author]
    if tag:
        results = [s for s in results if tag in s.get("tags", [])]

    results.sort(key=lambda x: x["submitted_at"], reverse=True)
    total = len(results)
    results = results[offset:offset + limit]

    return {"submissions": results, "total": total, "offset": offset, "limit": limit}


@router.get("/submissions/{submission_id}")
async def get_submission(submission_id: str):
    s = _submissions.get(submission_id)
    if not s:
        raise HTTPException(404, "Submission not found")
    reviews = _reviews.get(submission_id, [])
    return {**s, "reviews": reviews}


@router.put("/submissions/{submission_id}")
async def update_submission(submission_id: str, body: Submission):
    if submission_id not in _submissions:
        raise HTTPException(404, "Submission not found")
    if _submissions[submission_id]["status"] not in ("pending", "needs_changes"):
        raise HTTPException(400, "Can only edit pending or needs_changes submissions")
    _submissions[submission_id].update({
        "title": body.title,
        "description": body.description,
        "content": body.content,
        "tags": body.tags,
        "repository_url": body.repository_url,
        "updated_at": time.time(),
        "status": "pending",  # Reset to pending after edit
    })
    return _submissions[submission_id]


@router.delete("/submissions/{submission_id}")
async def withdraw_submission(submission_id: str):
    if submission_id not in _submissions:
        raise HTTPException(404, "Submission not found")
    _submissions[submission_id]["status"] = "withdrawn"
    return {"status": "withdrawn", "id": submission_id}


# === Review Workflow ===

@router.post("/submissions/{submission_id}/review")
async def review_submission(submission_id: str, body: Review):
    """Submit a review for a contribution."""
    if submission_id not in _submissions:
        raise HTTPException(404, "Submission not found")

    review = {
        "reviewer": body.reviewer,
        "verdict": body.verdict,
        "comment": body.comment,
        "security_check": body.security_check,
        "reviewed_at": time.time(),
    }

    if submission_id not in _reviews:
        _reviews[submission_id] = []
    _reviews[submission_id].append(review)

    sub = _submissions[submission_id]
    sub["review_count"] = len(_reviews[submission_id])
    sub["approval_count"] = len([r for r in _reviews[submission_id] if r["verdict"] == "approve"])

    # Auto-approve if 2+ approvals with security check
    approved_with_security = [
        r for r in _reviews[submission_id]
        if r["verdict"] == "approve" and r["security_check"]
    ]
    if len(approved_with_security) >= 2:
        sub["status"] = "approved"
        logger.info("Submission %s auto-approved (2+ security-checked approvals)", submission_id)
    elif body.verdict == "reject":
        sub["status"] = "rejected"
    elif body.verdict == "needs_changes":
        sub["status"] = "needs_changes"

    return {"status": sub["status"], "review_count": sub["review_count"]}


# === Publishing ===

@router.post("/submissions/{submission_id}/publish")
async def publish_submission(submission_id: str):
    """Publish an approved submission to the registry."""
    sub = _submissions.get(submission_id)
    if not sub:
        raise HTTPException(404, "Submission not found")
    if sub["status"] != "approved":
        raise HTTPException(400, f"Submission is '{sub['status']}' — must be 'approved' to publish")

    # Install into the appropriate registry
    content = sub["content"]
    sub_type = sub["type"]

    try:
        if sub_type == "plugin":
            from src.registry.plugin_sdk import plugin_manager, PluginManifest
            manifest = PluginManifest(**content)
            plugin_manager.install(manifest)

        elif sub_type == "tool":
            from src.engine.tools.user_tools import user_tool_registry, UserTool
            user_tool_registry.register(UserTool(**content))

        elif sub_type == "knowledge_source":
            from src.memory.knowledge_sources import knowledge_registry, KnowledgeSource
            knowledge_registry.add(KnowledgeSource(**content))

        elif sub_type == "template":
            from src.registry.templates import template_registry, MissionTemplate
            template_registry.register(MissionTemplate(**content))

        elif sub_type == "agent":
            from src.registry.agents import agent_registry, AgentDefinition
            agent_registry.register(AgentDefinition(**content))

        sub["status"] = "published"
        sub["published_at"] = time.time()
        logger.info("Published community %s: %s", sub_type, sub["title"])
        return {"status": "published", "type": sub_type, "title": sub["title"]}

    except Exception as e:
        raise HTTPException(500, f"Failed to publish: {e}")


# === Discovery ===

@router.get("/featured")
async def featured_contributions():
    """Get featured/popular contributions."""
    published = [s for s in _submissions.values() if s["status"] == "published"]
    published.sort(key=lambda x: x.get("install_count", 0), reverse=True)
    return {"featured": published[:10]}


@router.get("/stats")
async def community_stats():
    """Community statistics."""
    all_subs = list(_submissions.values())
    return {
        "total_submissions": len(all_subs),
        "by_status": {
            status: len([s for s in all_subs if s["status"] == status])
            for status in ["pending", "approved", "rejected", "published", "withdrawn", "needs_changes"]
        },
        "by_type": {
            t: len([s for s in all_subs if s["type"] == t])
            for t in ["plugin", "template", "knowledge_source", "tool", "agent"]
        },
        "total_reviews": sum(len(r) for r in _reviews.values()),
        "contributors": len(set(s["author"] for s in all_subs)),
    }


@router.get("/types")
async def contribution_types():
    """List all contribution types with descriptions."""
    return {
        "types": [
            {"id": "plugin", "name": "Plugin", "description": "Full plugin with tools, agents, templates, knowledge sources"},
            {"id": "template", "name": "Mission Template", "description": "Pre-defined task DAG for common operations"},
            {"id": "knowledge_source", "name": "Knowledge Source", "description": "GitHub repo or URL with security knowledge"},
            {"id": "tool", "name": "Tool", "description": "CLI tool wrapper that agents can call"},
            {"id": "agent", "name": "Agent", "description": "Custom agent type with specific tools and prompts"},
        ]
    }
