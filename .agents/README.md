# Coby LIFE — Project Agent Skills

Workspace-scoped skills stored in `.agents/skills/` so Antigravity discovers them automatically whenever this project is opened.

## Bundled Repositories (65 Skills Total)

- **obra/superpowers** (`22f0b46`, 15 skills): `brainstorming`, `diagnosing-superpowers`, `dispatching-parallel-agents`, `executing-plans`, `finishing-a-development-branch`, `receiving-code-review`, `requesting-code-review`, `subagent-driven-development`, `systematic-debugging`, `test-driven-development`, `using-git-worktrees`, `using-superpowers`, `verification-before-completion`, `writing-plans`, `writing-skills`
- **cloudflare/security-audit-skill** (`c1c8a8c`, 1 skills): `security-audit`
- **anthropics/skills** (`e4bb5d9`, 19 skills): `academy-guide`, `algorithmic-art`, `brand-guidelines`, `canvas-design`, `claude-api`, `discernment-nudge`, `doc-coauthoring`, `docx`, `frontend-design`, `internal-comms`, `mcp-builder`, `pdf`, `pptx`, `skill-creator`, `slack-gif-creator`, `theme-factory`, `webapp-testing`, `web-artifacts-builder`, `xlsx`
- **thedotmack/claude-mem** (`11b47f9`, 30 skills): `agent-cost-report`, `babysit`, `backup-setup`, `build`, `build-and-release`, `ccs-align`, `childhood`, `cloud-sync`, `design-is`, `do`, `handoff`, `how-it-works`, `knowledge-agent`, `learn-codebase`, `make-plan`, `mem-search`, `mode-creator`, `oh-my-issues`, `owner-goals`, `pathfinder`, `release`, `request-progress`, `screenpipe`, `smart-explore`, `standup`, `timeline-report`, `version-bump`, `weekly-digests`, `what-the`, `wowerpoint`

## Notes

- Managed on a feature branch (`chore/install-agent-skills`) to keep `main` clean per `HANDOFF.md`.
- Each skill folder contains a `SKILL.md` manifest compatible with Antigravity progressive disclosure and `/<skill-name>` slash commands.