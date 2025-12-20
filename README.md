<img width="1024" height="434" alt="image" src="https://github.com/user-attachments/assets/bbc0aea5-8859-4434-b096-3b1bc03e775b" />

# 🚀 Auto Commit

A powerful interactive CLI tool for generating [Conventional Commit](https://www.conventionalcommits.org/) messages with AI assistance. Built with Deno and TypeScript.

## Features

### 🤖 AI-Powered Commit Generation
- **Multiple AI Providers**: OpenAI, Google Gemini, Anthropic Claude, and Groq
- **Intelligent Analysis**: AI analyzes your git diff and suggests appropriate commit messages
- **Customizable Models**: Choose from various models for each provider
- **Smart Fallback**: Falls back to manual mode if AI generation fails

### 💡 Interactive Experience
- **File Staging**: Interactive file selection with visual indicators
- **Conventional Commits**: Full support for all commit types
- **Rich Prompts**: Beautiful CLI interface with color-coded messages
- **Edit & Regenerate**: Edit AI suggestions or regenerate new ones
- **Scope Suggestions**: Common scopes + custom scope support

### ⚙️ Configuration
- **Persistent Settings**: Stores API keys and preferences locally
- **Easy Setup**: Simple configuration wizard
- **Provider Switching**: Easily switch between AI providers
- **Secure Storage**: API keys stored in `~/.config/auto-commit/config.json`

## 📦 Installation
### Prerequisites
- [Deno](https://deno.land/) 1.30 or higher

---

### Option 1 — Run Directly with Deno

```bash
deno run --allow-run --allow-net --allow-write --allow-env --allow-read https://raw.githubusercontent.com/vineyrawat/auto-commit/refs/heads/main/main.ts
```

### Option 2 — Install Globally

```bash
deno install --allow-run --allow-net --allow-write --allow-env --allow-read --global -n auto-commit https://raw.githubusercontent.com/vineyrawat/auto-commit/refs/heads/main/main.ts
```

Now you can run:

```bash
auto-commit
```

---
## 🎯 Usage

### Quick Start
```bash
# Generate commit with AI (if configured)
auto-commit

# Force AI generation
auto-commit --ai

# Skip file staging selection
auto-commit -s

# Dry run (preview without committing)
auto-commit -d

# Skip git hooks
auto-commit -n
```

### Configuration
```bash
# Open configuration wizard
auto-commit config
```

Configuration options:
1. **Select AI Provider** - Choose between OpenAI, Gemini, Anthropic, or Groq
2. **Set API Key** - Configure your API key for the selected provider
3. **Set AI Model** - Choose specific model for your provider
4. **View Current Config** - Display current settings
5. **Clear Config** - Reset all configuration

### AI Providers

#### OpenAI
- **API Key**: Get at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

#### Google Gemini
- **API Key**: Get at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

#### Anthropic Claude
- **API Key**: Get at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

#### Groq
- **API Key**: Get at [console.groq.com/keys](https://console.groq.com/keys)

## Workflow

### 1. File Staging (Interactive)
```bash
auto-commit
```
- View all changed files (staged, modified, untracked)
- Select/deselect files with spacebar
- Staged files are pre-selected
- Skip with `--skip-staging` flag

### 2. AI Generation (Optional)
If configured, you'll be prompted:
- **Use AI**: Analyzes git diff and generates commit message
- **Preview**: View generated message with type, scope, description, and body
- **Actions**:
  - ✓ Use this commit message
  - ✏️ Edit the commit message (description, type, scope, body, breaking change)
  - 🔄 Regenerate with AI
  - ✍️ Create manually

### 3. Manual Mode (Fallback)
Step-by-step prompts for:
- **Type**: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
- **Scope**: Choose from common scopes or enter custom
- **Description**: Short summary (imperative mood)
- **Body**: Optional detailed explanation
- **Breaking Change**: Flag and describe if breaking
- **Footers**: Add references, issue numbers, reviewers, etc.

### 4. Preview & Confirm
- Review formatted commit message
- Confirm or cancel
- Commit with optional `--no-verify` flag

## 🎨 Commit Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): add OAuth2 login` |
| `fix` | Bug fix | `fix(api): resolve null pointer error` |
| `docs` | Documentation | `docs: update installation guide` |
| `style` | Code formatting | `style: fix indentation` |
| `refactor` | Code restructure | `refactor(core): simplify validation logic` |
| `perf` | Performance improvement | `perf(db): optimize query execution` |
| `test` | Add/update tests | `test(api): add integration tests` |
| `build` | Build system changes | `build(deps): upgrade to deno 2.0` |
| `ci` | CI/CD changes | `ci: add GitHub Actions workflow` |
| `chore` | Maintenance tasks | `chore: update .gitignore` |
| `revert` | Revert previous commit | `revert: rollback auth changes` |

## 🔧 Common Scopes

Pre-configured scopes for faster workflow:
- `api` - API related changes
- `auth` - Authentication/Authorization
- `ui` - User interface changes
- `db` - Database changes
- `config` - Configuration changes
- `deps` - Dependencies update
- `core` - Core functionality
- `utils` - Utility functions
- Plus more...

## 📖 Examples

### AI-Generated Commit
```bash
$ auto-commit --ai

🤖 Generating commit message with AI...

🤖 AI Generated Commit Message (Google Gemini):
────────────────────────────────────────────────────────────
feat(auth): implement OAuth2 authentication flow

Add OAuth2 provider integration with Google and GitHub.
Includes token refresh mechanism and session management.
────────────────────────────────────────────────────────────

✓ Use this commit message
```

### Manual Commit with Breaking Change
```bash
$ auto-commit

Select the type of change: feat
Select a scope: api
Enter a short description: migrate to v2 endpoints
Add a detailed body? Yes
Enter the commit body: 
  Migrate all REST endpoints to v2 schema.
  Deprecate v1 endpoints (EOL: 2025-12-31).

Is this a BREAKING CHANGE? Yes
Describe the breaking change: 
  V1 API endpoints are no longer supported.
  Clients must update to v2 endpoints.

📝 Final commit message:
────────────────────────────────────────────────────────────
feat(api)!: migrate to v2 endpoints

Migrate all REST endpoints to v2 schema.
Deprecate v1 endpoints (EOL: 2025-12-31).

BREAKING CHANGE: V1 API endpoints are no longer supported.
Clients must update to v2 endpoints.
────────────────────────────────────────────────────────────

✓ Commit successful!
```

## 🛠️ Technical Details

### Built With
- **Runtime**: [Deno](https://deno.land/) 2.0+
- **CLI Framework**: [Cliffy](https://deno.land/x/cliffy) for interactive prompts
- **Git Operations**: Native Deno `Command` API
- **AI Integration**: Direct API calls to OpenAI, Gemini, Anthropic, and Groq

### Features
- ✅ Zero dependencies (except Cliffy)
- ✅ Secure local config storage
- ✅ Graceful error handling
- ✅ Color-coded terminal output
- ✅ Git hook support with `--no-verify`
- ✅ Dry-run mode for testing
- ✅ File staging with visual feedback
- ✅ AI-powered commit generation with fallback
- ✅ Multi-provider AI support

### Permissions Required
- `--allow-run`: Execute git commands
- `--allow-read`: Read git repository and config
- `--allow-write`: Write commits and config
- `--allow-env`: Access environment variables
- `--allow-net`: Make API calls to AI providers

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using this tool! (`auto-commit`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License © 2025 [Viney Rawat](https://github.com/vineyrawat)

---

**Made with ❤️ by [@vineyrawat](https://github.com/vineyrawat), for developers**

Need help? Found a bug? [Open an issue](https://github.com/vineyrawat/auto-commit/issues)
