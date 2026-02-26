#!/usr/bin/env bash
set -euo pipefail

# ---------- UI ----------
BOLD="\033[1m"; DIM="\033[2m"; RESET="\033[0m"
RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; CYAN="\033[36m"

hr() { printf "${DIM}────────────────────────────────────────────────────────${RESET}\n"; }
ok() { printf "${GREEN}✔${RESET} %s\n" "$*"; }
warn(){ printf "${YELLOW}⚠${RESET} %s\n" "$*"; }
bad() { printf "${RED}✖${RESET} %s\n" "$*"; }
info(){ printf "${CYAN}➜${RESET} %s\n" "$*"; }

die(){ bad "$*"; exit 1; }

need() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

# ---------- Checks ----------
need git

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  die "Not inside a git repo. cd into your repo first."
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# ---------- Header ----------
printf "${BOLD}GitHub Push/Pull Wizard${RESET}\n"
printf "${DIM}Repo: ${RESET}%s\n" "$REPO_ROOT"
hr

# ---------- Show current remote ----------
ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ -z "${ORIGIN_URL}" ]]; then
  die "No 'origin' remote found."
fi
info "Current origin: ${BOLD}${ORIGIN_URL}${RESET}"

# ---------- Show git status quick ----------
STATUS_SHORT="$(git status -sb || true)"
printf "${DIM}%s${RESET}\n" "$STATUS_SHORT"
hr

# ---------- Detect GitHub identity (SSH) ----------
HAS_SSH=0
if command -v ssh >/dev/null 2>&1; then
  HAS_SSH=1
fi

if [[ "$HAS_SSH" -eq 1 ]]; then
  info "Checking SSH identity..."
  SSH_OUT="$(ssh -T git@github.com 2>&1 || true)"
  printf "${DIM}%s${RESET}\n" "$SSH_OUT"
else
  warn "ssh not available; skipping SSH identity check."
fi
hr

# ---------- Detect gh + permission ----------
HAS_GH=0
if command -v gh >/dev/null 2>&1; then
  HAS_GH=1
fi

OWNER_REPO=""
# Try to infer owner/repo from origin URL
if [[ "$ORIGIN_URL" =~ github\.com[:/]+([^/]+)/([^/.]+)(\.git)?$ ]]; then
  OWNER_REPO="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
fi

if [[ -n "$OWNER_REPO" ]]; then
  info "Detected repo: ${BOLD}${OWNER_REPO}${RESET}"
else
  warn "Could not parse owner/repo from origin. Some features may be skipped."
fi

VIEWER_PERM=""
DEFAULT_BRANCH="main"
if [[ "$HAS_GH" -eq 1 && -n "$OWNER_REPO" ]]; then
  info "Checking GitHub CLI auth + permission..."
  if gh auth status -h github.com >/dev/null 2>&1; then
    ok "gh is authenticated."
    # viewerPermission requires access to repo metadata
    set +e
    JSON="$(gh repo view "$OWNER_REPO" --json viewerPermission,defaultBranchRef 2>/dev/null)"
    RC=$?
    set -e
    if [[ "$RC" -eq 0 && -n "$JSON" ]]; then
      VIEWER_PERM="$(printf "%s" "$JSON" | sed -n 's/.*"viewerPermission":[ ]*"\([^"]*\)".*/\1/p')"
      DEFAULT_BRANCH="$(printf "%s" "$JSON" | sed -n 's/.*"name":[ ]*"\([^"]*\)".*/\1/p' | head -n 1)"
      [[ -z "$DEFAULT_BRANCH" ]] && DEFAULT_BRANCH="main"
      ok "Permission: ${BOLD}${VIEWER_PERM:-UNKNOWN}${RESET} | Default branch: ${BOLD}${DEFAULT_BRANCH}${RESET}"
    else
      warn "Could not read repo metadata with gh (maybe private/no access)."
    fi
  else
    warn "gh is NOT authenticated. Run: gh auth login"
  fi
else
  warn "gh not installed or repo not detected. Skipping permission check."
fi
hr

# ---------- Offer remote fixes ----------
to_ssh_url() {
  local in="$1"
  if [[ "$in" =~ github\.com[:/]+([^/]+)/([^/.]+)(\.git)?$ ]]; then
    printf "git@github.com:%s/%s.git\n" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
  else
    printf ""
  fi
}

SSH_URL="$(to_ssh_url "$ORIGIN_URL")"
if [[ -n "$SSH_URL" && "$ORIGIN_URL" != "$SSH_URL" ]]; then
  info "Can switch origin to SSH: ${BOLD}${SSH_URL}${RESET}"
fi

# ---------- Determine safest push path ----------
# If permission is READ/TRIAGE, pushing upstream won't work.
CAN_PUSH_UPSTREAM=1
if [[ -n "$VIEWER_PERM" ]]; then
  case "$VIEWER_PERM" in
    ADMIN|MAINTAIN|WRITE) CAN_PUSH_UPSTREAM=1 ;;
    *) CAN_PUSH_UPSTREAM=0 ;;
  esac
fi

# ---------- Actions menu ----------
printf "${BOLD}Choose an action:${RESET}\n"
printf "  1) Switch origin to SSH (recommended)\n"
printf "  2) Pull (rebase)\n"
printf "  3) Push to origin (normal)\n"
printf "  4) Push to origin (force-with-lease) — for rewritten history\n"
printf "  5) If no upstream write access: fork + push to fork + (optional) PR\n"
printf "  6) Full autopilot: switch-to-ssh + pull --rebase + push\n"
printf "  0) Exit\n"
hr
read -r -p "Enter choice: " CH

switch_to_ssh() {
  [[ -n "$SSH_URL" ]] || die "Could not compute SSH URL from origin."
  git remote set-url origin "$SSH_URL"
  ok "Origin updated to SSH: $(git remote get-url origin)"
}

pull_rebase() {
  info "Fetching..."
  git fetch origin
  info "Rebasing onto origin/${DEFAULT_BRANCH}..."
  git pull --rebase origin "$DEFAULT_BRANCH"
  ok "Pull --rebase complete."
}

push_normal() {
  info "Pushing to origin/${DEFAULT_BRANCH}..."
  git push origin "$DEFAULT_BRANCH"
  ok "Push complete."
}

push_force() {
  warn "Force-with-lease will overwrite remote history if allowed."
  info "Pushing with --force-with-lease to origin/${DEFAULT_BRANCH}..."
  git push --force-with-lease origin "$DEFAULT_BRANCH"
  ok "Force push complete."
}

fork_flow() {
  [[ "$HAS_GH" -eq 1 ]] || die "gh is required for fork flow. Install gh and run: gh auth login"
  [[ -n "$OWNER_REPO" ]] || die "Could not detect owner/repo for fork flow."

  info "Creating fork (or using existing fork) via gh..."
  gh repo fork "$OWNER_REPO" --clone=false >/dev/null 2>&1 || true
  ok "Fork ready."

  # Determine your gh username
  ME="$(gh api user --jq .login 2>/dev/null || true)"
  [[ -n "$ME" ]] || die "Could not detect your gh username."

  FORK_URL="git@github.com:${ME}/$(basename "$OWNER_REPO").git"

  if git remote get-url myfork >/dev/null 2>&1; then
    git remote set-url myfork "$FORK_URL"
  else
    git remote add myfork "$FORK_URL"
  fi
  ok "Remote 'myfork' set to: $FORK_URL"

  info "Pushing ${DEFAULT_BRANCH} to your fork..."
  git push --force-with-lease myfork "$DEFAULT_BRANCH"
  ok "Pushed to fork."

  read -r -p "Open a PR from fork -> upstream now? (y/N): " DO_PR
  if [[ "${DO_PR,,}" == "y" ]]; then
    info "Creating PR..."
    gh pr create --repo "$OWNER_REPO" --base "$DEFAULT_BRANCH" --head "${ME}:${DEFAULT_BRANCH}" \
      --title "Sync: ${DEFAULT_BRANCH} updates" \
      --body "Automated PR created by GitHub Push/Pull Wizard." >/dev/null
    ok "PR created."
  else
    warn "Skipped PR creation."
  fi
}

autopilot() {
  if [[ -n "$SSH_URL" ]]; then
    switch_to_ssh
  fi
  pull_rebase || warn "Pull had conflicts. Resolve then re-run push."
  if [[ "$CAN_PUSH_UPSTREAM" -eq 1 ]]; then
    push_normal
  else
    warn "No upstream write access detected. Running fork flow..."
    fork_flow
  fi
}

case "$CH" in
  1) switch_to_ssh ;;
  2) pull_rebase ;;
  3) push_normal ;;
  4) push_force ;;
  5) fork_flow ;;
  6) autopilot ;;
  0) exit 0 ;;
  *) die "Invalid choice." ;;
esac

hr
ok "Done."
