#!/usr/bin/env -S deno run --allow-run --allow-read --allow-write --allow-env --allow-net

import { Command } from "jsr:@cliffy/command@^1.0.0-rc.7";
import { Input, Select, Confirm, Checkbox } from "jsr:@cliffy/prompt@^1.0.0-rc.7";
import { colors } from "jsr:@cliffy/ansi@^1.0.0-rc.7/colors";

const COMMIT_TYPES = [
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

type AIProvider = "openai" | "gemini" | "anthropic" | "groq";

interface CommitMessage {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  breakingDescription?: string;
  footers: Array<{ token: string; value: string }>;
}

const CONFIG_DIR = `${Deno.env.get("HOME")}/.config/auto-commit`;
const CONFIG_FILE = `${CONFIG_DIR}/config.json`;

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

const PROVIDER_INFO = {
  openai: {
    name: "OpenAI",
    models: [
      { name: "gpt-4o (recommended)", value: "gpt-4o" },
      { name: "gpt-4o-mini (fast & cheap)", value: "gpt-4o-mini" },
      { name: "gpt-4-turbo", value: "gpt-4-turbo" },
      { name: "gpt-3.5-turbo", value: "gpt-3.5-turbo" },
      { name: "✏️  Custom model name", value: "__custom__" },
    ],
    defaultModel: "gpt-4o-mini",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  gemini: {
    name: "Google Gemini",
    models: [
      { name: "gemini-2.5-flash (recommended, stable)", value: "gemini-2.5-flash" },
      { name: "gemini-2.5-pro (most intelligent)", value: "gemini-2.5-pro" },
      { name: "gemini-3-flash-preview (latest, preview)", value: "gemini-3-flash-preview" },
      { name: "gemini-3-pro-preview (advanced reasoning)", value: "gemini-3-pro-preview" },
      { name: "gemini-2.0-flash-exp (experimental)", value: "gemini-2.0-flash-exp" },
      { name: "✏️  Custom model name", value: "__custom__" },
    ],
    defaultModel: "gemini-2.5-flash",
    apiKeyUrl: "https://aistudio.google.com/app/apikey",
  },
  anthropic: {
    name: "Anthropic Claude",
    models: [
      { name: "claude-3-5-sonnet (recommended)", value: "claude-3-5-sonnet-20241022" },
      { name: "claude-3-opus", value: "claude-3-opus-20240229" },
      { name: "claude-3-haiku (fast & cheap)", value: "claude-3-haiku-20240307" },
      { name: "claude-3-sonnet", value: "claude-3-sonnet-20240229" },
      { name: "✏️  Custom model name", value: "__custom__" },
    ],
    defaultModel: "claude-3-5-sonnet-20241022",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  groq: {
    name: "Groq",
    models: [
      { name: "openai/gpt-oss-120b (recommended)", value: "openai/gpt-oss-120b" },
      { name: "llama-3.3-70b-versatile (fast & free)", value: "llama-3.3-70b-versatile" },
      { name: "llama-3.1-8b-instant (fastest)", value: "llama-3.1-8b-instant" },
      { name: "qwen/qwen3-32b (preview)", value: "qwen/qwen3-32b" },
      { name: "meta-llama/llama-4-scout-17b (preview, multimodal)", value: "meta-llama/llama-4-scout-17b-16e-instruct" },
      { name: "✏️  Custom model name", value: "__custom__" },
    ],
    defaultModel: "llama-3.3-70b-versatile",
    apiKeyUrl: "https://console.groq.com/keys",
  },
};

async function loadConfig(): Promise<Config> {
  try {
    const data = await Deno.readTextFile(CONFIG_FILE);
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveConfig(config: Config): Promise<void> {
  try {
    await Deno.mkdir(CONFIG_DIR, { recursive: true });
    await Deno.writeTextFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(colors.red(`Failed to save config: ${error}`));
  }
}

async function getDiff(): Promise<string> {
  try {
    const process = new Deno.Command("git", {
      args: ["diff", "--cached"],
      stdout: "piped",
      stderr: "piped",
    });

    const { stdout, success } = await process.output();

    if (!success) {
      return "";
    }

    return new TextDecoder().decode(stdout);
  } catch {
    return "";
  }
}

async function generateWithOpenAI(diff: string, apiKey: string, model: string): Promise<CommitMessage | null> {
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates conventional commit messages. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: getPrompt(diff)
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(colors.red(`OpenAI API error: ${response.status} ${error}`));
      return null;
    }

    const data = await response.json();
    return parseAIResponse(data.choices[0].message.content);
  } catch (error) {
    console.error(colors.red(`OpenAI error: ${error}`));
    return null;
  }
}

async function generateWithGemini(diff: string, apiKey: string, model: string): Promise<CommitMessage | null> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: getPrompt(diff)
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(colors.red(`Gemini API error: ${response.status} ${error}`));
      return null;
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return parseAIResponse(text);
  } catch (error) {
    console.error(colors.red(`Gemini error: ${error}`));
    return null;
  }
}

async function generateWithAnthropic(diff: string, apiKey: string, model: string): Promise<CommitMessage | null> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: getPrompt(diff)
          }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(colors.red(`Anthropic API error: ${response.status} ${error}`));
      return null;
    }

    const data = await response.json();
    return parseAIResponse(data.content[0].text);
  } catch (error) {
    console.error(colors.red(`Anthropic error: ${error}`));
    return null;
  }
}

async function generateWithGroq(diff: string, apiKey: string, model: string): Promise<CommitMessage | null> {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates conventional commit messages. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: getPrompt(diff)
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(colors.red(`Groq API error: ${response.status} ${error}`));
      return null;
    }

    const data = await response.json();
    return parseAIResponse(data.choices[0].message.content);
  } catch (error) {
    console.error(colors.red(`Groq error: ${error}`));
    return null;
  }
}

function getPrompt(diff: string): string {
  return `You are a commit message generator. Based on the following git diff, generate a conventional commit message.

Analyze the changes and provide a JSON response with this exact structure (respond with ONLY valid JSON, no markdown, no explanation):

{
  "type": "feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert",
  "scope": "optional scope or null",
  "description": "short description (max 72 chars)",
  "body": "optional detailed body or null",
  "breaking": true|false,
  "breakingDescription": "description if breaking is true, otherwise null"
}

Rules:
- Choose the most appropriate type based on the changes
- Keep description concise and in imperative mood
- Use scope only if changes are focused on a specific area
- Add body only if changes need additional context
- Set breaking to true only for breaking changes

Git diff:
\`\`\`
${diff.slice(0, 8000)}
\`\`\`

Respond with valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text.`;
}

function parseAIResponse(content: string): CommitMessage | null {
  try {
    // Remove markdown code blocks if present
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const aiCommit = JSON.parse(jsonStr);

    return {
      type: aiCommit.type,
      scope: aiCommit.scope || undefined,
      description: aiCommit.description,
      body: aiCommit.body || undefined,
      breaking: aiCommit.breaking || false,
      breakingDescription: aiCommit.breakingDescription || undefined,
      footers: [],
    };
  } catch (error) {
    console.error(colors.red(`Failed to parse AI response: ${error}`));
    console.error(colors.dim(`Response content: ${content.substring(0, 200)}...`));
    return null;
  }
}

async function generateCommitWithAI(diff: string, config: Config): Promise<CommitMessage | null> {
  console.log(colors.dim("\n🤖 Generating commit message with AI...\n"));

  const provider = config.provider || "openai";

  switch (provider) {
    case "openai": {
      const apiKey = config.openaiApiKey;
      const model = config.openaiModel || PROVIDER_INFO.openai.defaultModel;
      if (!apiKey) return null;
      return await generateWithOpenAI(diff, apiKey, model);
    }
    case "gemini": {
      const apiKey = config.geminiApiKey;
      const model = config.geminiModel || PROVIDER_INFO.gemini.defaultModel;
      if (!apiKey) return null;
      return await generateWithGemini(diff, apiKey, model);
    }
    case "anthropic": {
      const apiKey = config.anthropicApiKey;
      const model = config.anthropicModel || PROVIDER_INFO.anthropic.defaultModel;
      if (!apiKey) return null;
      return await generateWithAnthropic(diff, apiKey, model);
    }
    case "groq": {
      const apiKey = config.groqApiKey;
      const model = config.groqModel || PROVIDER_INFO.groq.defaultModel;
      if (!apiKey) return null;
      return await generateWithGroq(diff, apiKey, model);
    }
    default:
      return null;
  }
}

function formatCommitMessage(commit: CommitMessage): string {
  let message = commit.type;
  
  if (commit.scope) {
    message += `(${commit.scope})`;
  }
  
  if (commit.breaking) {
    message += "!";
  }
  
  message += `: ${commit.description}`;
  
  if (commit.body) {
    message += `\n\n${commit.body}`;
  }
  
  if (commit.breaking && commit.breakingDescription) {
    message += `\n\nBREAKING CHANGE: ${commit.breakingDescription}`;
  }
  
  if (commit.footers.length > 0) {
    message += "\n";
    for (const footer of commit.footers) {
      message += `\n${footer.token}: ${footer.value}`;
    }
  }
  
  return message;
}

async function getStagedFiles(): Promise<string[]> {
  try {
    const process = new Deno.Command("git", {
      args: ["diff", "--cached", "--name-only"],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { stdout, success } = await process.output();
    
    if (!success) {
      return [];
    }
    
    const files = new TextDecoder().decode(stdout).trim().split("\n").filter(f => f);
    return files;
  } catch {
    return [];
  }
}

async function getModifiedFiles(): Promise<string[]> {
  try {
    const process = new Deno.Command("git", {
      args: ["diff", "--name-only"],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { stdout, success } = await process.output();
    
    if (!success) {
      return [];
    }
    
    const files = new TextDecoder().decode(stdout).trim().split("\n").filter(f => f);
    return files;
  } catch {
    return [];
  }
}

async function getUntrackedFiles(): Promise<string[]> {
  try {
    const process = new Deno.Command("git", {
      args: ["ls-files", "--others", "--exclude-standard"],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { stdout, success } = await process.output();
    
    if (!success) {
      return [];
    }
    
    const files = new TextDecoder().decode(stdout).trim().split("\n").filter(f => f);
    return files;
  } catch {
    return [];
  }
}

async function stageFiles(files: string[]): Promise<boolean> {
  if (files.length === 0) return true;
  
  try {
    const process = new Deno.Command("git", {
      args: ["add", ...files],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { success } = await process.output();
    return success;
  } catch {
    return false;
  }
}

async function unstageFiles(files: string[]): Promise<boolean> {
  if (files.length === 0) return true;
  
  try {
    const process = new Deno.Command("git", {
      args: ["reset", "HEAD", ...files],
      stdout: "piped",
      stderr: "piped",
    });
    
    const { success } = await process.output();
    return success;
  } catch {
    return false;
  }
}

async function commitMessage(message: string, noVerify: boolean): Promise<void> {
  const args = ["commit", "-m", message];
  
  if (noVerify) {
    args.push("--no-verify");
  }
  
  const process = new Deno.Command("git", {
    args,
    stdout: "inherit",
    stderr: "inherit",
  });
  
  const { success } = await process.output();
  
  if (success) {
    console.log(colors.green("\n✓ Commit successful!"));
  } else {
    console.error(colors.red("\n✗ Commit failed!"));
    Deno.exit(1);
  }
}

await new Command()
  .name("commit")
  .version("1.2.0")
  .description("Generate conventional commit messages interactively")
  .option("-n, --no-verify", "Bypass git hooks")
  .option("-d, --dry-run", "Show the commit message without committing")
  .option("-s, --skip-staging", "Skip file staging selection")
  .option("-a, --ai", "Use AI to generate commit message")
  .command("config", "Configure AI provider and API settings")
  .action(async () => {
    console.log(colors.bold.blue("\n⚙️  Configuration\n"));

    const config = await loadConfig();

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
      const provider = await Select.prompt({
        message: "Select AI provider",
        options: [
          {
            name: `OpenAI (GPT-4) - Pay per use`,
            value: "openai" as AIProvider
          },
          {
            name: `Google Gemini - Generous free tier ⭐`,
            value: "gemini" as AIProvider
          },
          {
            name: `Anthropic Claude - High quality`,
            value: "anthropic" as AIProvider
          },
          {
            name: `Groq - Very fast, free tier ⭐`,
            value: "groq" as AIProvider
          },
        ],
      });
      config.provider = provider;
      await saveConfig(config);
      console.log(colors.green(`\n✓ Provider set to ${PROVIDER_INFO[provider].name}\n`));
      console.log(colors.dim(`Get your API key at: ${PROVIDER_INFO[provider].apiKeyUrl}\n`));
    } else if (action === "api-key") {
      const provider = config.provider || "openai";
      const providerName = PROVIDER_INFO[provider].name;

      console.log(colors.cyan(`\n${providerName} API Key Setup`));
      console.log(colors.dim(`Get your key at: ${PROVIDER_INFO[provider].apiKeyUrl}\n`));

      const apiKey = await Input.prompt({
        message: `Enter your ${providerName} API key`,
        hint: "Will be stored locally in ~/.config/auto-commit/config.json",
      });

      switch (provider) {
        case "openai":
          config.openaiApiKey = apiKey;
          break;
        case "gemini":
          config.geminiApiKey = apiKey;
          break;
        case "anthropic":
          config.anthropicApiKey = apiKey;
          break;
        case "groq":
          config.groqApiKey = apiKey;
          break;
      }

      await saveConfig(config);
      console.log(colors.green("\n✓ API key saved successfully!\n"));
    } else if (action === "model") {
      const provider = config.provider || "openai";
      const providerName = PROVIDER_INFO[provider].name;

      let model = await Select.prompt({
        message: `Select ${providerName} model`,
        options: PROVIDER_INFO[provider].models,
      });

      // Handle custom model input
      if (model === "__custom__") {
        model = await Input.prompt({
          message: `Enter custom ${providerName} model name`,
          hint: "e.g., gpt-4-turbo-preview, claude-3-opus-20240229",
          minLength: 1,
        });
      }

      switch (provider) {
        case "openai":
          config.openaiModel = model;
          break;
        case "gemini":
          config.geminiModel = model;
          break;
        case "anthropic":
          config.anthropicModel = model;
          break;
        case "groq":
          config.groqModel = model;
          break;
      }

      await saveConfig(config);
      console.log(colors.green(`\n✓ Model set to ${model}\n`));
    } else if (action === "view") {
      const provider = config.provider || "openai";
      const providerInfo = PROVIDER_INFO[provider];

      console.log(colors.cyan("\nCurrent Configuration:"));
      console.log(colors.dim("─".repeat(60)));
      console.log(`Provider: ${colors.bold(providerInfo.name)}`);

      let apiKeySet = false;
      let currentModel = providerInfo.defaultModel;

      switch (provider) {
        case "openai":
          apiKeySet = !!config.openaiApiKey;
          currentModel = config.openaiModel || currentModel;
          break;
        case "gemini":
          apiKeySet = !!config.geminiApiKey;
          currentModel = config.geminiModel || currentModel;
          break;
        case "anthropic":
          apiKeySet = !!config.anthropicApiKey;
          currentModel = config.anthropicModel || currentModel;
          break;
        case "groq":
          apiKeySet = !!config.groqApiKey;
          currentModel = config.groqModel || currentModel;
          break;
      }

      console.log(`API Key: ${apiKeySet ? colors.green("✓ Set (hidden)") : colors.red("✗ Not set")}`);
      console.log(`Model: ${currentModel}`);
      console.log(colors.dim("─".repeat(60)));

      if (!apiKeySet) {
        console.log(colors.yellow(`\n⚠ Get your API key at: ${providerInfo.apiKeyUrl}`));
      }
      console.log();
    } else if (action === "clear") {
      const confirm = await Confirm.prompt({
        message: "Are you sure you want to clear all configuration?",
        default: false,
      });
      if (confirm) {
        await saveConfig({});
        console.log(colors.green("\n✓ Configuration cleared\n"));
      }
    }
  })
  .reset()
  .action(async (options) => {
    console.log(colors.bold.blue("\n🚀 Conventional Commit Message Generator\n"));
    
    const stagedFiles = await getStagedFiles();
    const modifiedFiles = await getModifiedFiles();
    const untrackedFiles = await getUntrackedFiles();
    
    const allChangedFiles = [...new Set([...stagedFiles, ...modifiedFiles, ...untrackedFiles])];
    
    if (allChangedFiles.length === 0) {
      console.log(colors.yellow("⚠ No changes detected in the repository.\n"));
      Deno.exit(1);
    }
    
    let finalStagedFiles = stagedFiles;
    
    if (!options.skipStaging) {
      console.log(colors.bold("📂 File Staging\n"));
      
      const fileOptions = allChangedFiles.map(file => {
        const isStaged = stagedFiles.includes(file);
        const isUntracked = untrackedFiles.includes(file);
        
        let label = file;
        if (isStaged) {
          label += colors.green(" (staged)");
        } else if (isUntracked) {
          label += colors.yellow(" (untracked)");
        } else {
          label += colors.red(" (modified)");
        }
        
        return {
          name: label,
          value: file,
          checked: isStaged,
        };
      });
      
      const selectedFiles = await Checkbox.prompt({
        message: "Select files to stage for commit",
        options: fileOptions,
        hint: "Use space to select/deselect, enter to confirm",
      });
      
      const filesToStage = selectedFiles.filter(f => !stagedFiles.includes(f));
      const filesToUnstage = stagedFiles.filter(f => !selectedFiles.includes(f));
      
      if (filesToStage.length > 0) {
        const stageSuccess = await stageFiles(filesToStage);
        if (!stageSuccess) {
          console.error(colors.red("\n✗ Failed to stage some files"));
          Deno.exit(1);
        }
      }
      
      if (filesToUnstage.length > 0) {
        const unstageSuccess = await unstageFiles(filesToUnstage);
        if (!unstageSuccess) {
          console.error(colors.red("\n✗ Failed to unstage some files"));
          Deno.exit(1);
        }
      }
      
      finalStagedFiles = selectedFiles;
      
      if (finalStagedFiles.length === 0) {
        console.log(colors.yellow("\n⚠ No files selected for commit.\n"));
        Deno.exit(1);
      }
      
      console.log(colors.green(`\n✓ ${finalStagedFiles.length} file(s) staged for commit\n`));
    } else {
      if (stagedFiles.length === 0) {
        console.log(colors.yellow("⚠ No staged files found. Use --skip-staging=false or stage files with 'git add' first.\n"));
        Deno.exit(1);
      }
    }
    
    console.log(colors.dim(`Staged files (${finalStagedFiles.length}):`));
    finalStagedFiles.slice(0, 5).forEach(f => console.log(colors.dim(`  • ${f}`)));
    if (finalStagedFiles.length > 5) {
      console.log(colors.dim(`  ... and ${finalStagedFiles.length - 5} more\n`));
    } else {
      console.log();
    }
    
    // Check if AI generation is requested or available
    const config = await loadConfig();
    let useAI = options.ai || false;

    const provider = config.provider || "openai";
    const hasApiKey = config[`${provider}ApiKey` as keyof Config];

    if (!useAI && hasApiKey) {
      useAI = await Confirm.prompt({
        message: `Generate commit message with AI (${PROVIDER_INFO[provider].name})?`,
        default: false,
      });
    }

    let commit: CommitMessage;

    if (useAI) {
      if (!hasApiKey) {
        console.log(colors.yellow(`\n⚠ ${PROVIDER_INFO[provider].name} API key not configured. Run 'commit config' to set it up.\n`));
        console.log(colors.dim("Falling back to manual mode...\n"));
        useAI = false;
      } else {
        const diff = await getDiff();
        if (!diff) {
          console.log(colors.yellow("\n⚠ No diff found for AI generation. Using manual mode.\n"));
          useAI = false;
        } else {
          const aiCommit = await generateCommitWithAI(diff, config);
          if (aiCommit) {
            commit = aiCommit;

            console.log(colors.bold.cyan(`\n🤖 AI Generated Commit Message (${PROVIDER_INFO[provider].name}):\n`));
            console.log(colors.dim("─".repeat(60)));
            console.log(formatCommitMessage(commit));
            console.log(colors.dim("─".repeat(60) + "\n"));

            const useGenerated = await Select.prompt({
              message: "What would you like to do?",
              options: [
                { name: "✓ Use this commit message", value: "use" },
                { name: "✏️  Edit the commit message", value: "edit" },
                { name: "🔄 Regenerate with AI", value: "regenerate" },
                { name: "✍️  Create manually", value: "manual" },
              ],
            });

            if (useGenerated === "use") {
              // Use the AI-generated commit as is
            } else if (useGenerated === "regenerate") {
              console.log(colors.dim("\n🔄 Regenerating...\n"));
              const newAiCommit = await generateCommitWithAI(diff, config);
              if (newAiCommit) {
                commit = newAiCommit;
              }
            } else if (useGenerated === "edit") {
              const editWhat = await Select.prompt({
                message: "What would you like to edit?",
                options: [
                  { name: "Description", value: "description" },
                  { name: "Type", value: "type" },
                  { name: "Scope", value: "scope" },
                  { name: "Body", value: "body" },
                  { name: "Breaking change", value: "breaking" },
                ],
              });

              if (editWhat === "description") {
                commit.description = await Input.prompt({
                  message: "Edit description",
                  default: commit.description,
                });
              } else if (editWhat === "type") {
                commit.type = await Select.prompt({
                  message: "Select type",
                  options: COMMIT_TYPES.map(t => ({
                    name: `${t.name.padEnd(10)} - ${t.description}`,
                    value: t.name,
                  })),
                  default: commit.type,
                });
              } else if (editWhat === "scope") {
                const newScope = await Input.prompt({
                  message: "Edit scope (leave empty to remove)",
                  default: commit.scope || "",
                });
                commit.scope = newScope || undefined;
              } else if (editWhat === "body") {
                const newBody = await Input.prompt({
                  message: "Edit body (use \\n for new lines, leave empty to remove)",
                  default: commit.body || "",
                });
                commit.body = newBody ? newBody.replace(/\\n/g, '\n') : undefined;
              } else if (editWhat === "breaking") {
                commit.breaking = await Confirm.prompt({
                  message: "Is this a breaking change?",
                  default: commit.breaking,
                });
                if (commit.breaking) {
                  const newBreaking = await Input.prompt({
                    message: "Describe the breaking change",
                    default: commit.breakingDescription || "",
                  });
                  commit.breakingDescription = newBreaking.replace(/\\n/g, '\n');
                }
              }
            } else {
              useAI = false;
            }
          } else {
            useAI = false;
          }
        }
      }
    }

    if (!useAI) {
      console.log(colors.bold.blue("📝 Commit Message\n"));

      const type = await Select.prompt({
        message: "Select the type of change",
        options: COMMIT_TYPES.map(t => ({
          name: `${t.name.padEnd(10)} - ${t.description}`,
          value: t.name,
        })),
      });

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

      const scopeSelection = await Select.prompt({
        message: "Select a scope (optional)",
        options: COMMON_SCOPES,
      });

      let scope: string | undefined;
      if (scopeSelection === "__custom__") {
        scope = await Input.prompt({
          message: "Enter custom scope",
          hint: "e.g., parser, router, middleware",
        });
      } else {
        scope = scopeSelection || undefined;
      }

      const description = await Input.prompt({
        message: "Enter a short description",
        minLength: 1,
        hint: "Brief summary of the change",
      });

      const hasBody = await Confirm.prompt({
        message: "Add a detailed body?",
        default: false,
      });

      let body: string | undefined;
      if (hasBody) {
        const bodyInput = await Input.prompt({
          message: "Enter the commit body (use \\n for new lines)",
          hint: "Provide additional context about the change",
        });

        body = bodyInput.replace(/\\n/g, '\n');

        if (body) {
          console.log(colors.green("\n✓ Body captured\n"));
          console.log(colors.dim("Preview:"));
          console.log(colors.dim(body.split('\n').map(l => `  ${l}`).join('\n') + "\n"));
        }
      }

      const breaking = await Confirm.prompt({
        message: "Is this a BREAKING CHANGE?",
        default: false,
      });

      let breakingDescription: string | undefined;
      if (breaking) {
        const breakingInput = await Input.prompt({
          message: "Describe the breaking change (use \\n for new lines)",
          minLength: 1,
        });

        breakingDescription = breakingInput.replace(/\\n/g, '\n');
      }

      const hasFooters = await Confirm.prompt({
        message: "Add footers (e.g., Refs, Reviewed-by)?",
        default: false,
      });

      const footers: Array<{ token: string; value: string }> = [];
      if (hasFooters) {
        let addMore = true;
        while (addMore) {
          const token = await Input.prompt({
            message: "Enter footer token",
            hint: "e.g., Refs, Reviewed-by, Closes",
          });

          const value = await Input.prompt({
            message: `Enter value for ${token}`,
            hint: "e.g., #123, John Doe",
          });

          footers.push({ token, value });

          addMore = await Confirm.prompt({
            message: "Add another footer?",
            default: false,
          });
        }
      }

      commit = {
        type,
        scope: scope || undefined,
        description,
        body,
        breaking,
        breakingDescription,
        footers,
      };
    }
    
    const message = formatCommitMessage(commit);
    
    console.log(colors.bold.cyan("\n📝 Final commit message:\n"));
    console.log(colors.dim("─".repeat(60)));
    console.log(message);
    console.log(colors.dim("─".repeat(60) + "\n"));
    
    if (options.dryRun) {
      console.log(colors.yellow("Dry run mode - commit not created\n"));
      Deno.exit(0);
    }
    
    const confirm = await Confirm.prompt({
      message: "Create this commit?",
      default: true,
    });
    
    if (confirm) {
      await commitMessage(message, options.noVerify || false);
    } else {
      console.log(colors.yellow("\n✗ Commit cancelled\n"));
    }
  })
  .parse(Deno.args);
