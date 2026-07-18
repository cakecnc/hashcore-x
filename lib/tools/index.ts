import {
  LARGE_JOB_WARNING_ITEMS,
  MAX_INPUT_BYTES,
  MAX_OUTPUT_CHARACTERS,
  MAX_OUTPUT_ITEMS,
  MAX_PERMUTATION_CHARACTERS,
  getUtf8ByteLength,
} from "../limits";
import type {
  ToolId,
  UtilityOptions,
  UtilityRequest,
  UtilityResult,
} from "./types";

function toLines(input: string): string[] {
  const normalized = input.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}

function nonEmptyLines(input: string): string[] {
  return toLines(input).filter((line) => line.length > 0);
}

function codePointLength(value: string): number {
  return Array.from(value).length;
}

function asBoolean(options: UtilityOptions, key: string, fallback: boolean) {
  const value = options[key];
  return typeof value === "boolean" ? value : fallback;
}

function asNumber(
  options: UtilityOptions,
  key: string,
  fallback: number,
): number {
  const value = options[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(options: UtilityOptions, key: string, fallback = ""): string {
  const value = options[key];
  return typeof value === "string" ? value : fallback;
}

function limitOutput(lines: string[], warnings: string[]): string[] {
  let limited = lines;
  if (limited.length > MAX_OUTPUT_ITEMS) {
    limited = limited.slice(0, MAX_OUTPUT_ITEMS);
    warnings.push(`결과를 최대 ${MAX_OUTPUT_ITEMS.toLocaleString("ko-KR")}개로 제한했습니다.`);
  }

  let characterCount = 0;
  const withinCharacterLimit: string[] = [];
  for (const line of limited) {
    const nextCount = characterCount + line.length + 1;
    if (nextCount > MAX_OUTPUT_CHARACTERS) {
      warnings.push("결과 크기가 2,000,000자를 넘어 이후 항목을 생략했습니다.");
      break;
    }
    withinCharacterLimit.push(line);
    characterCount = nextCount;
  }
  return withinCharacterLimit;
}

function cleanLines(input: string, options: UtilityOptions): string[] {
  const trimLines = asBoolean(options, "trimLines", true);
  const collapseWhitespace = asBoolean(options, "collapseWhitespace", true);
  const removeBlankLines = asBoolean(options, "removeBlankLines", true);

  return toLines(input)
    .map((line) => {
      const trimmed = trimLines ? line.trim() : line;
      return collapseWhitespace ? trimmed.replace(/[\t ]+/g, " ") : trimmed;
    })
    .filter((line) => !removeBlankLines || line.length > 0);
}

function deduplicate(input: string, options: UtilityOptions): string[] {
  const caseSensitive = asBoolean(options, "caseSensitive", true);
  const ignoreBlankLines = asBoolean(options, "ignoreBlankLines", true);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const line of toLines(input)) {
    if (ignoreBlankLines && line.length === 0) continue;
    const key = caseSensitive ? line : line.toLocaleLowerCase("ko-KR");
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function splitByLength(
  input: string,
  options: UtilityOptions,
): { lines: string[]; rows: string[][] } {
  const minimum = Math.max(0, Math.floor(asNumber(options, "minimum", 1)));
  const maximum = Math.min(256, Math.floor(asNumber(options, "maximum", 64)));
  if (minimum > maximum) throw new Error("최소 길이는 최대 길이보다 클 수 없습니다.");

  const groups = new Map<number, string[]>();
  for (const line of nonEmptyLines(input)) {
    const length = codePointLength(line);
    if (length < minimum || length > maximum) continue;
    const group = groups.get(length) ?? [];
    group.push(line);
    groups.set(length, group);
  }

  const rows: string[][] = [["length", "value"]];
  const lines: string[] = [];
  let itemCount = 0;
  let reachedLimit = false;
  for (const [length, values] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    lines.push(`[길이 ${length}]`);
    for (const value of values) {
      if (itemCount >= MAX_OUTPUT_ITEMS) {
        reachedLimit = true;
        break;
      }
      lines.push(value);
      rows.push([String(length), value]);
      itemCount += 1;
    }
    if (reachedLimit) break;
  }
  return { lines, rows };
}

function filterText(input: string, options: UtilityOptions): string[] {
  const query = asString(options, "query");
  if (!query) throw new Error("필터 문자열을 입력해 주세요.");
  const mode = asString(options, "mode", "include");
  const caseSensitive = asBoolean(options, "caseSensitive", true);
  const needle = caseSensitive ? query : query.toLocaleLowerCase("ko-KR");

  return nonEmptyLines(input).filter((line) => {
    const haystack = caseSensitive ? line : line.toLocaleLowerCase("ko-KR");
    const includes = haystack.includes(needle);
    return mode === "exclude" ? !includes : includes;
  });
}

function combine(input: string, options: UtilityOptions): string[] {
  const secondaryInput = asString(options, "secondaryInput");
  if (!secondaryInput.trim()) throw new Error("두 번째 목록을 입력해 주세요.");
  const separator = asString(options, "separator");
  const left = nonEmptyLines(input);
  const right = nonEmptyLines(secondaryInput);
  const result: string[] = [];

  for (const leftValue of left) {
    for (const rightValue of right) {
      result.push(`${leftValue}${separator}${rightValue}`);
      if (result.length >= MAX_OUTPUT_ITEMS) return result;
    }
  }
  return result;
}

function uniquePermutations(value: string, remainingLimit: number): string[] {
  const characters = Array.from(value).sort((a, b) => a.localeCompare(b, "ko"));
  const used = Array.from({ length: characters.length }, () => false);
  const current: string[] = [];
  const result: string[] = [];

  const visit = () => {
    if (result.length >= remainingLimit) return;
    if (current.length === characters.length) {
      result.push(current.join(""));
      return;
    }
    for (let index = 0; index < characters.length; index += 1) {
      if (used[index]) continue;
      if (index > 0 && characters[index] === characters[index - 1] && !used[index - 1]) {
        continue;
      }
      used[index] = true;
      current.push(characters[index]);
      visit();
      current.pop();
      used[index] = false;
      if (result.length >= remainingLimit) return;
    }
  };

  visit();
  return result;
}

function permutations(
  input: string,
  options: UtilityOptions,
  warnings: string[],
): string[] {
  const requestedLimit = Math.floor(asNumber(options, "maximumResults", 5_000));
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_OUTPUT_ITEMS);
  const result: string[] = [];

  for (const line of nonEmptyLines(input)) {
    const length = codePointLength(line);
    if (length > MAX_PERMUTATION_CHARACTERS) {
      warnings.push(`“${line.slice(0, 20)}” 항목은 ${MAX_PERMUTATION_CHARACTERS}자를 초과해 건너뛰었습니다.`);
      continue;
    }
    result.push(...uniquePermutations(line, limit - result.length));
    if (result.length >= limit) {
      warnings.push(`설정한 최대 결과 ${limit.toLocaleString("ko-KR")}개에서 생성을 중단했습니다.`);
      break;
    }
  }
  return result;
}

function factorial(value: number): number {
  let result = 1;
  for (let index = 2; index <= value; index += 1) result *= index;
  return result;
}

export function estimateUtilityOutput(
  toolId: ToolId,
  input: string,
  options: UtilityOptions,
): number {
  const lines = nonEmptyLines(input);
  if (toolId === "combine") {
    return lines.length * nonEmptyLines(asString(options, "secondaryInput")).length;
  }
  if (toolId === "permutations") {
    return lines.reduce((sum, line) => {
      const length = codePointLength(line);
      return sum + (length <= MAX_PERMUTATION_CHARACTERS ? factorial(length) : 0);
    }, 0);
  }
  return lines.length;
}

export function runUtility({
  toolId,
  input,
  options,
}: UtilityRequest): UtilityResult {
  if (!input.trim()) throw new Error("처리할 텍스트 또는 파일을 입력해 주세요.");
  if (getUtf8ByteLength(input) > MAX_INPUT_BYTES) {
    throw new Error("입력 크기가 1 MB 제한을 초과했습니다.");
  }

  const startedAt = performance.now();
  const warnings: string[] = [];
  const estimate = estimateUtilityOutput(toolId, input, options);
  if (estimate > LARGE_JOB_WARNING_ITEMS) {
    warnings.push(`예상 결과가 ${estimate.toLocaleString("ko-KR")}개인 대용량 작업입니다.`);
  }
  if (estimate > MAX_OUTPUT_ITEMS) {
    warnings.push(`결과는 최대 ${MAX_OUTPUT_ITEMS.toLocaleString("ko-KR")}개까지만 생성합니다.`);
  }

  let lines: string[];
  let csvRows: string[][] | undefined;

  switch (toolId) {
    case "clean-lines":
      lines = cleanLines(input, options);
      break;
    case "deduplicate":
      lines = deduplicate(input, options);
      break;
    case "split-length": {
      const split = splitByLength(input, options);
      lines = split.lines;
      csvRows = split.rows;
      break;
    }
    case "filter-text":
      lines = filterText(input, options);
      break;
    case "combine":
      lines = combine(input, options);
      break;
    case "permutations":
      lines = permutations(input, options, warnings);
      break;
    default:
      throw new Error("지원하지 않는 도구입니다.");
  }

  const limitedLines = limitOutput(lines, warnings);
  const rows = csvRows ?? [
    ["index", "value"],
    ...limitedLines.map((line, index) => [String(index + 1), line]),
  ];

  return {
    text: limitedLines.join("\n"),
    csvRows: rows,
    inputCount: nonEmptyLines(input).length,
    outputCount: csvRows ? Math.max(csvRows.length - 1, 0) : limitedLines.length,
    durationMs: Math.max(performance.now() - startedAt, 0),
    warnings,
  };
}
