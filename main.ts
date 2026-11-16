#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env --allow-net

import { Command } from "jsr:@cliffy/command@^1.0.0-rc.7";
import { Checkbox, Confirm, Input, Secret, Select } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";

const VERSION = "1.4.0";

export const COMMIT_TYPES = [
  { name: "feat", description: "A new feature" },
  { name: "fix", description: "A bug fix" },
  { name: "docs", description: "Documentation only changes" },
  { name: "style", description: "Changes that don't affect code meaning (formatting, etc)" },
  { name: "refactor", description: "Code change that neither fixes a bug nor adds a feature" },
  { name: "perf", description: "Code change that improves performance" },
  { name: "test", description: "Adding missing tests or correcting existing tests" },
  { name: "build", description: "Changes that affect the build system or dependencies" },
  { name: "ci", description: "Changes to CI configuration files and scripts" },
  { name: "chore", description: "Other changes that don't modify src or test files" },
  { name: "revert", description: "Reverts a previous commit" },
];
const COMMIT_TYPE_NAMES = new Set(COMMIT_TYPES.map((t) => t.name));
const COMMIT_TYPE_OPTIONS = COMMIT_TYPES.map((t) => ({
  name: `${t.name.padEnd(10)} - ${t.description}`,
  value: t.name,
}));

/** Conventional-commit description limit enforced on AI output. */
export const MAX_DESCRIPTION_LENGTH = 72;

export type AIProvider = "openai" | "gemini" | "anthropic" | "groq";
const PROVIDERS: readonly AIProvider[] = ["openai", "gemini", "anthropic", "groq"];

function isProvider(value: unknown): value is AIProvider {
  return typeof value === "string" && (PROVIDERS as readonly string[]).includes(value);
}

export interface CommitMessage {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  breakingDescription?: string;
  footers: Array<{ token: string; value: string }>;
}

interface Config {
  provider?: AIProvider;
  openaiApiKey?: string;
  geminiApiKey?: string;
  anthropicApiKey?: string;
  groqApiKey?: string;
  openaiModel?: string;
  geminiModel?: string;
  anthropicModel?: string;
  groqModel?: string;
}

interface ProviderInfo {
  name: string;
  label: string;
  models: Array<{ name: string; value: string }>;
  defaultModel: string;
  apiKeyUrl: string;
  envVar: string;
  keyField: "openaiApiKey" | "geminiApiKey" | "anthropicApiKey" | "groqApiKey";
  modelField: "openaiModel" | "geminiModel" | "anthropicModel" | "groqModel";
  diffCharLimit: number;
}

const CUSTOM_MODEL = "__custom__";
const CUSTOM_MODEL_OPTION = { name: "✏️  Custom model name", value: CUSTOM_MODEL };

// Model lists verified against provider docs on 2026-11-16.
const PROVIDER_INFO: Record<AIProvider, ProviderInfo> = {
  openai: {
    name: "OpenAI",
    label: "OpenAI (GPT-6) - Pay per use",
    models: [
      { name: "gpt-6.1-terra (recommended, fast & affordable)", value: "gpt-6.1-terra" },
      { name: "gpt-6-luna (cheapest, high volume)", value: "gpt-6-luna" },
      { name: "gpt-6.1-sol (balanced, near-flagship)", value: "gpt-6.1-sol" },
      { name: "gpt-6-astra (flagship, most capable)", value: "gpt-6-astra" },
      { name: "gpt-5.5 (previous generation)", value: "gpt-5.5" },
      CUSTOM_MODEL_OPTION,
    ],
    defaultModel: "gpt-6.1-terra",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
    keyField: "openaiApiKey",
    modelField: "openaiModel",
    diffCharLimit: 200_000,
  },
  gemini: {
    name: "Google Gemini",
    label: "Google Gemini - Generous free tier ⭐",
    models: [
      { name: "gemini-3.8-flash (recommended, stable)", value: "gemini-3.8-flash" },
      { name: "gemini-3.5-flash-lite (cheapest, fastest)", value: "gemini-3.5-flash-lite" },
      { name: "gemini-4-hydrogen (newest generation)", value: "gemini-4-hydrogen" },
      { name: "gemini-3.1-pro-preview (top reasoning, preview)", value: "gemini-3.1-pro-preview" },
      { name: "gemini-3.6-flash (stable)", value: "gemini-3.6-flash" },
      CUSTOM_MODEL_OPTION,
    ],
    defaultModel: "gemini-3.8-flash",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
    envVar: "GEMINI_API_KEY",
    keyField: "geminiApiKey",
    modelField: "geminiModel",
    diffCharLimit: 400_000,
  },
  anthropic: {
    name: "Anthropic Claude",
    label: "Anthropic Claude - High quality",
    models: [
      { name: "claude-haiku-5-5 (recommended, fast & cheap)", value: "claude-haiku-5-5" },
      { name: "claude-sonnet-5-5 (best speed/intelligence balance)", value: "claude-sonnet-5-5" },
      { name: "claude-opus-5-5 (most capable for coding)", value: "claude-opus-5-5" },
      { name: "claude-fable-5-2 (deep reasoning)", value: "claude-fable-5-2" },
      { name: "claude-sonnet-4-6 (previous generation)", value: "claude-sonnet-4-6" },
      { name: "claude-opus-4-7 (previous generation)", value: "claude-opus-4-7" },
      CUSTOM_MODEL_OPTION,
    ],
    defaultModel: "claude-haiku-5-5",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    envVar: "ANTHROPIC_API_KEY",
    keyField: "anthropicApiKey",
    modelField: "anthropicModel",
    diffCharLimit: 400_000,
  },
  groq: {
    name: "Groq",
    label: "Groq - Very fast, free tier ⭐",
    models: [
      { name: "openai/gpt-oss-120b (recommended)", value: "openai/gpt-oss-120b" },
      { name: "openai/gpt-oss-20b (fast & cheap)", value: "openai/gpt-oss-20b" },
      { name: "qwen/qwen3.8-27b (preview)", value: "qwen/qwen3.8-27b" },
      CUSTOM_MODEL_OPTION,
    ],
    defaultModel: "openai/gpt-oss-120b",
    apiKeyUrl: "https://console.groq.com/keys",
    envVar: "GROQ_API_KEY",
    keyField: "groqApiKey",
    modelField: "groqModel",
    diffCharLimit: 60_000,
  },
};

/** Model IDs from older versions of this tool that are retired, deprecated, or never existed. */
const DEPRECATED_MODELS: Record<string, { status: string; replacement: string }> = {
  // OpenAI
  "gpt-5.5-instant": { status: "is not a valid API model ID", replacement: "gpt-6.1-terra" },
  "gpt-5.5-pro": { status: "is not available on Chat Completions", replacement: "gpt-6-astra" },
  "o4-mini": { status: "was shut down on Oct 23, 2026", replacement: "gpt-6.1-terra" },
  "gpt-5": { status: "shuts down on Dec 11, 2026", replacement: "gpt-6.1-sol" },
  "gpt-5-mini": { status: "shuts down on Dec 11, 2026", replacement: "gpt-6.1-terra" },
  "gpt-5-nano": { status: "shuts down on Dec 11, 2026", replacement: "gpt-6-luna" },
  "o3": { status: "shuts down on Dec 11, 2026", replacement: "gpt-6.1-sol" },
  "gpt-4.1": { status: "shuts down on Jan 14, 2027", replacement: "gpt-6-luna" },
  // Gemini
  "gemini-3-pro-preview": { status: "was shut down on Mar 9, 2026", replacement: "gemini-3.1-pro-preview" },
  "gemini-3-flash": { status: "is not a valid model ID", replacement: "gemini-3.8-flash" },
  "gemini-3-flash-lite": { status: "is not a valid model ID", replacement: "gemini-3.5-flash-lite" },
  "gemini-2.5-pro": { status: "shuts down on Dec 1, 2026", replacement: "gemini-3.8-flash" },
  "gemini-2.5-flash": { status: "shuts down on Dec 1, 2026", replacement: "gemini-3.8-flash" },
  // Anthropic
  "claude-opus-4-1-20250805": { status: "was retired on Aug 5, 2026", replacement: "claude-opus-5-5" },
  "claude-sonnet-4-5-20250929": { status: "retires on Nov 30, 2026", replacement: "claude-sonnet-5-5" },
  // Groq
  "moonshotai/kimi-k2-instruct": { status: "has been decommissioned", replacement: "openai/gpt-oss-120b" },
  "deepseek-r1-distill-llama-70b": { status: "has been decommissioned", replacement: "openai/gpt-oss-120b" },
  "meta-llama/llama-4-scout-17b-16e-instruct": { status: "has been decommissioned", replacement: "openai/gpt-oss-120b" },
  "meta-llama/llama-4-maverick-17b-128e-instruct": { status: "has been decommissioned", replacement: "openai/gpt-oss-120b" },
  "qwen/qwen3-32b": { status: "has been decommissioned", replacement: "qwen/qwen3.8-27b" },
  "llama-3.3-70b-versatile": { status: "is Enterprise-only since Aug 16, 2026", replacement: "openai/gpt-oss-120b" },
  "llama-3.1-8b-instant": { status: "is Enterprise-only since Aug 16, 2026", replacement: "openai/gpt-oss-20b" },
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

function configDir(): string {
  const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE") ?? ".";
  return `${home}/.config/auto-commit`;
}

function configFile(): string {
  return `${configDir()}/config.json`;
}

async function loadConfig(): Promise<Config> {
  let data: string;
  try {
    data = await Deno.readTextFile(configFile());
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      console.error(colors.yellow(`⚠ Could not read config at ${configFile()}: ${errorMessage(error)}`));
    }
    return {};
  }
  try {
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    console.error(colors.yellow(`⚠ Config at ${configFile()} is not valid JSON and was ignored.`));
    return {};
  }
}

async function saveConfig(config: Config): Promise<boolean> {
  try {
    await Deno.mkdir(configDir(), { recursive: true, mode: 0o700 });
    await Deno.writeTextFile(configFile(), JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
    // `mode` only applies when the file is created; tighten existing files too.
    if (Deno.build.os !== "windows") await Deno.chmod(configFile(), 0o600);
    return true;
  } catch (error) {
    console.error(colors.red(`Failed to save config: ${errorMessage(error)}`));
    return false;
  }
}

function getProvider(config: Config): AIProvider {
  return isProvider(config.provider) ? config.provider : "openai";
}

/** API key from the config file, falling back to the provider's env var. */
function getApiKey(config: Config, provider: AIProvider): { key?: string; source?: string } {
  const info = PROVIDER_INFO[provider];
  const fromConfig = config[info.keyField];
  if (fromConfig) return { key: fromConfig, source: "config file" };
  const fromEnv = Deno.env.get(info.envVar);
  if (fromEnv) return { key: fromEnv, source: `$${info.envVar}` };
  return {};
}

function getModel(config: Config, provider: AIProvider): string {
  return config[PROVIDER_INFO[provider].modelField] || PROVIDER_INFO[provider].defaultModel;
}

function warnIfDeprecated(model: string): void {
  const info = DEPRECATED_MODELS[model];
  if (!info) return;
  console.log(colors.yellow(`⚠ Model "${model}" ${info.status}. Suggested replacement: ${info.replacement}`));
  console.log(colors.dim(`  Change it with: auto-commit config → Set AI Model\n`));
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

/** Repo root; git commands run here so paths from all commands agree. */
let gitCwd: string | undefined;

async function runGit(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const { success, stdout, stderr } = await new Deno.Command("git", {
      args,
      cwd: gitCwd,
      stdout: "piped",
      stderr: "piped",
    }).output();
    const decoder = new TextDecoder();
    return { ok: success, stdout: decoder.decode(stdout), stderr: decoder.decode(stderr) };
  } catch (error) {
    return { ok: false, stdout: "", stderr: errorMessage(error) };
  }
}

async function gitText(args: string[]): Promise<string> {
  const result = await runGit(args);
  return result.ok ? result.stdout : "";
}

/** Runs a git command that emits NUL-separated paths (`-z`). */
async function gitPaths(args: string[]): Promise<string[]> {
  return (await gitText(args)).split("\0").filter(Boolean);
}

// Ignore user diff config (color.ui=always, external diff tools) that would corrupt the prompt.
const DIFF_FLAGS = ["--no-color", "--no-ext-diff"];

const getDiff = () => gitText(["diff", "--cached", ...DIFF_FLAGS]);
const getDiffStat = () => gitText(["diff", "--cached", ...DIFF_FLAGS, "--stat"]);
const getDiffNameStatus = () => gitText(["diff", "--cached", ...DIFF_FLAGS, "--name-status"]);
const getStagedFiles = () => gitPaths(["diff", "--cached", "--name-only", "-z"]);
const getModifiedFiles = () => gitPaths(["diff", "--name-only", "-z"]);
const getUntrackedFiles = () => gitPaths(["ls-files", "--others", "--exclude-standard", "-z"]);

async function stageFiles(files: string[]): Promise<boolean> {
  if (files.length === 0) return true;
  const result = await runGit(["add", "--", ...files]);
  if (!result.ok) console.error(colors.dim(result.stderr.trim()));
  return result.ok;
}

async function unstageFiles(files: string[]): Promise<boolean> {
  if (files.length === 0) return true;
  // `git reset HEAD` fails before the first commit; fall back to `git rm --cached`.
  const hasHead = (await runGit(["rev-parse", "--verify", "--quiet", "HEAD"])).ok;
  const args = hasHead
    ? ["reset", "--quiet", "HEAD", "--", ...files]
    : ["rm", "--cached", "--quiet", "-r", "--", ...files];
  const result = await runGit(args);
  if (!result.ok) console.error(colors.dim(result.stderr.trim()));
  return result.ok;
}

async function createCommit(message: string, noVerify: boolean): Promise<boolean> {
  const args = ["commit", "-m", message];
  if (noVerify) args.push("--no-verify");
  const { success } = await new Deno.Command("git", {
    args,
    cwd: gitCwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  return success;
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  "You are a helpful assistant that generates conventional commit messages. Always respond with valid JSON only.";

/** Lockfiles and generated artifacts: listed in the prompt, but their diff bodies are noise. */
const NOISE_FILE_RE =
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|deno\.lock|Cargo\.lock|poetry\.lock|uv\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum|flake\.lock)$|\.min\.(js|css)$|\.map$/;

function splitDiff(diff: string): string[] {
  return diff.split(/^(?=diff --git )/m).filter((chunk) => chunk.trim());
}

function chunkPath(chunk: string): string | undefined {
  return chunk.match(/^diff --git "?a\/(.+?)"? "?b\//)?.[1];
}

function collapseNoise(chunk: string): string {
  const path = chunkPath(chunk);
  if (!path || !NOISE_FILE_RE.test(path)) return chunk;
  const header = chunk.split("\n", 1)[0];
  return `${header}\n[diff omitted: lockfile or generated file]\n`;
}

/** Fit chunks into `limit` chars: small chunks stay whole, the rest share what's left. */
function fitChunks(chunks: string[], limit: number): string[] {
  const order = chunks.map((chunk, i) => ({ i, len: chunk.length })).sort((a, b) => a.len - b.len);
  const budgets: number[] = new Array(chunks.length);
  let remaining = limit;
  let left = chunks.length;
  for (const { i, len } of order) {
    const budget = Math.min(len, Math.floor(remaining / left));
    budgets[i] = budget;
    remaining -= budget;
    left--;
  }
  return chunks.map((chunk, i) =>
    chunk.length <= budgets[i]
      ? chunk
      : chunk.slice(0, budgets[i]) + `\n... [truncated ${chunk.length - budgets[i]} chars]\n`
  );
}

export function buildDiffContext(diff: string, fileList: string, diffStat: string, charLimit: number): string {
  const chunks = splitDiff(diff).map(collapseNoise);
  const filtered = chunks.join("");
  const fits = filtered.length <= charLimit;
  const body = fits ? filtered : fitChunks(chunks, charLimit).join("");

  return `Files changed (name-status):
${fileList.trim() || "(none)"}

Diff stat:
${diffStat.trim() || "(none)"}

${fits ? "Full diff:" : "Diff (per-file truncated to fit context — every file represented):"}
\`\`\`
${body}
\`\`\``;
}

function getPrompt(diff: string, fileList: string, diffStat: string, charLimit: number): string {
  const context = buildDiffContext(diff, fileList, diffStat, charLimit);
  return `You are a commit message generator. Based on the following git changes, generate a conventional commit message.

The "Files changed" list is authoritative — your message MUST reflect ALL files in that list, not only the ones whose diff body appears below. If many files change, summarize the dominant theme across all of them.

Provide a JSON response with this exact structure (respond with ONLY valid JSON, no markdown, no explanation):

{
  "type": "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert",
  "scope": "optional scope or null",
  "description": "short description (max ${MAX_DESCRIPTION_LENGTH} chars)",
  "body": "optional detailed body or null",
  "breaking": true|false,
  "breakingDescription": "description if breaking is true, otherwise null"
}

Rules:
- Choose the most appropriate type based on the changes
- Keep description concise and in imperative mood, without the "type(scope):" prefix and without a trailing period
- Use scope only if changes are focused on a specific area
- Add body only if changes need additional context (recommended when 5+ files changed)
- Set breaking to true only for breaking changes

${context}

Respond with valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text.`;
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------

export function truncateDescription(description: string, max = MAX_DESCRIPTION_LENGTH): string {
  if (description.length <= max) return description;
  const cut = description.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max / 2 ? cut.slice(0, lastSpace) : description.slice(0, max)).trimEnd();
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== "null" ? trimmed : undefined;
}

export function parseAIResponse(content: string): CommitMessage | null {
  // Tolerate code fences or prose around the JSON object.
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  let raw: Record<string, unknown>;
  try {
    if (start === -1 || end <= start) throw new Error("no JSON object found");
    raw = JSON.parse(content.slice(start, end + 1));
  } catch (error) {
    console.error(colors.red(`Failed to parse AI response: ${errorMessage(error)}`));
    console.error(colors.dim(`Response content: ${content.substring(0, 200)}...`));
    return null;
  }

  let description = optionalString(raw.description);
  if (!description) {
    console.error(colors.red("AI response is missing a description."));
    return null;
  }

  let type = optionalString(raw.type)?.toLowerCase();
  if (!type || !COMMIT_TYPE_NAMES.has(type)) {
    console.error(colors.yellow(`⚠ AI returned unknown commit type "${raw.type}"; using "chore".`));
    type = "chore";
  }

  // Models sometimes repeat the header prefix inside the description.
  description = description
    .replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");

  const breaking = raw.breaking === true || raw.breaking === "true";
  return {
    type,
    scope: optionalString(raw.scope),
    description: truncateDescription(description),
    body: optionalString(raw.body),
    breaking,
    breakingDescription: breaking ? optionalString(raw.breakingDescription) : undefined,
    footers: [],
  };
}

export function formatCommitMessage(commit: CommitMessage): string {
  let message = commit.type;
  if (commit.scope) message += `(${commit.scope})`;
  if (commit.breaking) message += "!";
  message += `: ${commit.description}`;
  if (commit.body) message += `\n\n${commit.body}`;
  if (commit.breaking && commit.breakingDescription) {
    message += `\n\nBREAKING CHANGE: ${commit.breakingDescription}`;
  }
  if (commit.footers.length > 0) {
    message += "\n";
    for (const footer of commit.footers) message += `\n${footer.token}: ${footer.value}`;
  }
  return message;
}

// ---------------------------------------------------------------------------
// AI providers
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
/** Generous cap: reasoning/thinking tokens count against it on modern models. */
const REASONING_MAX_TOKENS = 8000;
const PLAIN_MAX_TOKENS = 1000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logError(message: string): void {
  // Clear any spinner frame on the current line first.
  const prefix = Deno.stdout.isTerminal() ? "\r\x1b[2K" : "";
  console.error(prefix + colors.red(message));
}

function extractApiError(text: string): string {
  try {
    const parsed = JSON.parse(text);
    const message = parsed?.error?.message ?? parsed?.message;
    if (typeof message === "string") return message;
  } catch {
    // not JSON
  }
  return text.slice(0, 300);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** POST JSON with timeout and retries on 429/5xx/network errors. Returns parsed body or null. */
async function postJSON<T>(
  providerName: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<T | null> {
  for (let attempt = 0;; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      if (!timedOut && attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      logError(
        `${providerName} request failed: ${
          timedOut ? `timed out after ${REQUEST_TIMEOUT_MS / 1000}s` : errorMessage(error)
        }`,
      );
      return null;
    }

    if (response.ok) return await response.json() as T;

    const text = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? Math.min(retryAfter * 1000, 20_000) : 1000 * 2 ** attempt);
      continue;
    }

    logError(`${providerName} API error ${response.status}: ${extractApiError(text)}`);
    if (response.status === 401 || response.status === 403) {
      console.error(colors.dim("  Check your API key: auto-commit config → Set API Key"));
    } else if (response.status === 404 || /model/i.test(text)) {
      console.error(colors.dim("  Check the model name: auto-commit config → Set AI Model"));
    }
    return null;
  }
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }>;
}

function readChatCompletion(providerName: string, data: ChatCompletionResponse | null): string | null {
  if (!data) return null;
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  if (content) return content;
  if (choice?.message?.refusal) {
    logError(`${providerName} refused: ${choice.message.refusal}`);
  } else {
    logError(
      `${providerName} returned empty content (finish_reason=${choice?.finish_reason}). ` +
        `If this is "length", the model spent its token budget on reasoning; try a smaller model.`,
    );
  }
  return null;
}

// GPT-5+, GPT-6 and o-series are reasoning models: they reject custom temperature.
const OPENAI_REASONING_RE = /^(gpt-5|gpt-6|o\d)/i;

async function generateWithOpenAI(prompt: string, apiKey: string, model: string): Promise<string | null> {
  const reasoning = OPENAI_REASONING_RE.test(model);
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: reasoning ? REASONING_MAX_TOKENS : PLAIN_MAX_TOKENS,
  };
  if (reasoning) body.reasoning_effort = "low";
  else body.temperature = 0.7;

  const data = await postJSON<ChatCompletionResponse>(
    "OpenAI",
    "https://api.openai.com/v1/chat/completions",
    { Authorization: `Bearer ${apiKey}` },
    body,
  );
  return readChatCompletion("OpenAI", data);
}

async function generateWithGroq(prompt: string, apiKey: string, model: string): Promise<string | null> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
    max_completion_tokens: REASONING_MAX_TOKENS,
  };
  if (/^openai\/gpt-oss/i.test(model)) {
    body.reasoning_effort = "low";
    body.include_reasoning = false;
  } else if (/qwen3/i.test(model)) {
    // "raw" reasoning (the default) is rejected together with JSON mode.
    body.reasoning_format = "hidden";
  }

  const data = await postJSON<ChatCompletionResponse>(
    "Groq",
    "https://api.groq.com/openai/v1/chat/completions",
    { Authorization: `Bearer ${apiKey}` },
    body,
  );
  return readChatCompletion("Groq", data);
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

async function generateWithGemini(prompt: string, apiKey: string, model: string): Promise<string | null> {
  const modelId = model.replace(/^models\//, "");
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: REASONING_MAX_TOKENS,
    responseMimeType: "application/json",
  };
  // Gemini 3+/4 think by default and thinking tokens count against maxOutputTokens.
  if (/^gemini-[34]/.test(modelId)) generationConfig.thinkingConfig = { thinkingLevel: "low" };

  const data = await postJSON<GeminiResponse>(
    "Gemini",
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
    // Header instead of ?key= so the key never lands in URLs or proxy logs.
    { "x-goog-api-key": apiKey },
    {
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
    },
  );
  if (!data) return null;

  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  if (text) return text;

  const reason = data.promptFeedback?.blockReason
    ? `blocked: ${data.promptFeedback.blockReason}`
    : `finishReason=${candidate?.finishReason}`;
  logError(`Gemini returned no text (${reason}).`);
  return null;
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
}

async function generateWithAnthropic(prompt: string, apiKey: string, model: string): Promise<string | null> {
  // No temperature: Claude 4.7+ rejects non-default sampling parameters.
  const data = await postJSON<AnthropicResponse>(
    "Anthropic",
    "https://api.anthropic.com/v1/messages",
    { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    {
      model,
      max_tokens: REASONING_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    },
  );
  if (!data) return null;

  // Newer models may emit thinking blocks before the text block.
  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && block.text)
    .map((block) => block.text)
    .join("");
  if (text) return text;

  logError(`Anthropic returned no text (stop_reason=${data.stop_reason}).`);
  return null;
}

const GENERATORS: Record<AIProvider, (prompt: string, apiKey: string, model: string) => Promise<string | null>> = {
  openai: generateWithOpenAI,
  gemini: generateWithGemini,
  anthropic: generateWithAnthropic,
  groq: generateWithGroq,
};

function startSpinner(label: string): () => void {
  if (!Deno.stdout.isTerminal()) {
    console.log(label);
    return () => {};
  }
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let i = 0;
  const encoder = new TextEncoder();
  const writeRaw = (s: string) => Deno.stdout.writeSync(encoder.encode(s));
  writeRaw("\x1b[?25l"); // hide cursor
  const id = setInterval(() => {
    writeRaw(`\r${colors.cyan(frames[i = (i + 1) % frames.length])} ${label}`);
  }, 80);
  return () => {
    clearInterval(id);
    writeRaw(`\r\x1b[2K`); // clear line
    writeRaw("\x1b[?25h"); // restore cursor
  };
}

async function generateCommitWithAI(
  diff: string,
  fileList: string,
  diffStat: string,
  config: Config,
): Promise<CommitMessage | null> {
  const provider = getProvider(config);
  const info = PROVIDER_INFO[provider];
  const { key } = getApiKey(config, provider);
  if (!key) return null;
  const model = getModel(config, provider);

  const fileCount = fileList.split("\n").filter(Boolean).length;
  const stop = startSpinner(
    `Generating commit message with ${info.name} (${model})${
      fileCount ? `, ${fileCount} file${fileCount === 1 ? "" : "s"}` : ""
    }...`,
  );
  let content: string | null;
  try {
    content = await GENERATORS[provider](getPrompt(diff, fileList, diffStat, info.diffCharLimit), key, model);
  } finally {
    stop();
  }
  return content ? parseAIResponse(content) : null;
}

// ---------------------------------------------------------------------------
// Interactive flows
// ---------------------------------------------------------------------------

function printMessage(title: string, message: string): void {
  console.log(colors.bold.cyan(`\n${title}\n`));
  console.log(colors.dim("─".repeat(60)));
  console.log(message);
  console.log(colors.dim("─".repeat(60) + "\n"));
}

async function editCommit(commit: CommitMessage): Promise<void> {
  while (true) {
    const field = await Select.prompt({
      message: "What would you like to edit?",
      options: [
        { name: "✓ Done editing", value: "done" },
        { name: "Description", value: "description" },
        { name: "Type", value: "type" },
        { name: "Scope", value: "scope" },
        { name: "Body", value: "body" },
        { name: "Breaking change", value: "breaking" },
      ],
    });

    if (field === "done") return;
    if (field === "description") {
      commit.description = await Input.prompt({
        message: "Edit description",
        default: commit.description,
        minLength: 1,
      });
    } else if (field === "type") {
      commit.type = await Select.prompt({
        message: "Select type",
        options: COMMIT_TYPE_OPTIONS,
        default: commit.type,
      });
    } else if (field === "scope") {
      const scope = await Input.prompt({
        message: "Edit scope (leave empty to remove)",
        default: commit.scope || "",
      });
      commit.scope = scope.trim() || undefined;
    } else if (field === "body") {
      const body = await Input.prompt({
        message: "Edit body (use \\n for new lines, leave empty to remove)",
        default: (commit.body || "").replace(/\n/g, "\\n"),
      });
      commit.body = body ? body.replace(/\\n/g, "\n") : undefined;
    } else if (field === "breaking") {
      commit.breaking = await Confirm.prompt({
        message: "Is this a breaking change?",
        default: commit.breaking,
      });
      if (commit.breaking) {
        const description = await Input.prompt({
          message: "Describe the breaking change (leave empty for '!' only)",
          default: commit.breakingDescription || "",
        });
        commit.breakingDescription = description.replace(/\\n/g, "\n") || undefined;
      } else {
        commit.breakingDescription = undefined;
      }
    }
  }
}

/** Generate, preview, and let the user accept/edit/regenerate. Returns null to fall back to manual mode. */
async function runAIFlow(config: Config): Promise<CommitMessage | null> {
  const diff = await getDiff();
  if (!diff.trim()) {
    console.log(colors.yellow("\n⚠ No diff found for AI generation. Using manual mode.\n"));
    return null;
  }
  const [fileList, diffStat] = await Promise.all([getDiffNameStatus(), getDiffStat()]);
  const providerName = PROVIDER_INFO[getProvider(config)].name;

  let commit = await generateCommitWithAI(diff, fileList, diffStat, config);
  while (commit) {
    printMessage(`🤖 AI Generated Commit Message (${providerName}):`, formatCommitMessage(commit));

    const choice = await Select.prompt({
      message: "What would you like to do?",
      options: [
        { name: "✓ Use this commit message", value: "use" },
        { name: "✏️  Edit the commit message", value: "edit" },
        { name: "🔄 Regenerate with AI", value: "regenerate" },
        { name: "✍️  Create manually", value: "manual" },
      ],
    });

    if (choice === "use") return commit;
    if (choice === "manual") return null;
    if (choice === "edit") {
      await editCommit(commit);
      continue;
    }
    const regenerated = await generateCommitWithAI(diff, fileList, diffStat, config);
    if (regenerated) commit = regenerated;
    else console.log(colors.yellow("\n⚠ Regeneration failed; keeping the previous message."));
  }

  console.log(colors.dim("Falling back to manual mode...\n"));
  return null;
}

const COMMON_SCOPES = [
  { name: "None (skip scope)", value: "" },
  { name: "api - API related changes", value: "api" },
  { name: "auth - Authentication/Authorization", value: "auth" },
  { name: "ui - User interface changes", value: "ui" },
  { name: "db - Database changes", value: "db" },
  { name: "config - Configuration changes", value: "config" },
  { name: "deps - Dependencies update", value: "deps" },
  { name: "core - Core functionality", value: "core" },
  { name: "utils - Utility functions", value: "utils" },
  { name: "test - Test related", value: "test" },
  { name: "docs - Documentation", value: "docs" },
  { name: "build - Build system", value: "build" },
  { name: "ci - CI/CD related", value: "ci" },
  { name: "perf - Performance improvements", value: "perf" },
  { name: "security - Security improvements", value: "security" },
  { name: "✏️  Custom (enter your own)", value: "__custom__" },
];

async function promptManualCommit(): Promise<CommitMessage> {
  console.log(colors.bold.blue("📝 Commit Message\n"));

  const type = await Select.prompt({
    message: "Select the type of change",
    options: COMMIT_TYPE_OPTIONS,
  });

  const scopeSelection = await Select.prompt({
    message: "Select a scope (optional)",
    options: COMMON_SCOPES,
  });
  const scope = scopeSelection === "__custom__"
    ? await Input.prompt({ message: "Enter custom scope", hint: "e.g., parser, router, middleware" })
    : scopeSelection;

  const description = await Input.prompt({
    message: "Enter a short description",
    minLength: 1,
    hint: "Brief summary of the change",
  });

  let body: string | undefined;
  if (await Confirm.prompt({ message: "Add a detailed body?", default: false })) {
    const bodyInput = await Input.prompt({
      message: "Enter the commit body (use \\n for new lines)",
      hint: "Provide additional context about the change",
    });
    body = bodyInput.replace(/\\n/g, "\n") || undefined;
    if (body) {
      console.log(colors.green("\n✓ Body captured\n"));
      console.log(colors.dim("Preview:"));
      console.log(colors.dim(body.split("\n").map((l) => `  ${l}`).join("\n") + "\n"));
    }
  }

  const breaking = await Confirm.prompt({ message: "Is this a BREAKING CHANGE?", default: false });
  let breakingDescription: string | undefined;
  if (breaking) {
    const breakingInput = await Input.prompt({
      message: "Describe the breaking change (use \\n for new lines)",
      minLength: 1,
    });
    breakingDescription = breakingInput.replace(/\\n/g, "\n");
  }

  const footers: Array<{ token: string; value: string }> = [];
  if (await Confirm.prompt({ message: "Add footers (e.g., Refs, Reviewed-by)?", default: false })) {
    do {
      const token = await Input.prompt({
        message: "Enter footer token",
        hint: "e.g., Refs, Reviewed-by, Closes",
        minLength: 1,
      });
      const value = await Input.prompt({
        message: `Enter value for ${token}`,
        hint: "e.g., #123, Jane Doe",
        minLength: 1,
      });
      footers.push({ token, value });
    } while (await Confirm.prompt({ message: "Add another footer?", default: false }));
  }

  return {
    type,
    scope: scope.trim() || undefined,
    description,
    body,
    breaking,
    breakingDescription,
    footers,
  };
}

async function runConfig(): Promise<void> {
  console.log(colors.bold.blue("\n⚙️  Configuration\n"));
  const config = await loadConfig();
  const provider = getProvider(config);
  const info = PROVIDER_INFO[provider];

  const action = await Select.prompt({
    message: "What would you like to configure?",
    options: [
      { name: "Select AI Provider", value: "provider" },
      { name: "Set API Key", value: "api-key" },
      { name: "Set AI Model", value: "model" },
      { name: "View Current Config", value: "view" },
      { name: "Clear Config", value: "clear" },
    ],
  });

  if (action === "provider") {
    const selected = await Select.prompt({
      message: "Select AI provider",
      options: PROVIDERS.map((p) => ({ name: PROVIDER_INFO[p].label, value: p })),
      default: provider,
    });
    if (!isProvider(selected)) return;
    config.provider = selected;
    if (await saveConfig(config)) {
      console.log(colors.green(`\n✓ Provider set to ${PROVIDER_INFO[selected].name}\n`));
      console.log(colors.dim(`Get your API key at: ${PROVIDER_INFO[selected].apiKeyUrl}`));
      console.log(colors.dim(`Or set the ${PROVIDER_INFO[selected].envVar} environment variable.\n`));
    }
  } else if (action === "api-key") {
    console.log(colors.cyan(`\n${info.name} API Key Setup`));
    console.log(colors.dim(`Get your key at: ${info.apiKeyUrl}\n`));
    const apiKey = await Secret.prompt({
      message: `Enter your ${info.name} API key`,
      hint: `Stored locally in ${configFile()} (or use $${info.envVar} instead)`,
      minLength: 1,
    });
    config[info.keyField] = apiKey.trim();
    if (await saveConfig(config)) console.log(colors.green("\n✓ API key saved successfully!\n"));
  } else if (action === "model") {
    const current = getModel(config, provider);
    const inList = info.models.some((m) => m.value === current);
    let model = await Select.prompt({
      message: `Select ${info.name} model`,
      options: info.models,
      default: inList ? current : undefined,
    });
    if (model === CUSTOM_MODEL) {
      model = (await Input.prompt({
        message: `Enter custom ${info.name} model name`,
        hint: `e.g., ${info.defaultModel}`,
        minLength: 1,
      })).trim();
    }
    config[info.modelField] = model;
    if (await saveConfig(config)) {
      console.log(colors.green(`\n✓ Model set to ${model}\n`));
      warnIfDeprecated(model);
    }
  } else if (action === "view") {
    const { source } = getApiKey(config, provider);
    const model = getModel(config, provider);
    console.log(colors.cyan("\nCurrent Configuration:"));
    console.log(colors.dim("─".repeat(60)));
    console.log(`Provider: ${colors.bold(info.name)}`);
    console.log(`API Key:  ${source ? colors.green(`✓ Set via ${source} (hidden)`) : colors.red("✗ Not set")}`);
    console.log(`Model:    ${model}${config[info.modelField] ? "" : colors.dim(" (default)")}`);
    console.log(`File:     ${colors.dim(configFile())}`);
    console.log(colors.dim("─".repeat(60)));
    warnIfDeprecated(model);
    if (!source) {
      console.log(colors.yellow(`\n⚠ Get your API key at: ${info.apiKeyUrl} or set $${info.envVar}`));
    }
    console.log();
  } else if (action === "clear") {
    const confirmed = await Confirm.prompt({
      message: "Are you sure you want to clear all configuration?",
      default: false,
    });
    if (confirmed && await saveConfig({})) console.log(colors.green("\n✓ Configuration cleared\n"));
  }
}

interface CommitOptions {
  verify: boolean;
  dryRun?: boolean;
  skipStaging?: boolean;
  ai?: boolean;
}

async function runCommit(options: CommitOptions): Promise<void> {
  console.log(colors.bold.blue("\n🚀 Conventional Commit Message Generator\n"));

  const root = await runGit(["rev-parse", "--show-toplevel"]);
  if (!root.ok) {
    console.error(colors.red("✗ Not inside a git repository.\n"));
    Deno.exit(1);
  }
  gitCwd = root.stdout.trim();

  const [stagedFiles, modifiedFiles, untrackedFiles] = await Promise.all([
    getStagedFiles(),
    getModifiedFiles(),
    getUntrackedFiles(),
  ]);
  const allChangedFiles = [...new Set([...stagedFiles, ...modifiedFiles, ...untrackedFiles])];

  if (allChangedFiles.length === 0) {
    console.log(colors.yellow("⚠ No changes detected in the repository.\n"));
    Deno.exit(1);
  }

  let finalStagedFiles = stagedFiles;

  if (!options.skipStaging) {
    console.log(colors.bold("📂 File Staging\n"));

    const fileOptions = allChangedFiles.map((file) => {
      const isStaged = stagedFiles.includes(file);
      let label = file;
      if (isStaged) label += colors.green(" (staged)");
      else if (untrackedFiles.includes(file)) label += colors.yellow(" (untracked)");
      else label += colors.red(" (modified)");
      return { name: label, value: file, checked: isStaged };
    });

    const selectedFiles = await Checkbox.prompt({
      message: "Select files to stage for commit",
      options: fileOptions,
      hint: "Use space to select/deselect, enter to confirm",
    });

    if (selectedFiles.length === 0) {
      console.log(colors.yellow("\n⚠ No files selected for commit.\n"));
      Deno.exit(1);
    }

    // Already-staged files are left alone so hunks staged with `git add -p` survive.
    const filesToStage = selectedFiles.filter((f) => !stagedFiles.includes(f));
    const filesToUnstage = stagedFiles.filter((f) => !selectedFiles.includes(f));

    if (!await stageFiles(filesToStage)) {
      console.error(colors.red("\n✗ Failed to stage some files"));
      Deno.exit(1);
    }
    if (!await unstageFiles(filesToUnstage)) {
      console.error(colors.red("\n✗ Failed to unstage some files"));
      Deno.exit(1);
    }

    finalStagedFiles = selectedFiles;
    console.log(colors.green(`\n✓ ${finalStagedFiles.length} file(s) staged for commit\n`));
  } else if (stagedFiles.length === 0) {
    console.log(colors.yellow("⚠ No staged files found. Run without -s, or stage files with 'git add' first.\n"));
    Deno.exit(1);
  }

  console.log(colors.dim(`Staged files (${finalStagedFiles.length}):`));
  finalStagedFiles.slice(0, 5).forEach((f) => console.log(colors.dim(`  • ${f}`)));
  if (finalStagedFiles.length > 5) {
    console.log(colors.dim(`  ... and ${finalStagedFiles.length - 5} more`));
  }
  console.log();

  const config = await loadConfig();
  const provider = getProvider(config);
  const providerName = PROVIDER_INFO[provider].name;
  const { key } = getApiKey(config, provider);

  let useAI = options.ai ?? false;
  if (!useAI && key) {
    useAI = await Confirm.prompt({
      message: `Generate commit message with AI (${providerName})?`,
      default: false,
    });
  }

  let commit: CommitMessage | null = null;
  if (useAI) {
    if (!key) {
      console.log(
        colors.yellow(
          `\n⚠ ${providerName} API key not configured. Run 'auto-commit config' or set $${
            PROVIDER_INFO[provider].envVar
          }.\n`,
        ),
      );
      console.log(colors.dim("Falling back to manual mode...\n"));
    } else {
      warnIfDeprecated(getModel(config, provider));
      commit = await runAIFlow(config);
    }
  }
  commit ??= await promptManualCommit();

  const message = formatCommitMessage(commit);
  printMessage("📝 Final commit message:", message);

  if (options.dryRun) {
    console.log(colors.yellow("Dry run mode - commit not created\n"));
    return;
  }

  if (!await Confirm.prompt({ message: "Create this commit?", default: true })) {
    console.log(colors.yellow("\n✗ Commit cancelled\n"));
    return;
  }

  if (await createCommit(message, !options.verify)) {
    console.log(colors.green("\n✓ Commit successful!"));
  } else {
    console.error(colors.red("\n✗ Commit failed!"));
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await new Command()
    .name("auto-commit")
    .version(VERSION)
    .description("Generate conventional commit messages interactively")
    .option("-n, --no-verify", "Bypass git hooks")
    .option("-d, --dry-run", "Show the commit message without committing")
    .option("-s, --skip-staging", "Skip file staging selection")
    .option("-a, --ai", "Use AI to generate commit message")
    .action((options) => runCommit(options))
    .command("config", "Configure AI provider and API settings")
    .action(() => runConfig())
    .reset()
    .parse(Deno.args);
}
