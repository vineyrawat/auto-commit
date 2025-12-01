# CLAUDE.md - AI Assistant Guide

This document provides comprehensive guidance for AI assistants working with the **Auto Commit** codebase.

## Table of Contents

- [Project Overview](#project-overview)
- [Codebase Structure](#codebase-structure)
- [Architecture & Design](#architecture--design)
- [Development Workflows](#development-workflows)
- [Key Conventions](#key-conventions)
- [Testing Strategy](#testing-strategy)
- [Common Tasks](#common-tasks)
- [AI-Specific Guidelines](#ai-specific-guidelines)

---

## Project Overview

### What is Auto Commit?

Auto Commit is an interactive CLI tool that helps developers create [Conventional Commit](https://www.conventionalcommits.org/) messages with optional AI assistance. Built with Deno and TypeScript.

### Key Features

1. **AI-Powered Commit Generation**
   - Supports 4 AI providers: OpenAI, Gemini, Anthropic, Groq
   - Analyzes git diff to suggest appropriate commit messages
   - Fallback to manual mode if AI fails

2. **Interactive File Staging**
   - Visual selection of files to stage
   - Shows file status (staged/modified/untracked)
   - Pre-selects already staged files

3. **Conventional Commits**
   - Full support for all commit types (feat, fix, docs, etc.)
   - Scope support with common presets
   - Breaking change detection
   - Footer support (refs, reviewers, etc.)

4. **Configuration Management**
   - Persistent config in `~/.config/auto-commit/config.json`
   - API key storage per provider
   - Model selection per provider

### Technology Stack

- **Runtime**: Deno 2.0+
- **Language**: TypeScript
- **CLI Framework**: Cliffy (prompts, commands, colors)
- **Git Operations**: Native Deno.Command API
- **AI Integration**: Direct REST API calls (fetch)

### Required Permissions

```bash
--allow-run    # Execute git commands
--allow-read   # Read git repo and config
--allow-write  # Write commits and config
--allow-env    # Access HOME environment variable
--allow-net    # Make AI provider API calls
```

---

## Codebase Structure

### File Organization

```
auto-commit/
├── main.ts              # Main application file (~1024 lines)
├── main_test.ts         # Test file (placeholder)
├── deno.json            # Deno configuration
├── deno.lock            # Dependency lock file
├── README.md            # User documentation
├── CONTRIBUTING.md      # Contribution guidelines
├── CODE_OF_CONDUCT.md   # Community guidelines
├── SECURITY.md          # Security policy
├── LICENSE              # MIT License
└── .git/                # Git repository
```

### Main File Structure (main.ts)

The entire application logic is contained in `main.ts`:

**Lines 1-91**: Configuration & Constants
- COMMIT_TYPES array (feat, fix, docs, etc.)
- AIProvider type definition
- CommitMessage interface
- Config interface
- PROVIDER_INFO with model details

**Lines 93-109**: Config Management
- `loadConfig()` - Load from ~/.config/auto-commit/config.json
- `saveConfig()` - Persist configuration

**Lines 111-129**: Git Operations - Diff
- `getDiff()` - Get staged changes

**Lines 131-363**: AI Generation Functions
- `generateWithOpenAI()` - OpenAI GPT integration
- `generateWithGemini()` - Google Gemini integration
- `generateWithAnthropic()` - Anthropic Claude integration
- `generateWithGroq()` - Groq integration
- `getPrompt()` - Unified prompt template
- `parseAIResponse()` - Parse JSON from AI responses
- `generateCommitWithAI()` - Main AI orchestration

**Lines 366-395**: Commit Message Formatting
- `formatCommitMessage()` - Convert CommitMessage to string

**Lines 397-492**: Git File Operations
- `getStagedFiles()` - Get currently staged files
- `getModifiedFiles()` - Get modified unstaged files
- `getUntrackedFiles()` - Get untracked files
- `stageFiles()` - Stage files
- `unstageFiles()` - Unstage files

**Lines 494-515**: Git Commit
- `commitMessage()` - Execute git commit

**Lines 517-1024**: CLI Command Definition
- Main command with options
- Config subcommand (lines 525-671)
- Main action handler (lines 673-1023)
  - File staging logic
  - AI generation workflow
  - Manual commit workflow
  - Preview and confirmation

---

## Architecture & Design

### Design Principles

1. **Single Responsibility**: Each function has a clear, focused purpose
2. **Progressive Enhancement**: Works without AI, enhanced with AI
3. **User-Centric**: Rich feedback and clear error messages
4. **Fail Gracefully**: Falls back to manual mode on errors
5. **Stateless**: No in-memory state, config loaded fresh each run

### Data Flow

```
User Runs Command
    ↓
File Staging Selection (optional)
    ↓
AI Generation? (if configured)
    ├─ Yes → Generate → Preview → Edit/Use/Regenerate/Manual
    └─ No  → Manual Mode
    ↓
Manual Commit Builder (if needed)
    ├─ Type Selection
    ├─ Scope Selection
    ├─ Description
    ├─ Body (optional)
    ├─ Breaking Change (optional)
    └─ Footers (optional)
    ↓
Preview Final Message
    ↓
Confirm
    ↓
Git Commit
```

### AI Integration Pattern

All AI providers follow the same pattern:

1. **Input**: git diff + structured prompt
2. **Output**: JSON with conventional commit structure
3. **Error Handling**: Return null on failure, caller handles fallback
4. **Timeout**: Relies on fetch timeout (default)
5. **Response Parsing**: Strips markdown, validates JSON

### Configuration Storage

```json
{
  "provider": "gemini",
  "openaiApiKey": "sk-...",
  "geminiApiKey": "AI...",
  "anthropicApiKey": "sk-ant-...",
  "groqApiKey": "gsk_...",
  "openaiModel": "gpt-4o-mini",
  "geminiModel": "gemini-2.0-flash-exp",
  "anthropicModel": "claude-sonnet-4-5-20250929",
  "groqModel": "llama-3.3-70b-versatile"
}
```

Stored at: `~/.config/auto-commit/config.json`

---

## Development Workflows

### Running the Tool

```bash
# Direct execution
deno run --allow-run --allow-read --allow-write --allow-env --allow-net main.ts

# Or with shebang (Unix)
chmod +x main.ts
./main.ts

# Install globally
deno install --allow-run --allow-net --allow-write --allow-env --allow-read \
  --global -n auto-commit main.ts
```

### Development Mode

```bash
# Watch mode (from deno.json)
deno task dev
```

### Testing

```bash
# Run tests
deno test

# Run with permissions
deno test --allow-read --allow-write --allow-run
```

### Manual Testing Checklist

1. **File Staging**
   - Create new file → should show as untracked
   - Modify file → should show as modified
   - Stage file → should show as staged and pre-selected

2. **AI Generation**
   - Test with each provider (OpenAI, Gemini, Anthropic, Groq)
   - Test edit workflow
   - Test regenerate workflow
   - Test fallback to manual on error

3. **Manual Mode**
   - Test all commit types
   - Test custom scope
   - Test breaking change
   - Test footers

4. **Edge Cases**
   - No changes → should error gracefully
   - No staged files + skip-staging → should error
   - Invalid API key → should fallback to manual
   - Empty diff → should fallback to manual

### Adding a New AI Provider

1. Update `AIProvider` type (line 21)
2. Add to `Config` interface (lines 36-46)
3. Add to `PROVIDER_INFO` (lines 48-91)
4. Create `generateWith<Provider>()` function
5. Add case to `generateCommitWithAI()` switch
6. Update config command options (lines 543-563)
7. Update config save/load logic (lines 580-651)

---

## Key Conventions

### Commit Message Format

This project uses its own tool for commits. Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no logic change)
- `refactor`: Code restructure (no feature/fix)
- `perf`: Performance improvement
- `test`: Add/update tests
- `build`: Build system or dependencies
- `ci`: CI/CD changes
- `chore`: Maintenance tasks
- `revert`: Revert previous commit

**Breaking Changes**: Add `!` after scope or `BREAKING CHANGE:` in footer

### Code Style

1. **TypeScript**
   - Use interfaces for object shapes
   - Use type aliases for unions
   - Prefer explicit return types for exported functions
   - Use async/await over promises

2. **Naming**
   - Functions: camelCase, verb-noun (e.g., `getStagedFiles`)
   - Constants: SCREAMING_SNAKE_CASE (e.g., `COMMIT_TYPES`)
   - Interfaces: PascalCase (e.g., `CommitMessage`)
   - Variables: camelCase (e.g., `apiKey`)

3. **Error Handling**
   - Use try-catch for external operations (git, API calls)
   - Return null/empty on failure, let caller handle
   - Log errors with colors.red()
   - Never throw unhandled errors to user

4. **User Feedback**
   - Use colored output (colors.green for success, colors.red for error, colors.yellow for warning, colors.dim for hints)
   - Use emojis sparingly and consistently
   - Provide clear action prompts

5. **Git Commands**
   - Always use `Deno.Command` API
   - Pipe stdout/stderr as needed
   - Check success flag before using output
   - Use text decoder for output

### CLI Patterns

1. **Options**: Use kebab-case (e.g., `--no-verify`)
2. **Short flags**: Single letter (e.g., `-n`)
3. **Prompts**: Use Cliffy prompt components
4. **Colors**: Use Cliffy colors module
5. **Separators**: Use `─`.repeat(60) for visual sections

---

## Testing Strategy

### Current State

The project has minimal test coverage (`main_test.ts` is a placeholder).

### Testing Recommendations

1. **Unit Tests**
   - `formatCommitMessage()` - Test all format variations
   - `parseAIResponse()` - Test JSON parsing edge cases
   - `getPrompt()` - Verify prompt structure

2. **Integration Tests**
   - Git operations (requires test git repo)
   - Config save/load
   - AI provider calls (with mocks)

3. **E2E Tests**
   - Full workflow simulation
   - Mock user inputs with Cliffy test utilities
   - Verify git commit created correctly

### Testing Best Practices

- Use `@std/assert` for assertions
- Mock external dependencies (git, API calls)
- Test error paths as thoroughly as happy paths
- Use descriptive test names

---

## Common Tasks

### Adding a New Commit Type

1. Add to `COMMIT_TYPES` array (lines 7-19)
2. Update AI prompt in `getPrompt()` if needed (line 287)
3. Update README.md commit types table

### Adding a New Scope

Add to `COMMON_SCOPES` array in main action (lines 886-903)

### Changing AI Prompt

Edit `getPrompt()` function (lines 282-308)
- Keep JSON structure consistent
- Test with all providers
- Ensure response parseable by `parseAIResponse()`

### Updating Model Defaults

Edit `PROVIDER_INFO` object (lines 48-91)
- Update default model
- Add/remove model options
- Update URLs if changed

### Modifying Config Location

Edit `CONFIG_DIR` and `CONFIG_FILE` constants (lines 33-34)

---

## AI-Specific Guidelines

### When Working on This Codebase

1. **Read First**: Always read `main.ts` before making changes (it's the only source file)

2. **Understand Context**: This is a CLI tool users interact with directly
   - User experience is paramount
   - Error messages must be clear and actionable
   - Visual feedback (colors, emojis) enhances UX

3. **Test Thoroughly**: Changes affect user workflow
   - Test happy path
   - Test error cases
   - Consider edge cases (no files, no internet, invalid API key)

4. **Preserve Conventions**: Follow existing patterns
   - Git operations use Deno.Command
   - All AI providers follow same interface
   - User prompts use Cliffy consistently

5. **Security Considerations**
   - Never log API keys
   - Config file should have restrictive permissions
   - Don't expose sensitive data in error messages

6. **Performance**
   - AI calls have network latency - provide feedback
   - Git operations are fast - no loading needed
   - File staging on large repos - consider limiting display

### Common Pitfalls to Avoid

1. **Don't Break the AI Flow**
   - User should always be able to fall back to manual mode
   - AI failure should not crash the program

2. **Don't Assume Git State**
   - Always check return values from git commands
   - Handle empty results gracefully

3. **Don't Hardcode Values**
   - Use constants defined at top of file
   - Provider info centralized in PROVIDER_INFO

4. **Don't Skip User Confirmation**
   - Always preview before committing
   - Allow user to cancel at any point

5. **Don't Ignore Permissions**
   - Document required permissions
   - Fail gracefully if permission denied

### Making Changes

When adding features or fixing bugs:

1. **Check Existing Code**: Similar functionality likely exists
2. **Follow Patterns**: Match existing function signatures and error handling
3. **Update Documentation**: README.md, this file, inline comments
4. **Consider Backwards Compatibility**: Config file format, CLI flags
5. **Test with Multiple Providers**: If changing AI logic

### Understanding the User Journey

**New User**:
1. Installs tool
2. Runs `auto-commit`
3. Prompted to select files
4. Prompted to use AI (if configured) or manual mode
5. Sees preview
6. Confirms or cancels

**Configured User**:
1. Makes changes
2. Runs `auto-commit`
3. Selects files (or skips with flag)
4. AI generates message
5. Reviews/edits/regenerates
6. Confirms

**Power User**:
1. Uses flags (`--ai`, `--skip-staging`, `--no-verify`)
2. Skips unnecessary prompts
3. Fast workflow

### Key Files to Reference

When understanding the codebase:
- `README.md` - User-facing documentation
- `CONTRIBUTING.md` - Contribution workflow
- `main.ts` - All application logic
- `deno.json` - Deno configuration and tasks

### Version Constraints

- **Deno**: 2.0+ (uses Deno.Command API)
- **Cliffy**: ^1.0.0-rc.7 (JSR import)
- **TypeScript**: Latest (implicit with Deno)

---

## Additional Resources

### External Documentation

- [Deno Manual](https://deno.land/manual)
- [Cliffy Documentation](https://cliffy.io/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [OpenAI API](https://platform.openai.com/docs/api-reference)
- [Google Gemini API](https://ai.google.dev/docs)
- [Anthropic API](https://docs.anthropic.com/claude/reference)
- [Groq API](https://console.groq.com/docs)

### Repository Links

- **GitHub**: https://github.com/vineyrawat/auto-commit
- **Issues**: https://github.com/vineyrawat/auto-commit/issues
- **Author**: [@vineyrawat](https://github.com/vineyrawat)

---

## Questions or Issues?

If you encounter ambiguities or need clarification:

1. Check this document first
2. Read relevant code sections in `main.ts`
3. Review README.md for user-facing behavior
4. Check existing issues on GitHub
5. When in doubt, ask the user for clarification

---

**Last Updated**: 2025-12-01
**Document Version**: 1.0.0
**Tool Version**: 1.0.0
