#!/usr/bin/env bash
# ============================================================================
# 🧙‍♂️ HARBINGER GIT WIZARD — Ultimate Edition v3.0.0
# 
# "Even a wizard's apprentice can master Git with the right spellbook"
# ============================================================================

set -euo pipefail

# ============================================================================
# WIZARD'S CONFIGURATION
# ============================================================================

VERSION="3.0.0"
SCRIPT_NAME="$(basename "$0")"
DEBUG="${DEBUG:-false}"

# Magical colors (for the visual learners)
RESET='\033[0m'
BOLD='\033[1m'
BLACK='\033[30m'
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
MAGENTA='\033[35m'
CYAN='\033[36m'
WHITE='\033[37m'

# Emojis (because wizards love pictograms)
EMOJI="🧙‍♂️"
EMOJI_GIT="📦"
EMOJI_GITHUB="🐙"
EMOJI_BRANCH="🌿"
EMOJI_COMMIT="📝"
EMOJI_PUSH="🚀"
EMOJI_PULL="📥"
EMOJI_PR="🔄"
EMOJI_FORK="🍴"
EMOJI_MERGE="⚡"
EMOJI_LOCK="🔒"
EMOJI_UNLOCK="🔓"
EMOJI_WARN="⚠️"
EMOJI_ERROR="❌"
EMOJI_SUCCESS="✅"
EMOJI_INFO="ℹ️"
EMOJI_ROCKET="🚀"
EMOJI_SPARKLES="✨"
EMOJI_STARS="🌟"
EMOJI_MAGIC="🪄"
EMOJI_SCROLL="📜"
EMOJI_SHIELD="🛡️"
EMOJI_KEY="🔑"
EMOJI_CLOCK="⏰"
EMOJI_WIZARD="🧙"
EMOJI_DRAGON="🐉"
EMOJI_TREASURE="💎"

# ============================================================================
# WIZARD'S HELPER SPELLS
# ============================================================================

# Pretty printing (for non-wizards)
magic_echo() {
  local color="$1"
  local message="$2"
  local emoji="${3:-$EMOJI_MAGIC}"
  echo -e "${color}${emoji} ${message}${RESET}"
}

info()    { magic_echo "$CYAN" "$1" "$EMOJI_INFO"; }
success() { magic_echo "$GREEN" "$1" "$EMOJI_SUCCESS"; }
warn()    { magic_echo "$YELLOW" "$1" "$EMOJI_WARN" >&2; }
error()   { magic_echo "$RED" "$1" "$EMOJI_ERROR" >&2; }
header()  { echo -e "\n${BOLD}${MAGENTA}${EMOJI_MAGIC} $1${RESET}\n"; }
divider() { echo -e "${CYAN}────────────────────────────────────────${RESET}"; }

# Debug mode (for curious wizards)
debug() {
  if [[ "${DEBUG}" == "true" ]]; then
    magic_echo "$MAGENTA" "[DEBUG] $1" "$EMOJI_SCROLL" >&2
  fi
}

# Safe spell casting (with error handling)
cast_spell() {
  local spell="$1"
  local error_message="${2:-The spell fizzled...}"
  
  debug "Casting: $spell"
  
  if eval "$spell"; then
    return 0
  else
    local exit_code=$?
    error "$error_message (exit code: $exit_code)"
    return $exit_code
  fi
}

# Check if a magical tool exists
has_magic() {
  if ! command -v "$1" &> /dev/null; then
    warn "Missing magical tool: $1"
    info "Install with: $2"
    return 1
  fi
  return 0
}

# Pause for dramatic effect (and user reading)
press_any_key() {
  echo
  read -p "$(echo -e ${CYAN})${EMOJI_INFO} Press Enter to continue...${RESET}" -n 1 -r
  echo
}

# Confirmation spell (with safety)
confirm_spell() {
  local message="${1:-Are you sure?}"
  local default="${2:-n}"
  
  local prompt
  if [[ "$default" == "y" ]]; then
    prompt="(Y/n)"
  else
    prompt="(y/N)"
  fi
  
  read -p "$(echo -e ${YELLOW})${EMOJI_WARN} $message $prompt: ${RESET}" -n 1 -r
  echo
  
  if [[ "$default" == "y" ]]; then
    [[ ! $REPLY =~ ^[Nn]$ ]]
  else
    [[ $REPLY =~ ^[Yy]$ ]]
  fi
}

# ============================================================================
# WIZARD'S SPELLBOOK (ASCII ART)
# ============================================================================

show_spellbook() {
  clear
  echo -e "${MAGENTA}"
  cat << "EOF"
    ╔═══════════════════════════════════════════════════════════════════╗
    ║                                                                   ║
    ║   ██╗  ██╗ █████╗ ██████╗ ██████╗ ██╗███╗   ██╗ ██████╗ ███████╗ ║
    ║   ██║  ██║██╔══██╗██╔══██╗██╔══██╗██║████╗  ██║██╔════╝ ██╔════╝ ║
    ║   ███████║███████║██████╔╝██████╔╝██║██╔██╗ ██║██║  ███╗█████╗   ║
    ║   ██╔══██║██╔══██║██╔══██╗██╔══██╗██║██║╚██╗██║██║   ██║██╔══╝   ║
    ║   ██║  ██║██║  ██║██║  ██║██████╔╝██║██║ ╚████║╚██████╔╝███████╗ ║
    ║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚══════╝ ║
    ║                                                                   ║
    ║                    ██████╗ ██╗████████╗                          ║
    ║                   ██╔════╝ ██║╚══██╔══╝                          ║
    ║                   ██║  ███╗██║   ██║                             ║
    ║                   ██║   ██║██║   ██║                             ║
    ║                   ╚██████╔╝██║   ██║                             ║
    ║                    ╚═════╝ ╚═╝   ╚═╝                             ║
    ║                                                                   ║
    ║                    🧙‍♂️ WIZARD EDITION v3.0.0 🧙‍♂️                    ║
    ╚═══════════════════════════════════════════════════════════════════╝
EOF
  echo -e "${RESET}"
  echo -e "  ${BOLD}${CYAN}Your magical guide to Git — even dragons understand it!${RESET}"
  echo -e "  ${YELLOW}Type 'git-wizard --help' for spell list${RESET}\n"
}

# ============================================================================
# WIZARD'S KNOWLEDGE (CONFIGURATION)
# ============================================================================

# Known GitHub accounts (the wizard's allies)
declare -A ALLIES
ALLIES=(
  ["haribinger"]="Haribinger"
  ["kdairatchi"]="kdairatchi"
  # Add your allies here!
)

# Wizard's current realm
get_current_realm() {
  local remote_url
  
  if ! remote_url=$(git config --get remote.origin.url 2>/dev/null); then
    debug "Not in a Git realm"
    echo "wilderness"
    return 1
  fi

  if [[ "$remote_url" =~ github\.com[:/]([^/]+)/([^/]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    echo "unknown"
  fi
}

# Get the treasure name (repo)
get_treasure_name() {
  basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown"
}

# Get current branch (the path we're on)
get_current_path() {
  git branch --show-current 2>/dev/null || echo "none"
}

# ============================================================================
# WIZARD'S PROTECTION SPELLS (BRANCH RULES)
# ============================================================================

check_protection_spells() {
  local branch="$1"
  local repo="${2:-$(get_treasure_name)}"
  local realm="${3:-$(get_current_realm)}"
  
  header "🛡️ BRANCH PROTECTION CHECK"
  
  # Skip if no GitHub CLI
  if ! has_magic "gh" "brew install gh || gh auth login" >/dev/null 2>&1; then
    warn "GitHub CLI not available, can't check protection spells"
    return 0
  fi
  
  if [[ "$realm" == "wilderness" || "$realm" == "unknown" ]]; then
    warn "Can't determine GitHub realm"
    return 0
  fi
  
  info "Checking protection for $realm/$repo branch: $branch"
  
  # Check for protection spells (rulesets)
  local rulesets
  if rulesets=$(gh api "/repos/$realm/$repo/rulesets" 2>/dev/null | jq -r '.[] | select(.conditions.ref_name.include[] | contains("refs/heads/'$branch'"))' 2>/dev/null); then
    if [[ -n "$rulesets" ]]; then
      info "${EMOJI_SHIELD} Active protection on $branch"
      
      # Check what kind of protection
      if echo "$rulesets" | jq -e '.rules[] | select(.type == "pull_request")' >/dev/null 2>&1; then
        warn "${EMOJI_LOCK} $branch requires PR — cannot push directly!"
        return 1
      fi
      
      if echo "$rulesets" | jq -e '.rules[] | select(.type == "required_status_checks")' >/dev/null 2>&1; then
        local checks=$(echo "$rulesets" | jq -r '.rules[] | select(.type == "required_status_checks").parameters.required_status_checks[].context' 2>/dev/null | tr '\n' ', ')
        info "${EMOJI_SHIELD} Required checks: ${checks%, }"
      fi
    else
      info "${EMOJI_UNLOCK} No special protection on $branch"
    fi
  fi
  
  return 0
}

# ============================================================================
# WIZARD'S SECURITY SCROLLS (PREVENT SECRET LEAKS)
# ============================================================================

check_security_scrolls() {
  header "🔒 SECURITY SCROLL CHECK"

  local issues=0
  local warnings=0

  # Check if we're in a Git realm
  if ! git rev-parse --git-dir > /dev/null 2>&1; then
    error "Not in a Git repository!"
    return 1
  fi

  # Look for forbidden scrolls (.env files)
  while IFS= read -r env_file; do
    if git ls-files | grep -q "$env_file"; then
      error "${EMOJI_ERROR} DANGER: $env_file is tracked by Git!"
      echo -e "  ${YELLOW}Fix with: git rm --cached $env_file && echo '$env_file' >> .gitignore${RESET}"
      ((issues++))
    fi
  done < <(git ls-files | grep -E '\.env(\..+)?$' 2>/dev/null || true)

  # Check for secret patterns in staged changes
  local staged_files=$(git diff --cached --name-only)
  if [[ -n "$staged_files" ]]; then
    local secret_patterns=(
      'ghp_[a-zA-Z0-9]{36}'          # GitHub token
      'gho_[a-zA-Z0-9]{36}'           # GitHub OAuth
      'sk-[a-zA-Z0-9]{48}'            # OpenAI key
      'AKIA[0-9A-Z]{16}'               # AWS key
      '-----BEGIN RSA PRIVATE KEY-----' # Private key
    )

    for pattern in "${secret_patterns[@]}"; do
      if git diff --cached -U0 | grep -E "$pattern" >/dev/null; then
        warn "Secret pattern detected in staged changes!"
        warn "  Pattern: $pattern"
        git diff --cached --name-only | while read file; do
          if git diff --cached -U0 "$file" | grep -E "$pattern" >/dev/null; then
            warn "    → $file"
          fi
        done
        ((warnings++))
      fi
    done
  fi

  # Summary
  echo
  if [[ $issues -gt 0 ]]; then
    error "${EMOJI_ERROR} Critical security issues: $issues — MUST FIX!"
    return 1
  elif [[ $warnings -gt 0 ]]; then
    warn "Security warnings: $warnings"
    if ! confirm_spell "Continue with warnings?" "n"; then
      return 1
    fi
  else
    success "No security issues found — your scrolls are safe!"
  fi
  
  return 0
}

# ============================================================================
# WIZARD'S JOURNEY MAP (STATUS)
# ============================================================================

show_journey_map() {
  local current_realm=$(get_current_realm)
  local remote
  remote=$(git config --get remote.origin.url 2>/dev/null || echo "none")
  local branch=$(get_current_path)
  local treasure=$(get_treasure_name)

  header "🗺️ YOUR CURRENT JOURNEY"
  
  echo -e "  ${CYAN}${EMOJI_WIZARD} You are here:${RESET} $(pwd)"
  echo -e "  ${CYAN}${EMOJI_TREASURE} Treasure:${RESET} $treasure"
  echo -e "  ${CYAN}${EMOJI_BRANCH} Current path:${RESET} $branch"
  echo -e "  ${CYAN}${EMOJI_GITHUB} Remote realm:${RESET} $remote"
  echo -e "  ${CYAN}${EMOJI_KEY} Pushing as:${RESET} $([[ "$current_realm" == "unknown" ]] && echo "${RED}unknown${RESET}" || echo "${GREEN}$current_realm${RESET}")"
  
  # Show uncommitted changes
  if ! git diff --quiet 2>/dev/null; then
    local changes=$(git diff --stat | tail -1)
    echo -e "  ${YELLOW}${EMOJI_SCROLL} Uncommitted changes:${RESET} $changes"
  fi
  
  # Show upstream status
  if git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null >/dev/null; then
    local behind=$(git rev-list --count HEAD..@{u} 2>/dev/null)
    local ahead=$(git rev-list --count @{u}..HEAD 2>/dev/null)
    
    if [[ $behind -gt 0 || $ahead -gt 0 ]]; then
      echo -e "  ${CYAN}${EMOJI_CLOCK} Sync status:${RESET} behind: $behind, ahead: $ahead"
    fi
  fi
  
  divider
}

# ============================================================================
# WIZARD'S BASIC SPELLS
# ============================================================================

# Pull the latest magic
spell_pull() {
  header "📥 PULLING LATEST MAGIC"
  
  if ! cast_spell "git pull" "Failed to pull changes"; then
    error "Pull failed. Maybe there are conflicts?"
    return 1
  fi
  
  success "Pulled latest changes successfully!"
}

# Commit changes with a message
spell_commit() {
  header "📝 COMMITTING CHANGES"
  
  # Check if there's anything to commit
  if git diff --quiet && git diff --cached --quiet; then
    warn "Nothing to commit — no changes detected"
    return 0
  fi
  
  # Show what will be committed
  echo -e "${CYAN}Changes to commit:${RESET}"
  git status -s
  
  echo
  read -p "$(echo -e ${GREEN})${EMOJI_COMMIT} Commit message: ${RESET}" msg
  
  if [[ -z "$msg" ]]; then
    warn "No commit message provided"
    if ! confirm_spell "Use default message 'WIP'?" "n"; then
      return 0
    fi
    msg="WIP: $(date +%Y-%m-%d)"
  fi
  
  # Add all if nothing staged
  if git diff --cached --quiet; then
    info "No staged changes, adding all..."
    git add -A
  fi
  
  if cast_spell "git commit -m \"$msg\"" "Commit failed"; then
    success "Committed: $msg"
  fi
}

# Switch realms (change origin)
spell_switch_realm() {
  local target="$1"
  local treasure="${2:-$(get_treasure_name)}"
  local protocol="${3:-ssh}"
  
  header "🔄 SWITCHING REALMS"
  
  # Input validation
  if [[ -z "$target" ]]; then
    error "Need a target realm!"
    echo "Available allies:"
    for ally in "${!ALLIES[@]}"; do
      echo "  $ally → ${ALLIES[$ally]}"
    done
    return 1
  fi
  
  if [[ "$treasure" == "unknown" ]]; then
    error "Not in a Git repository!"
    return 1
  fi
  
  # Validate protocol
  if [[ "$protocol" != "ssh" && "$protocol" != "https" ]]; then
    error "Protocol must be 'ssh' or 'https'"
    return 1
  fi
  
  # Get GitHub username
  local gh_user="${ALLIES[$target]:-$target}"
  
  local new_url
  if [[ "$protocol" == "ssh" ]]; then
    new_url="git@github.com:${gh_user}/${treasure}.git"
  else
    new_url="https://github.com/${gh_user}/${treasure}.git"
  fi
  
  info "Switching to: $new_url"
  
  if confirm_spell "Switch origin?" "y"; then
    if git remote get-url origin &>/dev/null; then
      git remote set-url origin "$new_url"
    else
      git remote add origin "$new_url"
    fi
    success "Switched to $new_url"
  fi
}

# ============================================================================
# WIZARD'S ADVANCED SPELLS (AUTOPILOT PUSH WITH PROTECTION AWARENESS)
# ============================================================================

spell_autopilot_push() {
  local target_realm="${1:-$(get_current_realm)}"
  local current_realm=$(get_current_realm)
  local branch=$(get_current_path)
  local treasure=$(get_treasure_name)
  
  header "🚀 AUTOPILOT PUSH"
  
  # Validate we're in a Git realm
  if [[ "$treasure" == "unknown" || "$branch" == "none" ]]; then
    error "Not in a valid Git repository!"
    return 1
  fi
  
  # Security check first
  info "Running security check..."
  if ! check_security_scrolls; then
    error "Security check failed. Push aborted."
    return 1
  fi
  
  # Check for uncommitted changes
  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "You have uncommitted changes"
    git status -s
    
    if confirm_spell "Commit all changes?" "y"; then
      read -p "$(echo -e ${GREEN})Commit message: ${RESET}" msg
      msg="${msg:-WIP: autopilot commit}"
      git add -A
      git commit -m "$msg"
    else
      error "Cannot push with uncommitted changes"
      return 1
    fi
  fi
  
  # Check branch protection
  local protected=0
  if ! check_protection_spells "$branch" "$treasure" "$target_realm"; then
    protected=1
    warn "$branch is protected — cannot push directly!"
  fi
  
  # Determine push strategy
  if [[ "$protected" -eq 1 ]] || [[ "$current_realm" != "$target_realm" ]]; then
    # Need fork + PR flow (beginner friendly)
    info "Using fork + PR flow (target: $target_realm/$treasure)"
    
    if ! has_magic "gh" "brew install gh && gh auth login"; then
      error "GitHub CLI required for fork+PR flow"
      return 1
    fi
    
    # Check if fork exists
    if ! gh repo view "$current_realm/$treasure" &>/dev/null; then
      info "Creating fork of $target_realm/$treasure..."
      if ! gh repo fork --remote --clone=false; then
        error "Failed to create fork"
        return 1
      fi
      success "Fork created: $current_realm/$treasure"
    fi
    
    # Add fork remote if not exists
    if ! git remote | grep -q "^fork$"; then
      git remote add fork "https://github.com/$current_realm/$treasure.git"
    fi
    
    # Push to fork
    info "Pushing to fork..."
    if ! git push -u fork "$branch"; then
      error "Failed to push to fork"
      return 1
    fi
    success "Pushed to fork: $current_realm/$treasure"
    
    # Check if PR already exists
    local existing_pr
    existing_pr=$(gh pr list --repo "$target_realm/$treasure" --head "$current_realm:$branch" --json number --jq '.[0].number' 2>/dev/null)
    
    if [[ -n "$existing_pr" ]]; then
      info "PR #$existing_pr already exists"
      gh pr view --repo "$target_realm/$treasure" "$existing_pr" --web
    else
      # Create PR
      info "Creating PR to $target_realm/$treasure..."
      local pr_url
      pr_url=$(gh pr create --repo "$target_realm/$treasure" \
        --head "$current_realm:$branch" \
        --base "$branch" \
        --title "$(git log -1 --pretty=%s)" \
        --body "$(git log -1 --pretty=%b)" 2>/dev/null)
      
      if [[ -n "$pr_url" ]]; then
        success "PR created: $pr_url"
        if confirm_spell "Open PR in browser?" "y"; then
          open "$pr_url" 2>/dev/null || xdg-open "$pr_url" 2>/dev/null || echo "$pr_url"
        fi
      else
        error "Failed to create PR"
        return 1
      fi
    fi
  else
    # Direct push
    if [[ "$branch" == "main" || "$branch" == "master" ]]; then
      warn "Pushing directly to $branch — this may be blocked by protection"
      if ! confirm_spell "Continue with direct push?" "n"; then
        return 0
      fi
    fi
    
    # Show what's being pushed
    echo -e "\n${CYAN}Changes to push:${RESET}"
    if git log @{u}.. 2>/dev/null | grep -q .; then
      git --no-pager log --oneline @{u}..
    else
      echo "  (no new commits)"
    fi
    
    if confirm_spell "Push these changes?" "y"; then
      if git push origin "$branch"; then
        success "Pushed to $target_realm/$treasure"
      else
        error "Push failed. Try: git-wizard push $target_realm (for fork+PR)"
        return 1
      fi
    fi
  fi
}

# ============================================================================
# WIZARD'S PR SCROLL (CREATE PULL REQUEST)
# ============================================================================

spell_create_pr() {
  local target_realm="${1:-$(get_current_realm)}"
  local branch=$(get_current_path)
  local treasure=$(get_treasure_name)
  
  header "🔄 CREATING PULL REQUEST"
  
  if ! has_magic "gh" "brew install gh && gh auth login"; then
    error "GitHub CLI required for PRs"
    return 1
  fi
  
  # Check if there's already a PR
  local existing_pr
  existing_pr=$(gh pr list --repo "$target_realm/$treasure" --head "$branch" --json number --jq '.[0].number' 2>/dev/null)
  
  if [[ -n "$existing_pr" ]]; then
    info "PR #$existing_pr already exists"
    if confirm_spell "View it?" "y"; then
      gh pr view --repo "$target_realm/$treasure" "$existing_pr" --web
    fi
    return 0
  fi
  
  # Create new PR
  read -p "$(echo -e ${GREEN})PR title: ${RESET}" title
  title="${title:-$(git log -1 --pretty=%s)}"
  
  read -p "$(echo -e ${GREEN})PR description (optional): ${RESET}" body
  
  local pr_url
  pr_url=$(gh pr create --repo "$target_realm/$treasure" \
    --head "$branch" \
    --base "main" \
    --title "$title" \
    --body "$body" 2>/dev/null)
  
  if [[ -n "$pr_url" ]]; then
    success "PR created: $pr_url"
    if confirm_spell "Open in browser?" "y"; then
      open "$pr_url" 2>/dev/null || xdg-open "$pr_url" 2>/dev/null || echo "$pr_url"
    fi
  else
    error "Failed to create PR"
    return 1
  fi
}

# ============================================================================
# WIZARD'S INTERACTIVE GRIMOIRE (MENU)
# ============================================================================

show_grimoire() {
  echo -e "${BOLD}${CYAN}${EMOJI_WIZARD} Choose your spell:${RESET}"
  echo
  echo -e "  ${GREEN}1)${RESET} ${EMOJI_SCROLL}  Show journey map (status)"
  echo -e "  ${GREEN}2)${RESET} ${EMOJI_PULL}  Pull latest magic (git pull)"
  echo -e "  ${GREEN}3)${RESET} ${EMOJI_COMMIT} Commit changes"
  echo -e "  ${GREEN}4)${RESET} ${EMOJI_PUSH}  Autopilot push (with fork+PR if needed)"
  echo -e "  ${GREEN}5)${RESET} ${EMOJI_PR}    Create pull request"
  echo -e "  ${GREEN}6)${RESET} ${EMOJI_GITHUB} Switch GitHub realm (change origin)"
  echo -e "  ${GREEN}7)${RESET} ${EMOJI_SHIELD} Check branch protection"
  echo -e "  ${GREEN}8)${RESET} ${EMOJI_LOCK}   Security scroll check"
  echo -e "  ${GREEN}9)${RESET} ${EMOJI_ROCKET} Quick save & push (add+commit+push)"
  echo -e "  ${GREEN}10)${RESET} ${EMOJI_MAGIC} Debug mode (toggle: currently ${DEBUG})"
  echo -e "  ${RED}0)${RESET} ${EMOJI_WIZARD} Exit the wizard"
  echo
  read -p "$(echo -e ${CYAN})Choose a spell [0-10]: ${RESET}" choice
  echo
}

# Quick save spell (for lazy wizards)
spell_quick_save() {
  header "⚡ QUICK SAVE & PUSH"
  
  # Add all changes
  git add -A
  
  # Commit with timestamp
  local msg="Quick save: $(date '+%Y-%m-%d %H:%M:%S')"
  git commit -m "$msg" 2>/dev/null || warn "Nothing to commit"
  
  # Push
  spell_autopilot_push
}

# ============================================================================
# WIZARD'S INITIATION (HELP)
# ============================================================================

show_initiation_scroll() {
  header "📜 WIZARD'S INITIATION SCROLL"
  echo "Usage: $0 [command]"
  echo
  echo "Commands:"
  echo "  status        - Show your current journey"
  echo "  pull          - Pull latest magic"
  echo "  commit        - Commit changes"
  echo "  push [realm]  - Autopilot push (to specific realm)"
  echo "  pr [realm]    - Create pull request"
  echo "  switch <realm>- Switch GitHub realm"
  echo "  protect       - Check branch protection"
  echo "  security      - Run security check"
  echo "  quick         - Quick save & push"
  echo "  debug         - Toggle debug mode"
  echo "  help          - Show this scroll"
  echo
  echo "Examples:"
  echo "  $0 push                    # Push to current realm"
  echo "  $0 push haribinger          # Push to haribinger (fork+PR if needed)"
  echo "  $0 switch kdairatchi        # Switch to kdairatchi realm"
  echo "  $0 quick                    # Add all, commit, push in one spell"
  echo
  echo "Realms (GitHub accounts):"
  for ally in "${!ALLIES[@]}"; do
    echo "  $ally → ${ALLIES[$ally]}"
  done
}

# ============================================================================
# WIZARD'S MAIN SPELL
# ============================================================================

main() {
  show_spellbook
  
  # Quick command mode
  if [[ $# -gt 0 ]]; then
    case "$1" in
      status|map)
        show_journey_map
        ;;
      pull)
        spell_pull
        ;;
      commit)
        spell_commit
        ;;
      push|autopilot)
        spell_autopilot_push "${2:-}"
        ;;
      pr|pullrequest)
        spell_create_pr "${2:-}"
        ;;
      switch|realm)
        spell_switch_realm "${2:-}" "${3:-}" "${4:-ssh}"
        ;;
      protect|protection)
        check_protection_spells "$(get_current_path)"
        ;;
      security|sec)
        check_security_scrolls
        ;;
      quick|fast)
        spell_quick_save
        ;;
      debug)
        if [[ "$DEBUG" == "true" ]]; then
          DEBUG=false
        else
          DEBUG=true
        fi
        info "Debug mode: $DEBUG"
        ;;
      help|--help|-h)
        show_initiation_scroll
        exit 0
        ;;
      *)
        error "Unknown spell: $1"
        echo "Try: $0 help"
        exit 1
        ;;
    esac
    exit 0
  fi
  
  # Interactive mode
  while true; do
    show_journey_map
    show_grimoire
    
    case $choice in
      1) show_journey_map ;;
      2) spell_pull ;;
      3) spell_commit ;;
      4) spell_autopilot_push ;;
      5) spell_create_pr ;;
      6)
        echo "Available realms:"
        for ally in "${!ALLIES[@]}"; do
          echo "  $ally → ${ALLIES[$ally]}"
        done
        read -p "Switch to realm: " target
        if [[ -n "$target" ]]; then
          read -p "Protocol (ssh/https) [ssh]: " protocol
          protocol=${protocol:-ssh}
          spell_switch_realm "$target" "" "$protocol"
        fi
        ;;
      7) check_protection_spells "$(get_current_path)" ;;
      8) check_security_scrolls ;;
      9) spell_quick_save ;;
      10)
        if [[ "$DEBUG" == "true" ]]; then
          DEBUG=false
        else
          DEBUG=true
        fi
        info "Debug mode: $DEBUG"
        ;;
      0)
        success "May your commits always merge cleanly! ${EMOJI_WIZARD}"
        exit 0
        ;;
      *)
        warn "That spell doesn't exist in the grimoire!"
        ;;
    esac
    
    press_any_key
  done
}

# ============================================================================
# WIZARD'S ERROR CATCHER
# ============================================================================

catch_magic_fizzle() {
  local exit_code=$?
  local line_no=$1
  
  error "Your spell fizzled at line $line_no (exit code: $exit_code)"
  
  if [[ "$DEBUG" == "true" ]]; then
    echo -e "\n${MAGENTA}${EMOJI_SCROLL} Magical trace:${RESET}"
    local frame=0
    while caller $frame; do
      ((frame++))
    done
  fi
  
  exit $exit_code
}

# Set the trap
trap 'catch_magic_fizzle ${LINENO}' ERR

# ============================================================================
# LET THE MAGIC BEGIN!
# ============================================================================

# Allow sourcing for testing
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
