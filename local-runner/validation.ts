import type { RunnerJobRequest } from "../lib/runner/types";

export const MAX_HASH_INPUT_BYTES = 64_000;
export const MAX_CANDIDATE_INPUT_BYTES = 1_000_000;
export const MAX_HASH_COUNT = 1_000;
export const MAX_CANDIDATE_COUNT = 100_000;
export const MAX_CANDIDATE_BYTES = 256;
export const MAX_RESULTS = 1_000;
export const JOB_TIMEOUT_MS = 5 * 60 * 1_000;

export const HASH_MODES = {
  0: { label: "MD5", hexadecimalLength: 32 },
  100: { label: "SHA-1", hexadecimalLength: 40 },
  1000: { label: "NTLM", hexadecimalLength: 32 },
  1400: { label: "SHA-256", hexadecimalLength: 64 },
  1700: { label: "SHA-512", hexadecimalLength: 128 },
} as const;

export type SupportedHashMode = keyof typeof HASH_MODES;

export interface ValidatedJobRequest {
  mode: SupportedHashMode;
  deviceType: "gpu" | "cpu";
  hashes: string[];
  candidates: string[];
}

export function validateJobRequest(value: unknown): ValidatedJobRequest {
  if (!value || typeof value !== "object") {
    throw new Error("요청 본문이 올바르지 않습니다.");
  }

  const request = value as Partial<RunnerJobRequest>;
  if (request.acknowledged !== true) {
    throw new Error("승인된 데이터 사용 확인이 필요합니다.");
  }
  const mode = validateHashMode(request.mode);
  const deviceType = request.deviceType === "cpu" ? "cpu" : "gpu";
  if (typeof request.hashes !== "string" || typeof request.candidates !== "string") {
    throw new Error("Hash와 후보 목록은 문자열이어야 합니다.");
  }
  if (utf8Length(request.hashes) > MAX_HASH_INPUT_BYTES) {
    throw new Error("Hash 입력이 64 KB 제한을 초과했습니다.");
  }
  if (utf8Length(request.candidates) > MAX_CANDIDATE_INPUT_BYTES) {
    throw new Error("후보 목록이 1 MB 제한을 초과했습니다.");
  }

  const hashes = normalizeLines(request.hashes).map((hash) => hash.trim());
  const candidates = normalizeLines(request.candidates);
  if (!hashes.length) throw new Error("처리할 Hash를 입력해 주세요.");
  if (!candidates.length) throw new Error("후보 목록을 입력해 주세요.");
  if (hashes.length > MAX_HASH_COUNT) {
    throw new Error(`Hash는 최대 ${MAX_HASH_COUNT.toLocaleString("ko-KR")}개까지 처리합니다.`);
  }
  if (candidates.length > MAX_CANDIDATE_COUNT) {
    throw new Error(`후보는 최대 ${MAX_CANDIDATE_COUNT.toLocaleString("ko-KR")}개까지 처리합니다.`);
  }

  const expectedLength = HASH_MODES[mode].hexadecimalLength;
  const hashPattern = new RegExp(`^[0-9a-fA-F]{${expectedLength}}$`);
  if (hashes.some((hash) => !hashPattern.test(hash))) {
    throw new Error(`${HASH_MODES[mode].label} 형식과 일치하지 않는 Hash가 있습니다.`);
  }
  for (const candidate of candidates) {
    if (candidate.includes("\0")) throw new Error("후보 목록에 NUL 문자를 사용할 수 없습니다.");
    if (utf8Length(candidate) > MAX_CANDIDATE_BYTES) {
      throw new Error(`후보 한 줄은 UTF-8 ${MAX_CANDIDATE_BYTES} bytes를 초과할 수 없습니다.`);
    }
  }

  return { mode, deviceType, hashes, candidates };
}

export function validateHashMode(value: unknown): SupportedHashMode {
  const numericMode = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numericMode) || !(numericMode in HASH_MODES)) {
    throw new Error("지원하지 않는 Hash 모드입니다.");
  }
  return numericMode as SupportedHashMode;
}

export function buildHashcatJobArguments(
  request: ValidatedJobRequest,
  paths: { hashes: string; candidates: string; output: string },
): string[] {
  return [
    "-m",
    String(request.mode),
    "-a",
    "0",
    paths.hashes,
    paths.candidates,
    "-D",
    request.deviceType === "gpu" ? "2" : "1",
    "--outfile",
    paths.output,
    "--outfile-format",
    "1,2",
    "--potfile-disable",
    "--restore-disable",
    "--status-json",
    "--status-timer",
    "1",
    "--quiet",
  ];
}

export function buildHashcatBenchmarkArguments(
  mode: SupportedHashMode,
  deviceType: "gpu" | "cpu",
): string[] {
  return [
    "-b",
    "-m",
    String(mode),
    "-D",
    deviceType === "gpu" ? "2" : "1",
    "--machine-readable",
  ];
}

function normalizeLines(value: string): string[] {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.length > 0);
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
