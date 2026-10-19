# Agent interface: CLI vs MCP vs Claude Code plugin (research notes, 2026-10-19)

Fetched from the Claude Code docs and MCP spec on 2026-10-19. Items marked **unverified** were not confirmed in the docs.

## Plugins
Sources: [manifest reference](https://code.claude.com/docs/en/plugins/manifest-reference), [components](https://code.claude.com/docs/en/plugins/components), [create a marketplace](https://code.claude.com/docs/en/plugins/create-marketplace), [CLI reference](https://code.claude.com/docs/en/plugins/cli-reference), [plugin evals](https://code.claude.com/docs/en/plugin-evals).

- `.claude-plugin/plugin.json` is optional; `name` is the only required key. Components live at the plugin root: `skills/<name>/SKILL.md`, `commands/*.md` (legacy), `agents/`, `hooks/hooks.json`, `.mcp.json`, `bin/`, `monitors/`, `output-styles/`, `settings.json`. A plugin-root `CLAUDE.md` is **not** loaded.
- **`bin/` is on the Bash tool's PATH** while the plugin is enabled, after the user's own PATH (cannot shadow `git`). claude.ai/Cowork refuse plugins with a top-level `bin/`. On Windows the Bash tool is Git Bash, so a `bin/` entry should be a shebang script; `.cmd`/`.exe` and the PowerShell tool are **unverified**.
- Env vars: `${CLAUDE_PLUGIN_ROOT}` (changes on update), `${CLAUDE_PLUGIN_DATA}` (persistent; use for node_modules/caches), `${CLAUDE_PROJECT_DIR}`. Substituted in hooks, MCP command/args/env and skill bodies; **not** in the environment of Bash-tool commands.
- **Commands are merged into skills**: `commands/x.md` and `skills/x/SKILL.md` both create `/x`; plugin skills are namespaced `/<plugin>:<skill>`.
- A repo can be its own marketplace via `.claude-plugin/marketplace.json` (`name`, `owner`, `plugins[]` with `name` + `source`, e.g. `./plugins/foo`). Root-level `"source": "./"` is **unverified**; check with `claude plugin validate`.
- Install: `claude plugin marketplace add <path | owner/repo>`, then `claude plugin install name@marketplace -y [--json]`. Dev: `claude --plugin-dir <path>`, `/reload-plugins`.
- `claude plugin validate <path> --strict --json`; `claude plugin eval` runs eval suites (`evals/<case>/prompt.md` + `graders/*.md`) in isolated `claude -p` sessions; the `llm` grader sees PNG/JPEG/WebP images, so an eval can grade a rendered contact sheet.

## Skills
Source: [skills](https://code.claude.com/docs/en/skills).
- Frontmatter: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `model`, `effort`, `context: fork`, `paths`, `shell: bash|powershell`, …
- Description + `when_to_use` are always in context, truncated at **1,536 chars**; body loads on invocation. Keep `SKILL.md` **under 500 lines**; reference files load only when SKILL.md points to them.
- `$ARGUMENTS`, `$0…$N`, named `$name`.

## How Claude Code sees images
- **Read on a PNG/JPG shows the image** ([tools reference](https://code.claude.com/docs/en/tools-reference#read-tool-behavior)). Large images are downscaled; above ~500 KB after resizing they are re-encoded as JPEG. Crop for fine detail.
- **MCP `image` content blocks are shown inline** ([MCP: images in tool results](https://code.claude.com/docs/en/mcp#images-in-tool-results)); original bytes are also saved to the session's `tool-results` dir (v2.1.283+). Subject to `MAX_MCP_OUTPUT_TOKENS` (default 25,000).
- **Bash output cannot carry images.** CLI route = print path, then Read (two round trips). MCP = one round trip. Token cost per image is the same; the lever is fewer, smaller images (contact sheets).

## MCP servers
- SDK: `@modelcontextprotocol/server` / `client` **2.3.1** (v2 line, spec 2026-07-28); `@modelcontextprotocol/sdk` 1.32.1 is the legacy v1 monolith ([v2 docs](https://ts.sdk.modelcontextprotocol.io/v2/)).
- Progress notifications (`notifications/progress` with the request's `progressToken`) reset Claude Code's idle timer; whether Claude Code **displays** them is unverified.
- Timeouts ([MCP reference](https://code.claude.com/docs/en/mcp#timeouts-and-output-limits)): `MCP_TOOL_TIMEOUT` (~28 h if unset), per-server `timeout`, idle timeout 30 min for stdio, calls running > 2 min auto-move to a background task. A start/status/result pattern works everywhere.
- MCP *tasks* (2025-11-25 spec) are experimental; Claude Code support unverified, so don't depend on them.
- **Tool search (deferred loading) is on by default**: only tool names + server instructions load upfront, so MCP definitions cost little context.
- Claude Desktop: stdio servers or an `.mcpb` bundle (Node bundled with Desktop on Windows). claude.ai: remote HTTPS connectors only, so a local renderer is not reachable there without hosting.

## Recommendation (from this research)
The subagent leaned MCP-first. Synthesis in `docs/research.md` §7 weighs it against the CLI-first expectation: CLI stays the core (deterministic, scriptable, works in any shell, testable, cheap); the plugin ships the skill + a thin MCP server whose value is inline images and progress; `bin/` exposes the CLI to the Bash tool without a global install.

## Unverified / open
- MCP progress display in Claude Code; MCP tasks support; `resource_link` handling.
- `bin/` with `.cmd`/`.exe` on Windows and in the PowerShell tool.
- MCP image downscale rules (only Read's are documented).
- Marketplace `source: "./"` at repo root.
