#!/bin/bash
# Harbinger v2.0 — Full Stack Smoke Test
#
# Validates: Go backend, FastAPI engine, nginx routing, DB connectivity,
#            mission CRUD, task DAG, and endpoint health.
#
# Usage: ./scripts/smoke-test.sh [BASE_URL]
#        Default BASE_URL: http://localhost

set -euo pipefail

BASE="${1:-http://localhost}"
PASS=0
FAIL=0
TOTAL=0

check() {
    local desc="$1"
    local url="$2"
    local expected_status="${3:-200}"
    local method="${4:-GET}"
    local body="${5:-}"

    TOTAL=$((TOTAL + 1))

    if [ "$method" = "POST" ] && [ -n "$body" ]; then
        status=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$body" "$url" 2>/dev/null)
    else
        status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    fi

    if [ "$status" = "$expected_status" ]; then
        echo "  ✓ $desc ($status)"
        PASS=$((PASS + 1))
    else
        echo "  ✗ $desc (got $status, expected $expected_status)"
        FAIL=$((FAIL + 1))
    fi
}

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  HARBINGER v2.0 — Full Stack Smoke Test         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "Target: $BASE"
echo ""

echo "── Go Backend Health ──────────────────────────────"
check "GET /health" "$BASE/health"
check "GET /api/health" "$BASE/api/health"
check "GET /api/v1/health" "$BASE/api/v1/health"

echo ""
echo "── FastAPI Engine Health ──────────────────────────"
check "GET /api/v2/health" "$BASE/api/v2/health"

echo ""
echo "── Mission API (FastAPI) ─────────────────────────"
# Create a mission
MISSION_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"title":"Smoke Test Mission","target":"smoke.test","mission_type":"custom"}' \
    "$BASE/api/v2/missions" 2>/dev/null)
MISSION_ID=$(echo "$MISSION_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

if [ -n "$MISSION_ID" ] && [ "$MISSION_ID" != "" ]; then
    echo "  ✓ POST /api/v2/missions → id=$MISSION_ID"
    PASS=$((PASS + 1))
    TOTAL=$((TOTAL + 1))

    check "GET /api/v2/missions" "$BASE/api/v2/missions"
    check "GET /api/v2/missions/$MISSION_ID" "$BASE/api/v2/missions/$MISSION_ID"

    # Create a task
    TASK_RESP=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"title\":\"Smoke Recon\",\"agent_codename\":\"PATHFINDER\",\"depends_on\":[]}" \
        "$BASE/api/v2/missions/$MISSION_ID/tasks" 2>/dev/null)
    TASK_ID=$(echo "$TASK_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")

    if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "" ]; then
        echo "  ✓ POST /api/v2/missions/$MISSION_ID/tasks → id=$TASK_ID"
        PASS=$((PASS + 1))
        TOTAL=$((TOTAL + 1))
        check "GET /api/v2/missions/$MISSION_ID/tasks" "$BASE/api/v2/missions/$MISSION_ID/tasks"
    else
        echo "  ✗ POST /api/v2/missions/$MISSION_ID/tasks → failed"
        FAIL=$((FAIL + 1))
        TOTAL=$((TOTAL + 1))
    fi

    # Templates
    check "GET /api/v2/missions/templates/list" "$BASE/api/v2/missions/templates/list"
else
    echo "  ✗ POST /api/v2/missions → failed ($MISSION_RESP)"
    FAIL=$((FAIL + 1))
    TOTAL=$((TOTAL + 1))
fi

echo ""
echo "── Go Backend API Endpoints ──────────────────────"
check "GET /api/agents" "$BASE/api/agents"
check "GET /api/skills" "$BASE/api/skills"
check "GET /api/realtime/events" "$BASE/api/realtime/events"
check "GET /api/realtime/agents" "$BASE/api/realtime/agents"
check "GET /api/realtime/killswitch" "$BASE/api/realtime/killswitch"

echo ""
echo "── Frontend ──────────────────────────────────────"
check "GET / (SPA)" "$BASE/"

echo ""
echo "── War Room (FastAPI) ────────────────────────────"
check "GET /api/v2/warroom/state" "$BASE/api/v2/warroom/state"

echo ""
echo "── Healing (FastAPI) ─────────────────────────────"
check "GET /api/v2/healing/status" "$BASE/api/v2/healing/status"

echo ""
echo "══════════════════════════════════════════════════"
echo "  Results: $PASS passed, $FAIL failed, $TOTAL total"
if [ "$FAIL" -eq 0 ]; then
    echo "  Status: ALL CLEAR ✓"
else
    echo "  Status: $FAIL FAILURES"
fi
echo "══════════════════════════════════════════════════"
echo ""

exit $FAIL
