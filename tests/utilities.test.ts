import assert from "node:assert/strict";
import test from "node:test";
import { createCsv, createTextBlob, copyText } from "../lib/download";
import { deleteHistory, readHistory, saveHistory } from "../lib/history";
import { MAX_INPUT_BYTES } from "../lib/limits";
import { estimateUtilityOutput, runUtility } from "../lib/tools";

test("blocks empty input", () => {
  assert.throws(
    () => runUtility({ toolId: "clean-lines", input: "  ", options: {} }),
    /처리할 텍스트/,
  );
});

test("cleans blank lines and whitespace", () => {
  const result = runUtility({
    toolId: "clean-lines",
    input: "  alpha   beta  \n\n 한글   예시 ",
    options: { trimLines: true, collapseWhitespace: true, removeBlankLines: true },
  });
  assert.equal(result.text, "alpha beta\n한글 예시");
  assert.equal(result.outputCount, 2);
});

test("deduplicates while preserving first occurrence", () => {
  const result = runUtility({
    toolId: "deduplicate",
    input: "Alpha\nbeta\nalpha\n한글\n한글",
    options: { caseSensitive: false, ignoreBlankLines: true },
  });
  assert.equal(result.text, "Alpha\nbeta\n한글");
});

test("groups Korean input by Unicode character length", () => {
  const result = runUtility({
    toolId: "split-length",
    input: "a\n한글\n도구상자",
    options: { minimum: 1, maximum: 10 },
  });
  assert.match(result.text, /\[길이 2\]\n한글/);
  assert.match(result.text, /\[길이 4\]\n도구상자/);
  assert.deepEqual(result.csvRows.at(-1), ["4", "도구상자"]);
});

test("filters include and exclude modes", () => {
  const include = runUtility({
    toolId: "filter-text",
    input: "Admin-2026\nguest-2025\nuser-2026",
    options: { query: "2026", mode: "include", caseSensitive: true },
  });
  assert.equal(include.text, "Admin-2026\nuser-2026");

  const exclude = runUtility({
    toolId: "filter-text",
    input: "Admin\nadmin\nguest",
    options: { query: "admin", mode: "exclude", caseSensitive: false },
  });
  assert.equal(exclude.text, "guest");
});

test("combines lists and estimates Cartesian product", () => {
  const options = { secondaryInput: "1\n2", separator: "-" };
  assert.equal(estimateUtilityOutput("combine", "a\nb", options), 4);
  const result = runUtility({ toolId: "combine", input: "a\nb", options });
  assert.equal(result.text, "a-1\na-2\nb-1\nb-2");
});

test("warns before a generated result would exceed the output cap", () => {
  const left = Array.from({ length: 101 }, (_, index) => `left-${index}`).join("\n");
  const right = Array.from({ length: 101 }, (_, index) => `right-${index}`).join("\n");
  const result = runUtility({
    toolId: "combine",
    input: left,
    options: { secondaryInput: right, separator: ":" },
  });
  assert.equal(result.outputCount, 10_000);
  assert.match(result.warnings.join(" "), /최대 10,000개/);
});

test("creates unique permutations and skips overlong items", () => {
  const result = runUtility({
    toolId: "permutations",
    input: "aab\nabcdefgh",
    options: { maximumResults: 100 },
  });
  assert.deepEqual(result.text.split("\n").sort(), ["aab", "aba", "baa"]);
  assert.match(result.warnings.join(" "), /7자를 초과/);
});

test("enforces the UTF-8 input limit", () => {
  assert.throws(
    () => runUtility({ toolId: "deduplicate", input: "a".repeat(MAX_INPUT_BYTES + 1), options: {} }),
    /1 MB 제한/,
  );
});

test("creates escaped CSV and copies results", async () => {
  const csv = createCsv([["value"], ['a,"b"']]);
  assert.equal(csv, '"value"\n"a,""b"""');
  const blob = createTextBlob(csv, "text/csv");
  assert.equal(blob.type, "text/csv;charset=utf-8");
  assert.equal(await blob.text(), csv);
  let copied = "";
  await copyText("한글 결과", { writeText: async (value) => { copied = value; } });
  assert.equal(copied, "한글 결과");
});

test("stores and deletes metadata without input or result content", () => {
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => { raw = value; },
  };
  saveHistory(storage, {
    id: "job-1",
    toolId: "deduplicate",
    toolName: "중복 제거",
    createdAt: "2026-07-17T00:00:00.000Z",
    status: "completed",
    inputCount: 3,
    outputCount: 2,
    durationMs: 1,
  });
  assert.equal(readHistory(storage).length, 1);
  assert.doesNotMatch(raw ?? "", /password|inputText|resultText/);
  assert.equal(deleteHistory(storage, "job-1").length, 0);
});
