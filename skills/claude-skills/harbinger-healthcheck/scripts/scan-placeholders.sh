#!/bin/bash
# Scan for placeholder text, fake paths, and unrealized code in Harbinger
# Usage: ./scan-placeholders.sh [project_root]

ROOT="${1:-/home/anon/Harbinger}"
FE="$ROOT/harbinger-tools/frontend/src"
BE="$ROOT/backend/cmd"
SKILLS="$ROOT/skills"
EXIT_CODE=0

echo "=== HARBINGER PLACEHOLDER & PATH VALIDATION ==="
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1. Placeholder text patterns
echo "--- [1] PLACEHOLDER TEXT ---"
echo "Searching for placeholder patterns in source code..."
PATTERNS=(
  'TODO'
  'FIXME'
  'PLACEHOLDER'
  'CHANGEME'
  'REPLACE_ME'
  'YOUR_.*_HERE'
  'example\.com'
  'foo\b'
  'bar\b'
  'baz\b'
  'Lorem ipsum'
  'lorem ipsum'
  'xxx\b'
  'yyy\b'
  'zzz\b'
  'test123'
  'password123'
  'abc123'
  'sample'
  'dummy'
  'mock data'
  'fake'
  'placeholder'
  'TBD'
  'N/A.*implement'
  'not yet implemented'
  'coming soon'
  'work in progress'
  'WIP'
)

for pat in "${PATTERNS[@]}"; do
  hits=$(rg -i -c "$pat" --glob '*.{ts,tsx,go}' "$FE" "$BE" 2>/dev/null | awk -F: '{s+=$2} END{print s+0}')
  if [ "$hits" -gt 0 ]; then
    echo ""
    echo "  [$hits hits] Pattern: $pat"
    rg -i -n "$pat" --glob '*.{ts,tsx,go}' "$FE" "$BE" 2>/dev/null | grep -v node_modules | grep -v '.test.' | head -5
    EXIT_CODE=1
  fi
done
echo ""

# 2. Validate file paths referenced in skill SKILL.md files
echo "--- [2] SKILL FILE PATH VALIDATION ---"
for skill_dir in "$ROOT/skills/claude-skills"/*/; do
  skill_name=$(basename "$skill_dir")
  skill_md="$skill_dir/SKILL.md"
  if [ ! -f "$skill_md" ]; then
    echo "  MISSING: $skill_md"
    EXIT_CODE=1
    continue
  fi

  # Check referenced scripts exist
  if [ -d "$skill_dir/scripts" ]; then
    for script in "$skill_dir/scripts"/*.sh "$skill_dir/scripts"/*.py; do
      if [ -f "$script" ]; then
        basename_script=$(basename "$script")
        if ! grep -q "$basename_script" "$skill_md" 2>/dev/null; then
          echo "  UNREFERENCED: $skill_name/scripts/$basename_script (not mentioned in SKILL.md)"
        fi
      fi
    done
  fi

  # Check referenced files in SKILL.md actually exist
  grep -oP '\(references/[^)]+\)' "$skill_md" 2>/dev/null | tr -d '()' | while read -r ref; do
    full_path="$skill_dir/$ref"
    if [ ! -f "$full_path" ]; then
      echo "  BROKEN REF: $skill_name/SKILL.md references '$ref' but file does not exist"
      EXIT_CODE=1
    fi
  done
done
echo ""

# 3. Validate project paths referenced in source code
echo "--- [3] SOURCE CODE PATH VALIDATION ---"
echo "Checking hardcoded paths in frontend config..."

# Check vite.config.ts proxy targets
if [ -f "$ROOT/harbinger-tools/frontend/vite.config.ts" ]; then
  echo "  vite.config.ts proxy targets:"
  rg -n 'target:' "$ROOT/harbinger-tools/frontend/vite.config.ts" 2>/dev/null
fi
echo ""

# Check that referenced directories exist
echo "Checking key project directories exist..."
REQUIRED_DIRS=(
  "harbinger-tools/frontend/src/pages"
  "harbinger-tools/frontend/src/components"
  "harbinger-tools/frontend/src/store"
  "harbinger-tools/frontend/src/api"
  "harbinger-tools/frontend/src/types"
  "harbinger-tools/frontend/src/core"
  "backend/cmd"
  "agents"
  "skills"
  "mcp-plugins"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  full="$ROOT/$dir"
  if [ -d "$full" ]; then
    echo "  OK: $dir/"
  else
    echo "  MISSING: $dir/"
    EXIT_CODE=1
  fi
done
echo ""

# 4. Check for empty/stub files
echo "--- [4] EMPTY/STUB FILES ---"
find "$FE" "$BE" -name '*.ts' -o -name '*.tsx' -o -name '*.go' 2>/dev/null | while read -r f; do
  lines=$(wc -l < "$f" 2>/dev/null)
  if [ "$lines" -lt 3 ]; then
    echo "  STUB: $f ($lines lines)"
  fi
done
echo ""

# 5. Check for unreachable/dead routes
echo "--- [5] ROUTE VALIDATION ---"
echo "Frontend routes defined in App.tsx:"
if [ -f "$FE/../src/App.tsx" ] || [ -f "$FE/App.tsx" ]; then
  APP_FILE=$(find "$ROOT/harbinger-tools/frontend/src" -name 'App.tsx' -maxdepth 1 2>/dev/null | head -1)
  if [ -n "$APP_FILE" ]; then
    rg -n "path:" "$APP_FILE" 2>/dev/null | head -20
  fi
fi
echo ""

# 6. Validate skill script shebangs and executability
echo "--- [6] SCRIPT VALIDATION ---"
for script in "$ROOT/skills/claude-skills"/*/scripts/*.sh; do
  if [ -f "$script" ]; then
    if [ ! -x "$script" ]; then
      echo "  NOT EXECUTABLE: $script"
      EXIT_CODE=1
    fi
    first_line=$(head -1 "$script")
    if [[ "$first_line" != "#!/bin/bash"* ]] && [[ "$first_line" != "#!/usr/bin/env bash"* ]]; then
      echo "  BAD SHEBANG: $script (got: $first_line)"
    fi
  fi
done
echo ""

echo "=== SCAN COMPLETE (exit: $EXIT_CODE) ==="
exit $EXIT_CODE
