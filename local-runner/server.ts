import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, chmod } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  RunnerBenchmarkResult,
  RunnerJob,
  RunnerJobProgress,
  RunnerStatus,
} from "../lib/runner/types";
import {
  HASH_MODES,
  JOB_TIMEOUT_MS,
  MAX_RESULTS,
  buildHashcatBenchmarkArguments,
  buildHashcatJobArguments,
  validateHashMode,
  validateJobRequest,
  type ValidatedJobRequest,
} from "./validation";

const RUNNER_VERSION = "1.0.0";
const PORT = parsePort(process.env.HASHCAT_RUNNER_PORT);
const BIND_ADDRESS = "127.0.0.1";
const HASHCAT_BINARY = process.env.HASHCAT_BINARY || "hashcat";
const REQUEST_LIMIT_BYTES = 1_200_000;
const OUTPUT_LIMIT_BYTES = 200_000;
const RESULT_TTL_MS = 30 * 60 * 1_000;
const runnerToken = resolveRunnerToken(process.env.HASHCAT_RUNNER_TOKEN);
const allowedOrigins = new Set(
  (process.env.HASHCAT_RUNNER_ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);

interface InternalJob extends RunnerJob {
  process: ChildProcess | null;
  tempDirectory: string | null;
  outputPath: string | null;
  timeout: NodeJS.Timeout | null;
}

interface ProcessResult {
  code: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

const jobs = new Map<string, InternalJob>();
let activeJobId: string | null = null;
let benchmarkRunning = false;
let probeCache: { expiresAt: number; status: RunnerStatus } | null = null;

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error: unknown) => {
    if (error instanceof HttpError) {
      sendJson(response, error.statusCode, { error: error.message }, request.headers.origin);
      return;
    }
    console.error("[hashcat-runner] request failed", error);
    sendJson(response, 500, { error: "로컬 실행기 오류가 발생했습니다." }, request.headers.origin);
  });
});

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

server.listen(PORT, BIND_ADDRESS, () => {
  console.log(`[hashcat-runner] http://${BIND_ADDRESS}:${PORT}`);
  console.log(`[hashcat-runner] token: ${runnerToken}`);
  console.log("[hashcat-runner] 승인된 로컬 데이터에만 사용하세요.");
});

server.on("error", (error) => {
  console.error(`[hashcat-runner] ${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    for (const job of jobs.values()) {
      if (job.process && job.state === "running") job.process.kill("SIGTERM");
    }
    server.close(() => process.exit(0));
  });
}

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const origin = request.headers.origin;
  if (!isAllowedHost(request.headers.host)) {
    sendJson(response, 400, { error: "허용되지 않은 Host입니다." }, origin);
    return;
  }
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: "허용되지 않은 Origin입니다." });
    return;
  }
  if (request.method === "OPTIONS") {
    sendEmpty(response, 204, origin);
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/v1/status") {
    sendJson(response, 200, await probeHashcat(), origin);
    return;
  }

  if (!isAuthorized(request.headers.authorization)) {
    sendJson(response, 401, { error: "로컬 실행 토큰이 올바르지 않습니다." }, origin);
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/benchmark") {
    ensureJsonRequest(request);
    if (hasActiveWork()) {
      sendJson(response, 409, { error: "다른 Hashcat 작업이 실행 중입니다." }, origin);
      return;
    }
    const body = await readJsonBody(request);
    const mode = validateClientInput(() => validateHashMode((body as { mode?: unknown }).mode));
    const deviceType = (body as { deviceType?: unknown }).deviceType === "cpu" ? "cpu" : "gpu";
    benchmarkRunning = true;
    try {
      const result = await runHashcat(
        buildHashcatBenchmarkArguments(mode, deviceType),
        2 * 60 * 1_000,
      );
      if (result.code !== 0) {
        throw new HttpError(
          422,
          sanitizeLog(result.stderr || result.stdout) || "Benchmark 실행에 실패했습니다.",
        );
      }
      const payload: RunnerBenchmarkResult = {
        mode,
        deviceType,
        output: sanitizeBenchmarkOutput(result.stdout),
        durationMs: result.durationMs,
      };
      sendJson(response, 200, payload, origin);
    } finally {
      benchmarkRunning = false;
    }
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/jobs") {
    ensureJsonRequest(request);
    if (hasActiveWork()) {
      sendJson(response, 409, { error: "동시에 하나의 작업만 실행할 수 있습니다." }, origin);
      return;
    }
    const body = await readJsonBody(request);
    const validated = validateClientInput(() => validateJobRequest(body));
    const job = await createJob(validated);
    sendJson(response, 202, toPublicJob(job), origin);
    return;
  }

  const jobMatch = /^\/v1\/jobs\/([0-9a-f-]{36})$/.exec(url.pathname);
  if (jobMatch && request.method === "GET") {
    const job = jobs.get(jobMatch[1]);
    if (!job) {
      sendJson(response, 404, { error: "작업을 찾을 수 없습니다." }, origin);
      return;
    }
    sendJson(response, 200, toPublicJob(job), origin);
    return;
  }
  if (jobMatch && request.method === "DELETE") {
    const job = jobs.get(jobMatch[1]);
    if (!job) {
      sendJson(response, 404, { error: "작업을 찾을 수 없습니다." }, origin);
      return;
    }
    if (job.state === "running" || job.state === "queued") {
      job.state = "cancelled";
      job.message = "사용자가 작업을 중지했습니다.";
      if (job.process) terminateChild(job.process);
    } else {
      jobs.delete(job.id);
    }
    sendEmpty(response, 204, origin);
    return;
  }

  sendJson(response, 404, { error: "지원하지 않는 경로입니다." }, origin);
}

async function createJob(request: ValidatedJobRequest): Promise<InternalJob> {
  const id = randomUUID();
  const job: InternalJob = {
    id,
    state: "queued",
    mode: request.mode,
    deviceType: request.deviceType,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    progress: null,
    results: [],
    message: "실행 준비 중",
    logs: [],
    process: null,
    tempDirectory: null,
    outputPath: null,
    timeout: null,
  };
  jobs.set(id, job);
  activeJobId = id;
  void executeJob(job, request);
  return job;
}

async function executeJob(job: InternalJob, request: ValidatedJobRequest) {
  try {
    const directory = await mkdtemp(join(tmpdir(), "hashcat-web-utils-"));
    await chmod(directory, 0o700);
    const hashPath = join(directory, "hashes.txt");
    const candidatePath = join(directory, "candidates.txt");
    const outputPath = join(directory, "results.txt");
    job.tempDirectory = directory;
    job.outputPath = outputPath;
    await Promise.all([
      writeFile(hashPath, `${request.hashes.join("\n")}\n`, { encoding: "utf8", mode: 0o600 }),
      writeFile(candidatePath, `${request.candidates.join("\n")}\n`, { encoding: "utf8", mode: 0o600 }),
    ]);

    if (job.state === "cancelled") {
      await finalizeJob(job, null, "");
      return;
    }

    job.state = "running";
    job.startedAt = new Date().toISOString();
    job.message = `${HASH_MODES[request.mode].label} ${request.deviceType.toUpperCase()} 작업 실행 중`;

    const child = spawn(
      HASHCAT_BINARY,
      buildHashcatJobArguments(request, {
        hashes: hashPath,
        candidates: candidatePath,
        output: outputPath,
      }),
      {
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, LC_ALL: "C" },
      },
    );
    job.process = child;
    job.timeout = setTimeout(() => {
      if (job.state === "running") {
        job.state = "failed";
        job.message = "5분 실행 제한을 초과해 중지했습니다.";
        terminateChild(child);
      }
    }, JOB_TIMEOUT_MS);
    job.timeout.unref();

    let stdoutBuffer = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || "";
      for (const line of lines) consumeStatusLine(job, line);
    });
    child.stderr.on("data", (chunk: string) => appendLogs(job, chunk));
    child.once("error", (error) => {
      if (job.state !== "cancelled") {
        job.state = "failed";
        job.message = error.message.includes("ENOENT")
          ? "Hashcat이 설치되어 있지 않거나 실행 경로를 찾을 수 없습니다."
          : "Hashcat 프로세스를 시작하지 못했습니다.";
      }
    });
    child.once("close", (code) => void finalizeJob(job, code, stdoutBuffer));
  } catch (error) {
    job.state = "failed";
    job.message = error instanceof Error ? error.message : "작업 준비에 실패했습니다.";
    await finalizeJob(job, null, "");
  }
}

async function finalizeJob(job: InternalJob, code: number | null, remainingOutput: string) {
  if (job.finishedAt) return;
  if (remainingOutput) consumeStatusLine(job, remainingOutput);
  if (job.timeout) clearTimeout(job.timeout);
  job.timeout = null;
  job.process = null;

  if (job.outputPath) {
    try {
      const output = await readFile(job.outputPath, "utf8");
      job.results = output
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .filter(Boolean)
        .slice(0, MAX_RESULTS);
    } catch {
      job.results = [];
    }
  }

  if (job.state === "running" || job.state === "queued") {
    if (code === 0) {
      job.state = "completed";
      job.message = `${job.results.length.toLocaleString("ko-KR")}개 결과를 찾았습니다.`;
    } else if (code === 1) {
      job.state = "completed";
      job.message = "후보 목록을 모두 확인했습니다.";
    } else {
      job.state = "failed";
      job.message = `Hashcat이 종료 코드 ${code ?? "unknown"}로 종료되었습니다.`;
    }
  }
  job.finishedAt = new Date().toISOString();
  activeJobId = activeJobId === job.id ? null : activeJobId;
  await cleanupJobFiles(job);
  const expiry = setTimeout(() => jobs.delete(job.id), RESULT_TTL_MS);
  expiry.unref();
}

async function cleanupJobFiles(job: InternalJob) {
  if (!job.tempDirectory) return;
  const directory = job.tempDirectory;
  job.tempDirectory = null;
  job.outputPath = null;
  await rm(directory, { recursive: true, force: true });
}

function consumeStatusLine(job: InternalJob, value: string) {
  const line = value.trim();
  if (!line) return;
  if (line.startsWith("{") && line.endsWith("}")) {
    try {
      const status = JSON.parse(line) as Record<string, unknown>;
      job.progress = parseProgress(status);
      return;
    } catch {
      appendLogs(job, line);
      return;
    }
  }
  appendLogs(job, line);
}

function parseProgress(status: Record<string, unknown>): RunnerJobProgress | null {
  const progress = Array.isArray(status.progress) ? status.progress : null;
  if (!progress || progress.length < 2) return null;
  const current = Number(progress[0]);
  const total = Number(progress[1]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total <= 0) return null;
  const recovered = Array.isArray(status.recovered_hashes)
    ? Number(status.recovered_hashes[0])
    : Number(status.recovered_hashes || 0);
  const devices = Array.isArray(status.devices) ? status.devices : [];
  const speed = devices.reduce((sum, device) => {
    if (!device || typeof device !== "object") return sum;
    return sum + Number((device as { speed?: unknown }).speed || 0);
  }, 0);
  return {
    current,
    total,
    percent: Math.min(100, Math.max(0, (current / total) * 100)),
    recovered: Number.isFinite(recovered) ? recovered : 0,
    speed: Number.isFinite(speed) ? speed : 0,
  };
}

function appendLogs(job: InternalJob, value: string) {
  const sanitized = sanitizeLog(value, job.tempDirectory || undefined);
  if (!sanitized) return;
  for (const line of sanitized.split(/\r?\n/).filter(Boolean)) {
    job.logs.push(line.slice(0, 1_000));
  }
  job.logs = job.logs.slice(-40);
}

async function probeHashcat(): Promise<RunnerStatus> {
  if (probeCache && probeCache.expiresAt > Date.now()) {
    return { ...probeCache.status, activeJob: hasActiveWork() };
  }
  try {
    const [versionResult, deviceResult] = await Promise.all([
      runHashcat(["--version"], 15_000),
      runHashcat(["-I"], 30_000),
    ]);
    const available = versionResult.code === 0;
    const devices = sanitizeLog(deviceResult.stdout || deviceResult.stderr).slice(0, 12_000);
    const status: RunnerStatus = {
      available,
      version: available ? versionResult.stdout.trim().slice(0, 100) : null,
      devices,
      gpuDetected: /(?:Type[^\n]*GPU|Metal|Radeon|AMD)/i.test(devices),
      activeJob: hasActiveWork(),
      runnerVersion: RUNNER_VERSION,
    };
    probeCache = { expiresAt: Date.now() + 10_000, status };
    return status;
  } catch {
    return {
      available: false,
      version: null,
      devices: "Hashcat 실행 파일을 찾을 수 없습니다.",
      gpuDetected: false,
      activeJob: hasActiveWork(),
      runnerVersion: RUNNER_VERSION,
    };
  }
}

function runHashcat(argumentsList: string[], timeoutMs: number): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(HASHCAT_BINARY, argumentsList, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, LC_ALL: "C" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeoutMessage: string | undefined;
    const timeout = setTimeout(() => {
      timeoutMessage = "Hashcat 실행 시간이 제한을 초과했습니다.";
      terminateChild(child);
    }, timeoutMs);
    timeout.unref();

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout = `${stdout}${chunk}`.slice(-OUTPUT_LIMIT_BYTES);
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = `${stderr}${chunk}`.slice(-OUTPUT_LIMIT_BYTES);
    });
    child.once("error", (error) => finish(error));
    child.once("close", (code) => finish(null, timeoutMessage, code));

    function finish(error: Error | null, timeoutMessage?: string, code: number | null = null) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) {
        reject(error);
        return;
      }
      resolve({
        code,
        stdout,
        stderr: timeoutMessage || stderr,
        durationMs: Date.now() - startedAt,
      });
    }
  });
}

function toPublicJob(job: InternalJob): RunnerJob {
  return {
    id: job.id,
    state: job.state,
    mode: job.mode,
    deviceType: job.deviceType,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    progress: job.progress,
    results: [...job.results],
    message: job.message,
    logs: [...job.logs],
  };
}

function hasActiveWork() {
  const job = activeJobId ? jobs.get(activeJobId) : null;
  return benchmarkRunning || Boolean(job && !job.finishedAt);
}

function terminateChild(child: ChildProcess) {
  child.kill("SIGTERM");
  const forceKill = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, 2_000);
  forceKill.unref();
}

function sanitizeBenchmarkOutput(value: string): string {
  return sanitizeLog(value)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(-80)
    .join("\n");
}

function sanitizeLog(value: string, temporaryDirectory?: string): string {
  let sanitized = value.trim();
  if (temporaryDirectory) sanitized = sanitized.replaceAll(temporaryDirectory, "[temporary-directory]");
  return sanitized.replace(/\b[0-9a-f]{24,}\b/gi, "[hash]");
}

function ensureJsonRequest(request: IncomingMessage) {
  if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type은 application/json이어야 합니다.");
  }
}

function validateClientInput<T>(validator: () => T): T {
  try {
    return validator();
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "요청 본문이 올바르지 않습니다.",
    );
  }
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      size += Buffer.byteLength(chunk);
      if (size > REQUEST_LIMIT_BYTES) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    request.once("end", () => {
      if (tooLarge) {
        reject(new HttpError(413, "요청 크기가 1.2 MB 제한을 초과했습니다."));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new HttpError(400, "JSON 요청을 해석할 수 없습니다."));
      }
    });
    request.once("error", reject);
  });
}

function isAuthorized(value: string | undefined): boolean {
  if (!value?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(value.slice(7));
  const expected = Buffer.from(runnerToken);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function isAllowedHost(value: string | undefined): boolean {
  return value === `127.0.0.1:${PORT}` || value === `localhost:${PORT}`;
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
  origin?: string,
) {
  const body = JSON.stringify(payload);
  setResponseHeaders(response, origin);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

function sendEmpty(response: ServerResponse, statusCode: number, origin?: string) {
  setResponseHeaders(response, origin);
  response.writeHead(statusCode);
  response.end();
}

function setResponseHeaders(response: ServerResponse, origin?: string) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Vary", "Origin");
  }
}

function resolveRunnerToken(value: string | undefined): string {
  if (!value) return randomBytes(24).toString("hex");
  if (value.length < 32) throw new Error("HASHCAT_RUNNER_TOKEN은 32자 이상이어야 합니다.");
  return value;
}

function parsePort(value: string | undefined): number {
  const port = value ? Number(value) : 8789;
  if (!Number.isInteger(port) || port < 1_024 || port > 65_535) {
    throw new Error("HASHCAT_RUNNER_PORT는 1024-65535 범위여야 합니다.");
  }
  return port;
}
