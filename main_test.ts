import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import {
  buildDiffContext,
  type CommitMessage,
  formatCommitMessage,
  MAX_DESCRIPTION_LENGTH,
  parseAIResponse,
  truncateDescription,
} from "./main.ts";

Deno.test("parseAIResponse parses plain JSON", () => {
  const commit = parseAIResponse(
    '{"type":"feat","scope":"auth","description":"add login","body":null,"breaking":false,"breakingDescription":null}',
  );
  assertEquals(commit, {
    type: "feat",
    scope: "auth",
    description: "add login",
    body: undefined,
    breaking: false,
    breakingDescription: undefined,
    footers: [],
  });
});

Deno.test("parseAIResponse tolerates code fences and surrounding prose", () => {
  const commit = parseAIResponse('Here you go:\n```json\n{"type":"fix","description":"handle null"}\n```\nDone.');
  assertEquals(commit?.type, "fix");
  assertEquals(commit?.description, "handle null");
});

Deno.test("parseAIResponse falls back to chore for unknown types", () => {
  assertEquals(parseAIResponse('{"type":"feature","description":"x"}')?.type, "chore");
  assertEquals(parseAIResponse('{"type":"FIX","description":"x"}')?.type, "fix");
});

Deno.test("parseAIResponse cleans the description", () => {
  const commit = parseAIResponse('{"type":"feat","description":"feat(api): add\\n endpoint."}');
  assertEquals(commit?.description, "add endpoint");
});

Deno.test("parseAIResponse treats 'null' strings as missing", () => {
  const commit = parseAIResponse('{"type":"docs","scope":"null","description":"update readme","body":"null"}');
  assertEquals(commit?.scope, undefined);
  assertEquals(commit?.body, undefined);
});

Deno.test("parseAIResponse accepts string booleans for breaking", () => {
  const commit = parseAIResponse('{"type":"feat","description":"drop v1","breaking":"true","breakingDescription":"v1 removed"}');
  assertEquals(commit?.breaking, true);
  assertEquals(commit?.breakingDescription, "v1 removed");
});

Deno.test("parseAIResponse rejects invalid or incomplete output", () => {
  assertEquals(parseAIResponse("not json at all"), null);
  assertEquals(parseAIResponse('{"type":"feat"}'), null);
});

Deno.test("truncateDescription cuts at a word boundary within the limit", () => {
  const long = "add a very long description that keeps going well past the conventional limit of seventy two";
  const result = truncateDescription(long);
  assert(result.length <= MAX_DESCRIPTION_LENGTH);
  assert(long.startsWith(result));
  assert(!result.endsWith(" "));
  assertEquals(truncateDescription("short"), "short");
});

Deno.test("formatCommitMessage renders scope, breaking marker, body and footers", () => {
  const commit: CommitMessage = {
    type: "feat",
    scope: "api",
    description: "migrate to v2",
    body: "Details here.",
    breaking: true,
    breakingDescription: "v1 endpoints removed",
    footers: [{ token: "Refs", value: "#12" }],
  };
  assertEquals(
    formatCommitMessage(commit),
    "feat(api)!: migrate to v2\n\nDetails here.\n\nBREAKING CHANGE: v1 endpoints removed\n\nRefs: #12",
  );
});

const fileDiff = (path: string, lines: number) =>
  `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n${"+changed line\n".repeat(lines)}`;

Deno.test("buildDiffContext omits lockfile bodies", () => {
  const diff = fileDiff("src/app.ts", 2) + fileDiff("deno.lock", 50);
  const context = buildDiffContext(diff, "M\tsrc/app.ts\nM\tdeno.lock", "", 100_000);
  assertStringIncludes(context, "Full diff:");
  assertStringIncludes(context, "diff --git a/deno.lock b/deno.lock\n[diff omitted: lockfile or generated file]");
  assertEquals(context.split("+changed line").length - 1, 2);
});

Deno.test("buildDiffContext truncates per file and keeps every file", () => {
  const diff = fileDiff("small.ts", 1) + fileDiff("big.ts", 2000) + fileDiff("other.ts", 2000);
  const context = buildDiffContext(diff, "", "", 2000);
  assertStringIncludes(context, "per-file truncated");
  for (const path of ["small.ts", "big.ts", "other.ts"]) {
    assertStringIncludes(context, `diff --git a/${path}`);
  }
  // Small file kept whole; large ones truncated.
  assertStringIncludes(context, fileDiff("small.ts", 1));
  assertStringIncludes(context, "[truncated ");
  assert(context.length < 2600);
});
