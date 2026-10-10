#!/bin/bash
# SessionStart hook for Claude Code cloud sessions.
#
# Makes a fresh container able to build, test and audit this site, and
# installs the UI/UX Pro Max skill set into .claude/skills/ (gitignored) so a
# session has it without the skill living in the repository. Runs only in a
# remote session; a local checkout keeps whatever the developer has set up.
#
# Idempotent: every step is safe to repeat, and the container state is
# cached after the hook completes, so the second run of a session is fast.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Node dependencies (the TypeScript sources, esbuild, KaTeX, the test suite).
#    `npm install` rather than `npm ci` so the cached node_modules is reused.
npm install --no-audit --no-fund

# 2. Build once, so modules/ and js/ exist for `npm test` and a local server.
npm run build

# 3. The UI/UX Pro Max skills, into the gitignored .claude/skills/. The CLI
#    writes the core skill plus its six sub-skills; `--offline` is only a
#    compatibility flag here, the package itself carries the assets.
if [ ! -f .claude/skills/ui-ux-pro-max/SKILL.md ]; then
  npx -y ui-ux-pro-max-cli@latest init --ai claude
fi

echo "session-start: node modules installed, site built, ui-ux-pro-max skills in .claude/skills/"
