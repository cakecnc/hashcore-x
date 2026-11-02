"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { copyText } from "@/lib/download";
import type {
  RunnerBenchmarkResult,
  RunnerJob,
  RunnerJobRequest,
  RunnerStatus,
} from "@/lib/runner/types";

const DEFAULT_RUNNER_URL = "http://127.0.0.1:8789";
const sampleHash = "0976292bd16a98e329d7e0e33a2d0494";
const sampleCandidates = "browser-demo\nhashcat-demo-2026\nlocal-recovery";
const modes = [
  { value: 0, label: "MD5 (0)", length: 32 },
  { value: 100, label: "SHA-1 (100)", length: 40 },
  { value: 1000, label: "NTLM (1000)", length: 32 },
  { value: 1400, label: "SHA-256 (1400)", length: 64 },
  { value: 1700, label: "SHA-512 (1700)", length: 128 },
] as const;

export function HashcatRunnerClient() {
  const [token, setToken] = useState("");
  const [runnerStatus, setRunnerStatus] = useState<RunnerStatus | null>(null);
  const [connectionMessage, setConnectionMessage] = useState("로컬 실행기 연결을 확인해 주세요.");
  const [mode, setMode] = useState(0);
  const [deviceType, setDeviceType] = useState<"gpu" | "cpu">("gpu");
  const [hashes, setHashes] = useState("");
  const [candidates, setCandidates] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [job, setJob] = useState<RunnerJob | null>(null);
  const [benchmark, setBenchmark] = useState<RunnerBenchmarkResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("입력을 준비하고 실행해 주세요.");

  const selectedMode = useMemo(
    () => modes.find((item) => item.value === mode) ?? modes[0],
    [mode],
  );
  const jobId = job?.id;
  const isRunning = job?.state === "queued" || job?.state === "running";

  useEffect(() => {
    const parameters = new URLSearchParams(window.location.hash.slice(1));
    const nativeToken = parameters.get("token");
    const nativeRunnerURL = parameters.get("runner");
    if (nativeToken) setToken(nativeToken);
    if (nativeRunnerURL?.startsWith("http://127.0.0.1:")) {
      (window as typeof window & { __HASHCORE_RUNNER_URL?: string }).__HASHCORE_RUNNER_URL =
        nativeRunnerURL;
    }
    if (nativeToken || nativeRunnerURL) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await runnerRequest<RunnerStatus>("/v1/status");
      setRunnerStatus(status);
      setConnectionMessage(
        status.available
          ? `${status.version ?? "Hashcat"} · ${status.gpuDetected ? "GPU 감지됨" : "GPU 미감지"}`
          : "실행기는 연결됐지만 Hashcat을 찾을 수 없습니다.",
      );
    } catch {
      setRunnerStatus(null);
      setConnectionMessage("로컬 실행기에 연결할 수 없습니다. pnpm dev 또는 pnpm runner를 실행하세요.");
    }
  }, []);

  const refreshJob = useCallback(async (jobId: string, sessionToken: string) => {
    try {
      const nextJob = await runnerRequest<RunnerJob>(`/v1/jobs/${jobId}`, {}, sessionToken);
      setJob(nextJob);
      setMessage(nextJob.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업 상태를 확인할 수 없습니다.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshStatus]);

  useEffect(() => {
    if (!jobId || !isRunning || !token) return;
    const timer = window.setInterval(() => void refreshJob(jobId, token), 1_000);
    return () => window.clearInterval(timer);
  }, [isRunning, jobId, refreshJob, token]);

  const loadSample = () => {
    setMode(0);
    setHashes(sampleHash);
    setCandidates(sampleCandidates);
    setJob(null);
    setBenchmark(null);
    setMessage("무해한 로컬 검증 Sample을 불러왔습니다.");
  };

  const runBenchmark = async () => {
    if (!token || !acknowledged) {
      setMessage("로컬 실행 토큰과 승인 확인이 필요합니다.");
      return;
    }
    setBusy(true);
    setBenchmark(null);
    setMessage(`${selectedMode.label} ${deviceType.toUpperCase()} Benchmark 실행 중…`);
    try {
      const result = await runnerRequest<RunnerBenchmarkResult>(
        "/v1/benchmark",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode, deviceType }),
        },
        token,
      );
      setBenchmark(result);
      setMessage(`Benchmark를 ${result.durationMs.toLocaleString("ko-KR")} ms에 완료했습니다.`);
      await refreshStatus();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Benchmark에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const runJob = async () => {
    if (!token) {
      setMessage("로컬 실행 토큰을 입력해 주세요.");
      return;
    }
    const payload: RunnerJobRequest = { mode, deviceType, hashes, candidates, acknowledged };
    setBusy(true);
    setJob(null);
    setBenchmark(null);
    setMessage("Hashcat 작업을 준비 중…");
    try {
      const nextJob = await runnerRequest<RunnerJob>(
        "/v1/jobs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        token,
      );
      setJob(nextJob);
      setMessage(nextJob.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hashcat 작업을 시작할 수 없습니다.");
    } finally {
      setBusy(false);
    }
  };

  const stopOrClearJob = async () => {
    if (!job || !token) return;
    try {
      await runnerRequest(`/v1/jobs/${job.id}`, { method: "DELETE" }, token);
      if (isRunning) {
        setMessage("중지 요청을 전송했습니다.");
        await refreshJob(job.id, token);
      } else {
        setJob(null);
        setMessage("민감한 작업 결과를 로컬 실행기 메모리에서 지웠습니다.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "작업을 정리할 수 없습니다.");
    }
  };

  const resultText = job?.results.join("\n") ?? "";

  const copyResults = async () => {
    try {
      await copyText(resultText);
      setMessage("복구 결과를 Clipboard에 복사했습니다.");
    } catch {
      setMessage("Clipboard에 복사할 수 없습니다.");
    }
  };

  return (
    <section className="runner-page" aria-labelledby="runner-heading">
      <div className="runner-heading">
        <div>
          <span className="eyebrow">LOCAL HASHCAT BRIDGE</span>
          <h1 id="runner-heading">로컬 GPU Runner</h1>
          <p>원격 서버나 임의 Shell 없이, 이 Mac의 Hashcat 바이너리만 제한 실행합니다.</p>
        </div>
        <div className={runnerStatus?.available ? "runner-health is-ready" : "runner-health"}>
          <span aria-hidden="true" />
          <div><strong>{runnerStatus?.available ? "Runner 준비됨" : "Runner 확인 필요"}</strong><small>{connectionMessage}</small></div>
          <button type="button" onClick={() => void refreshStatus()}>다시 확인</button>
        </div>
      </div>

      <aside className="runner-warning" aria-label="승인 및 로컬 실행 안내">
        <strong>승인된 복구·감사 작업만 허용</strong>
        <p>입력 원문과 결과는 History 또는 서버 저장소에 남기지 않습니다. 실행기는 Loopback에만 바인딩되고 한 번에 한 작업만 처리합니다.</p>
      </aside>

      <div className="runner-grid">
        <section className="runner-card runner-setup" aria-labelledby="runner-setup-heading">
          <div className="panel-heading"><div><span>01</span><h2 id="runner-setup-heading">실행 환경</h2></div></div>
          <label className="field-label">
            로컬 실행 토큰
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Runner 터미널에 표시된 token"
              autoComplete="off"
            />
          </label>
          <p className="runner-help">토큰은 현재 탭 메모리에만 유지되며 브라우저 저장소에 기록하지 않습니다.</p>
          <div className="runner-option-row">
            <label className="field-label">Hash 모드<select value={mode} onChange={(event) => setMode(Number(event.target.value))}>{modes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="field-label">장치<select value={deviceType} onChange={(event) => setDeviceType(event.target.value as "gpu" | "cpu")}><option value="gpu">GPU</option><option value="cpu">CPU</option></select></label>
          </div>
          <dl className="runner-limits">
            <div><dt>Hash 형식</dt><dd>{selectedMode.length}자리 Hex</dd></div>
            <div><dt>동시 작업</dt><dd>1개</dd></div>
            <div><dt>시간 제한</dt><dd>5분</dd></div>
          </dl>
          {runnerStatus?.devices ? (
            <details className="runner-devices"><summary>감지된 Backend 장치</summary><pre>{runnerStatus.devices}</pre></details>
          ) : null}
          <button className="button button-secondary runner-benchmark" type="button" disabled={busy || isRunning || !runnerStatus?.available} onClick={() => void runBenchmark()}>
            {busy ? "실행 중…" : `${deviceType.toUpperCase()} Benchmark`}
          </button>
        </section>

        <section className="runner-card runner-inputs" aria-labelledby="runner-input-heading">
          <div className="panel-heading"><div><span>02</span><h2 id="runner-input-heading">Hash와 후보 목록</h2></div><button className="text-button" type="button" onClick={loadSample}>검증 Sample</button></div>
          <label className="field-label runner-textarea-label">Hash 목록<textarea value={hashes} onChange={(event) => setHashes(event.target.value)} placeholder={`한 줄에 ${selectedMode.length}자리 Hex Hash 하나`} spellCheck={false} /></label>
          <div className="runner-counter">{hashes.split(/\r?\n/).filter(Boolean).length.toLocaleString("ko-KR")}개 · 최대 64 KB</div>
          <label className="field-label runner-textarea-label">후보 목록<textarea value={candidates} onChange={(event) => setCandidates(event.target.value)} placeholder="한 줄에 후보 문자열 하나" spellCheck={false} /></label>
          <div className="runner-counter">{candidates.split(/\r?\n/).filter(Boolean).length.toLocaleString("ko-KR")}개 · 최대 1 MB</div>
          <label className="runner-acknowledgement">
            <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} />
            <span>이 데이터의 소유자이거나 명시적인 테스트 승인을 받았습니다.</span>
          </label>
          <button className="button button-primary runner-run" type="button" disabled={busy || isRunning || !runnerStatus?.available || !acknowledged} onClick={() => void runJob()}>
            {isRunning ? "Hashcat 실행 중…" : "Hashcat 실행"} <span aria-hidden="true">→</span>
          </button>
        </section>

        <section className="runner-card runner-results" aria-labelledby="runner-results-heading">
          <div className="panel-heading"><div><span>03</span><h2 id="runner-results-heading">실행 상태</h2></div>{job ? <span className={`runner-state state-${job.state}`}>{runnerStateLabel(job.state)}</span> : null}</div>
          <div className="run-status" role="status" aria-live="polite"><span aria-hidden="true" />{message}</div>
          {job?.progress ? (
            <div className="runner-progress">
              <div><span style={{ width: `${job.progress.percent}%` }} /></div>
              <p><strong>{job.progress.percent.toFixed(1)}%</strong><span>{job.progress.current.toLocaleString("ko-KR")} / {job.progress.total.toLocaleString("ko-KR")}</span></p>
            </div>
          ) : null}
          {benchmark ? (
            <div className="runner-output-block"><div><strong>Benchmark 결과</strong><span>{benchmark.durationMs.toLocaleString("ko-KR")} ms</span></div><pre tabIndex={0}>{benchmark.output}</pre></div>
          ) : null}
          {job ? (
            <>
              <div className="runner-result-summary"><div><span>결과</span><strong>{job.results.length.toLocaleString("ko-KR")}</strong></div><div><span>장치</span><strong>{job.deviceType.toUpperCase()}</strong></div><div><span>모드</span><strong>{job.mode}</strong></div></div>
              <div className="runner-output-block"><div><strong>복구 결과</strong>{resultText ? <button type="button" onClick={() => void copyResults()}>복사</button> : null}</div><pre tabIndex={0}>{resultText || "일치하는 후보가 아직 없습니다."}</pre></div>
              {job.logs.length ? <details className="runner-logs"><summary>제한된 실행 로그</summary><pre>{job.logs.join("\n")}</pre></details> : null}
              <button className="button button-secondary runner-clear" type="button" onClick={() => void stopOrClearJob()}>{isRunning ? "작업 중지" : "민감 결과 지우기"}</button>
            </>
          ) : benchmark ? null : (
            <div className="result-empty"><span aria-hidden="true">GPU</span><h3>실행 결과가 여기에 표시됩니다</h3><p>환경을 확인하고 승인된 Sample 또는 로컬 데이터를 실행하세요.</p></div>
          )}
        </section>
      </div>
    </section>
  );
}

async function runnerRequest<T>(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const nativeRunnerURL =
    typeof window === "undefined"
      ? undefined
      : (window as typeof window & { __HASHCORE_RUNNER_URL?: string }).__HASHCORE_RUNNER_URL;
  const response = await fetch(`${nativeRunnerURL ?? DEFAULT_RUNNER_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Runner 요청 실패 (${response.status})`);
  return payload;
}

function runnerStateLabel(state: RunnerJob["state"]): string {
  if (state === "queued") return "준비";
  if (state === "running") return "실행 중";
  if (state === "completed") return "완료";
  if (state === "cancelled") return "중지";
  return "실패";
}
