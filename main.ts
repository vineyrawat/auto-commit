#!/usr/bin/env -S deno run --allow-run --allow-read

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

interface CommitMessage {
  type: string;
  scope?: string;
  description: string;
  body?: string;
  breaking: boolean;
  breakingDescription?: string;
  footers: Array<{ token: string; value: string }>;
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
  .version("1.0.0")
  .description("Generate conventional commit messages interactively")
  .option("-n, --no-verify", "Bypass git hooks")
  .option("-d, --dry-run", "Show the commit message without committing")
  .option("-s, --skip-staging", "Skip file staging selection")
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
      body = await Input.prompt({
        message: "Enter the commit body",
        hint: "Provide additional context about the change",
      });
    }
    
    const breaking = await Confirm.prompt({
      message: "Is this a BREAKING CHANGE?",
      default: false,
    });
    
    let breakingDescription: string | undefined;
    if (breaking) {
      breakingDescription = await Input.prompt({
        message: "Describe the breaking change",
        minLength: 1,
      });
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
    
    const commit: CommitMessage = {
      type,
      scope: scope || undefined,
      description,
      body,
      breaking,
      breakingDescription,
      footers,
    };
    
    const message = formatCommitMessage(commit);
    
    console.log(colors.bold.cyan("\n📝 Generated commit message:\n"));
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