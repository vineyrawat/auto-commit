# 🚀 Auto Commit — Interactive Conventional Commit Generator

An **interactive CLI tool built with Deno** to help you generate **Conventional Commit messages** effortlessly — with smart file staging, breaking change support, and dry-run previews.

---

## 🌟 Features

✅ **Interactive Commit Creation** — Guided prompts for type, scope, description, and more\
✅ **File Staging Assistant** — Choose which files to stage or unstage directly from the CLI\
✅ **Conventional Commit Formatting** — Auto-generates perfectly formatted messages\
✅ **Breaking Change Support** — Adds `BREAKING CHANGE:` footer with descriptions\
✅ **Footers & Metadata** — Add footers like `Refs`, `Closes`, `Reviewed-by`, etc.\
✅ **Dry Run Mode** — Preview the generated commit without actually committing\
✅ **Skip Git Hooks** — Option to bypass pre-commit hooks with `--no-verify`

---

## 📦 Installation

### Option 1 — Run Directly with Deno

```bash
deno run --allow-run --allow-read https://raw.githubusercontent.com/vineyrawat/auto-commit/main/auto_commit.ts
```

### Option 2 — Install Globally

```bash
deno install --allow-run --allow-read -n auto-commit https://raw.githubusercontent.com/vineyrawat/auto-commit/main/auto_commit.ts
```

Now you can run:

```bash
auto-commit
```

---

## 🧠 Usage

Run inside any **Git repository** with unstaged, staged, or untracked changes.

```bash
auto-commit
```

You’ll be guided through:

1. Selecting files to stage
2. Choosing a commit type (`feat`, `fix`, `docs`, etc.)
3. Optionally selecting or entering a scope
4. Writing your short description
5. Adding body text, breaking change notes, and footers

---

## ⚙️ Command Options

| Option               | Description                                             |
| -------------------- | ------------------------------------------------------- |
| `-n, --no-verify`    | Bypass Git hooks during commit                          |
| `-d, --dry-run`      | Preview the generated commit message without committing |
| `-s, --skip-staging` | Skip file staging step (requires pre-staged files)      |

---

## 🧩 Example Run

```bash
$ auto-commit

🚀 Conventional Commit Message Generator

📂 File Staging
? Select files to stage for commit
  [x] src/utils/helpers.ts (modified)
  [ ] README.md (untracked)

📝 Commit Message
? Select the type of change: feat - A new feature
? Select a scope (optional): ui - User interface changes
? Enter a short description: add new theme switcher
? Add a detailed body? Yes
? Enter the commit body: implemented light/dark theme toggle
? Is this a BREAKING CHANGE? No
? Add footers? No

📝 Generated commit message:

feat(ui): add new theme switcher

implemented light/dark theme toggle

✓ Commit successful!
```

---

## 🧱 Commit Message Format

Generated messages follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <short description>

[optional body]

[optional BREAKING CHANGE: <description>]

[optional footer(s)]
```

Example:

```
feat(auth): add JWT token refresh support

BREAKING CHANGE: deprecated session-based auth

Refs: #123
Reviewed-by: Vinay
```

---

## 🧰 Requirements

- [Deno](https://deno.land/) v1.40.0 or later
- A Git repository initialized in the current directory
- Optional: Git hooks if you want to use `--no-verify`

---

## 🧑‍💻 Developer Notes

- Built using [Cliffy](https://deno.land/x/cliffy) for CLI and prompt handling
- Uses Deno’s `Command` API for Git operations
- Cleanly exits on errors or skipped commits
- Supports all Conventional Commit types (`feat`, `fix`, `docs`, `perf`, `ci`, etc.)

---

## 🧾 License

MIT License © 2025 [Viney Rawat](https://github.com/vineyrawat)