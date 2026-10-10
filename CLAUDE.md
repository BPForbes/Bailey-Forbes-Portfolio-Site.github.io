@AGENTS.md

# Claude Code notes

Everything above is shared with other agents. The points below are specific to Claude Code.

## Session hook

`.claude/settings.json` registers a `SessionStart` hook, `.claude/hooks/session-start.sh`.
In a remote session it runs `npm install`, `npm run build`, and installs the UI/UX Pro Max
skill set into `.claude/skills/` (gitignored). It exits at once when `CLAUDE_CODE_REMOTE` is
not `true`, so a local checkout is untouched. The hook is synchronous: a session waits for it.

If the skills are missing in a session, re-run the hook's last step by hand:
`npx -y ui-ux-pro-max-cli@latest init --ai claude`.

## Working in this repository

- Use the project's own commands in `AGENTS.md`. Do not invent a lint command: this
  repository has no linter, and its typecheck is `npm run build`.
- When a task touches a folder with its own `AGENTS.md`, read that file before editing.
  The folder file adds to the rules here; it never relaxes them.
- Prefer the dedicated tools for reading and searching files over shell pipelines.
- For a UI change, run the rendered audit against a local server before you report success.

## Other repositories

Other project repositories are attached read-only unless a human attaches one with push
access. You may read them and cite them. Do not push to them, and do not assume a file you
read there is in this repository. See [`docs/agents/multi-repo.md`](docs/agents/multi-repo.md).
