# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-11-16

### Changed
- **Model lists updated to what providers currently serve** (checked against each provider's docs on 2026-11-16):
  - **OpenAI:** GPT-6 family (`gpt-6.1-terra`, `gpt-6-luna`, `gpt-6.1-sol`, `gpt-6-astra`) plus `gpt-5.5`. Default is now `gpt-6.1-terra`.
  - **Gemini:** `gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-4-hydrogen`, `gemini-3.1-pro-preview`, `gemini-3.6-flash`. Default is now `gemini-3.8-flash`.
  - **Anthropic:** Claude 5.5 family (`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`) plus `claude-fable-5-2`, with `claude-sonnet-4-6` and `claude-opus-4-7` kept as previous-generation options. Default is now `claude-haiku-5-5`.
  - **Groq:** `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`.
  - Removed IDs that are shut down, deprecated, Enterprise-only, or were never valid, including `gpt-5.5-instant`, `gemini-3-flash`, `gemini-3-pro-preview`, `o4-mini`, `claude-opus-4-1-20250805`, `moonshotai/kimi-k2-instruct`, `qwen/qwen3-32b`, and the Llama 4 models.
- All providers now request JSON output mode, and reasoning or thinking effort is set to low so token budgets go to the answer.
- "Regenerate" and "Edit" now return to the preview instead of committing right away. Edit lets you change several fields before you continue.
- The Gemini API key is sent in the `x-goog-api-key` header instead of the URL query string.
- The API key prompt hides what you type.
- Lockfiles and generated files (`*.lock`, `package-lock.json`, `go.sum`, `*.min.js`, source maps, …) are listed in the prompt, but their diff bodies are left out.
- When a diff is too large, small files are kept whole and larger files share the remaining budget.
- Internal cleanup: one provider table and one git helper replace the duplicated per-provider and per-command code.

### Added
- API keys can come from `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `GROQ_API_KEY` when no key is saved in the config file.
- Warning when the configured model is retired or about to be, with a suggested replacement.
- 90-second request timeout and automatic retries on rate limits (429) and server errors (5xx). Retries honor `Retry-After`.
- Hints after 401/403 (check your key) and 404/model errors (check the model name).
- `config` → "View Current Config" shows where the key comes from (config file or env var) and the config file path.
- A unit test suite plus `deno task test` and `deno task check`.

### Fixed
- `-n, --no-verify` was ignored, so git hooks always ran.
- The default OpenAI and Gemini models were invalid IDs, so requests failed unless you picked a model yourself.
- Gemini and Anthropic crashed when the response had no text, for example when thinking used up the 500-token limit or the first content block was a thinking block.
- Model replies with text around the JSON failed to parse. Unknown commit types now fall back to `chore`. A repeated `type(scope):` prefix and a trailing period are stripped, and descriptions are cut to 72 characters.
- Running from a subdirectory broke staging and unstaging, because paths from different git commands disagreed. Git now runs from the repo root.
- File names with spaces or non-ASCII characters were mangled in the staging list.
- With `color.ui=always` set in git config, ANSI color codes were sent to the model.
- Unstaging failed in a repository with no commits yet.
- Running outside a git repository said "No changes detected" instead of saying it isn't a git repository.
- The config file is now created with owner-only permissions (`0600`), and its directory with `0700`.
- A missing `HOME` (Windows) produced the config path `undefined/.config/...`. It now falls back to `USERPROFILE`.
- An unreadable or invalid config file is now reported instead of being silently ignored.
- The spinner no longer writes control characters when output isn't a terminal.
- The `--version` output was stuck at 1.2.0.
- `main_test.ts` imported a function that doesn't exist, so `deno test` always failed.

## [1.3.0] - 2026-05-08

### Added
- File name-status and diff stat are included in AI prompts, so the model sees every changed file.
- Per-provider diff size limits, with per-file truncation for large diffs.
- Terminal spinner during AI generation.
- GPT-5.5 family and o-series model support (`max_completion_tokens`, no custom temperature).

### Changed
- Updated model lists and defaults for all providers.
- Clearer error when OpenAI returns empty content.

## [1.2.0] - 2025-12-20

### Changed
- Updated AI model lists and default selections for OpenAI, Gemini, Anthropic, and Groq.
- Restructured README; install instructions include all required Deno permissions.

## [1.1.0] - 2025-10-22

### Added
- AI-generated commit messages with OpenAI, Google Gemini, Anthropic Claude, and Groq.
- `config` command to choose the provider, API key, and model, saved in `~/.config/auto-commit/config.json`.
- Use, edit, regenerate, or write manually after generation.
- Detailed README covering features and usage.

## [1.0.0] - 2025-10-08

### Added
- Interactive conventional commit message builder: type, scope, description, body, breaking change, and footers.
- Interactive file staging with staged, modified, and untracked indicators.
- Multi-line body support using `\n`.
- `--dry-run`, `--skip-staging`, and `--no-verify` options.

[1.4.0]: https://github.com/vineyrawat/auto-commit/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/vineyrawat/auto-commit/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/vineyrawat/auto-commit/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/vineyrawat/auto-commit/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/vineyrawat/auto-commit/releases/tag/v1.0.0
