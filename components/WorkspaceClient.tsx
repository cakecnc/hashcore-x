"use client";

import { useMemo, useRef, useState } from "react";
import { copyText, createCsv, createResultFilename, downloadTextFile } from "@/lib/download";
import { saveHistory, type HistoryRecord } from "@/lib/history";
import {
  LARGE_JOB_WARNING_ITEMS,
  MAX_INPUT_BYTES,
  formatBytes,
  getUtf8ByteLength,
} from "@/lib/limits";
import { getTool, tools } from "@/lib/tools/catalog";
import { runUtilityInWorker } from "@/lib/tools/client-runner";
import { estimateUtilityOutput } from "@/lib/tools";
import type { ToolId, UtilityOptions, UtilityResult } from "@/lib/tools/types";

const defaultOptions: UtilityOptions = {
  trimLines: true,
  collapseWhitespace: true,
  removeBlankLines: true,
  caseSensitive: true,
  ignoreBlankLines: true,
  minimum: 1,
  maximum: 64,
  query: "2026",
  mode: "include",
  secondaryInput: "01\n02\n안전",
  separator: "-",
  maximumResults: 5_000,
};

type RunStatus = "idle" | "warning" | "running" | "success" | "error";

export function WorkspaceClient({ initialToolId }: { initialToolId: ToolId }) {
  const [toolId, setToolId] = useState<ToolId>(initialToolId);
  const [input, setInput] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [options, setOptions] = useState<UtilityOptions>(defaultOptions);
  const [result, setResult] = useState<UtilityResult | null>(null);
  const [status, setStatus] = useState<RunStatus>("idle");
  const [message, setMessage] = useState("입력을 준비하고 실행해 주세요.");
  const [largeEstimate, setLargeEstimate] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tool = useMemo(() => getTool(toolId), [toolId]);
  const inputBytes = getUtf8ByteLength(input);

  const updateOption = (key: string, value: string | number | boolean) => {
    setOptions((current) => ({ ...current, [key]: value }));
    setLargeEstimate(null);
  };

  const changeTool = (nextToolId: ToolId) => {
    setToolId(nextToolId);
    setInput("");
    setFileName(null);
    setResult(null);
    setStatus("idle");
    setMessage("입력을 준비하고 실행해 주세요.");
    setLargeEstimate(null);
  };

  const loadSample = () => {
    setInput(tool.sample);
    if (toolId === "combine") {
      setOptions((current) => ({ ...current, secondaryInput: "01\n02\n안전" }));
    }
    setFileName(null);
    setResult(null);
    setLargeEstimate(null);
    setStatus("idle");
    setMessage("Sample Data를 불러왔습니다.");
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_INPUT_BYTES) {
      setStatus("error");
      setMessage(`파일이 ${formatBytes(MAX_INPUT_BYTES)} 제한을 초과했습니다.`);
      return;
    }
    try {
      const text = await file.text();
      if (getUtf8ByteLength(text) > MAX_INPUT_BYTES) throw new Error("UTF-8 변환 후 입력 제한을 초과했습니다.");
      setInput(text);
      setFileName(file.name);
      setResult(null);
      setLargeEstimate(null);
      setStatus("idle");
      setMessage(`${file.name} 파일을 불러왔습니다.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "파일을 읽을 수 없습니다.");
    }
  };

  const persist = (record: HistoryRecord) => {
    try {
      saveHistory(window.localStorage, record);
    } catch {
      setMessage("작업은 완료했지만 이 브라우저에서 기록 메타데이터를 저장할 수 없습니다.");
    }
  };

  const execute = async (confirmed = false) => {
    if (!input.trim()) {
      setStatus("error");
      setMessage("처리할 텍스트 또는 파일을 입력해 주세요.");
      return;
    }
    if (inputBytes > MAX_INPUT_BYTES) {
      setStatus("error");
      setMessage(`입력 크기가 ${formatBytes(MAX_INPUT_BYTES)} 제한을 초과했습니다.`);
      return;
    }

    const estimate = estimateUtilityOutput(toolId, input, options);
    if (estimate > LARGE_JOB_WARNING_ITEMS && !confirmed) {
      setLargeEstimate(estimate);
      setStatus("warning");
      setMessage(`예상 결과 ${estimate.toLocaleString("ko-KR")}개입니다. 제한을 확인한 뒤 계속 실행하세요.`);
      return;
    }

    setLargeEstimate(null);
    setStatus("running");
    setMessage(`${tool.name} 처리 중…`);
    const startedAt = performance.now();

    try {
      const nextResult = await runUtilityInWorker({ toolId, input, options });
      setResult(nextResult);
      setStatus("success");
      setMessage(`${nextResult.outputCount.toLocaleString("ko-KR")}개 결과를 생성했습니다.`);
      persist({
        id: crypto.randomUUID(),
        toolId,
        toolName: tool.name,
        createdAt: new Date().toISOString(),
        status: "completed",
        inputCount: nextResult.inputCount,
        outputCount: nextResult.outputCount,
        durationMs: nextResult.durationMs,
      });
    } catch (error) {
      setResult(null);
      setStatus("error");
      const errorMessage = error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.";
      setMessage(errorMessage);
      persist({
        id: crypto.randomUUID(),
        toolId,
        toolName: tool.name,
        createdAt: new Date().toISOString(),
        status: "failed",
        inputCount: input.split(/\r?\n/).filter(Boolean).length,
        outputCount: 0,
        durationMs: performance.now() - startedAt,
      });
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await copyText(result.text);
      setStatus("success");
      setMessage("결과를 Clipboard에 복사했습니다.");
    } catch {
      setStatus("error");
      setMessage("Clipboard 권한을 확인해 주세요.");
    }
  };

  const download = (format: "txt" | "csv") => {
    if (!result) return;
    const content = format === "csv" ? createCsv(result.csvRows) : result.text;
    downloadTextFile(
      content,
      createResultFilename(toolId, format),
      format === "csv" ? "text/csv" : "text/plain",
    );
    setStatus("success");
    setMessage(`${format.toUpperCase()} 파일 저장을 시작했습니다.`);
  };

  return (
    <section className="workspace-page" aria-labelledby="workspace-heading">
      <div className="workspace-header">
        <div>
          <span className="eyebrow">LOCAL WORKBENCH</span>
          <h1 id="workspace-heading">워크스페이스</h1>
          <p>데이터는 서버로 전송되지 않으며 현재 탭에서만 처리됩니다.</p>
        </div>
        <label className="tool-select-label">
          <span>현재 도구</span>
          <select value={toolId} onChange={(event) => changeTool(event.target.value as ToolId)}>
            {tools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      </div>

      <div className="workspace-grid">
        <section className="workspace-panel input-panel" aria-labelledby="input-heading">
          <div className="panel-heading">
            <div><span>01</span><h2 id="input-heading">입력</h2></div>
            <button className="text-button" type="button" onClick={loadSample}>Sample Data</button>
          </div>
          <div className="file-drop">
            <input
              ref={fileInputRef}
              className="visually-hidden"
              type="file"
              accept=".txt,.csv,text/plain,text/csv"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            <span aria-hidden="true">⇧</span>
            <p>{fileName ? <strong>{fileName}</strong> : "TXT 또는 CSV 파일을 선택하세요"}</p>
            <button className="button button-secondary" type="button" onClick={() => fileInputRef.current?.click()}>
              파일 선택
            </button>
            <small>UTF-8 · 최대 {formatBytes(MAX_INPUT_BYTES)}</small>
          </div>
          <div className="input-divider"><span>또는 텍스트 입력</span></div>
          <label className="textarea-label">
            <span className="visually-hidden">처리할 텍스트</span>
            <textarea
              value={input}
              onChange={(event) => {
                setInput(event.target.value);
                setFileName(null);
                setResult(null);
                setLargeEstimate(null);
              }}
              placeholder="한 줄에 한 항목씩 입력하세요"
              spellCheck={false}
            />
          </label>
          <div className={inputBytes > MAX_INPUT_BYTES ? "input-meter is-over" : "input-meter"}>
            <span>{input.split(/\r?\n/).filter(Boolean).length.toLocaleString("ko-KR")}개 항목</span>
            <span>{formatBytes(inputBytes)} / {formatBytes(MAX_INPUT_BYTES)}</span>
          </div>
        </section>

        <section className="workspace-panel option-panel" aria-labelledby="option-heading">
          <div className="panel-heading">
            <div><span>02</span><h2 id="option-heading">옵션</h2></div>
          </div>
          <div className="selected-tool-summary">
            <span className={`category-badge category-${tool.category.toLowerCase()}`}>{tool.category}</span>
            <h3>{tool.name}</h3>
            <p>{tool.description}</p>
          </div>
          <ToolOptions toolId={toolId} options={options} updateOption={updateOption} />
          <div className="execution-card">
            <span className="execution-indicator" aria-hidden="true" />
            <div><strong>브라우저 내 실행</strong><small>Web Worker · 서버 전송 없음</small></div>
          </div>
          {largeEstimate ? (
            <div className="large-job-warning" role="alert">
              <strong>대용량 작업 확인</strong>
              <p>예상 {largeEstimate.toLocaleString("ko-KR")}개이며 결과는 안전 한도에서 잘릴 수 있습니다.</p>
              <button className="button button-warning" type="button" onClick={() => void execute(true)}>계속 실행</button>
            </div>
          ) : (
            <button className="button button-primary run-button" type="button" onClick={() => void execute()} disabled={status === "running"}>
              {status === "running" ? "처리 중…" : "Utility 실행"} <span aria-hidden="true">→</span>
            </button>
          )}
        </section>

        <section className="workspace-panel result-panel" aria-labelledby="result-heading">
          <div className="panel-heading">
            <div><span>03</span><h2 id="result-heading">결과</h2></div>
            {result ? <span className="complete-badge">완료</span> : null}
          </div>
          <div className={`run-status status-${status}`} role="status" aria-live="polite">
            <span aria-hidden="true" />
            {message}
          </div>
          {result ? (
            <>
              <dl className="result-stats">
                <div><dt>입력</dt><dd>{result.inputCount.toLocaleString("ko-KR")}</dd></div>
                <div><dt>결과</dt><dd>{result.outputCount.toLocaleString("ko-KR")}</dd></div>
                <div><dt>처리</dt><dd>{result.durationMs.toFixed(1)} ms</dd></div>
              </dl>
              {result.warnings.length ? (
                <ul className="result-warnings">
                  {result.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              ) : null}
              <pre className="result-preview" tabIndex={0}>{result.text || "조건에 맞는 결과가 없습니다."}</pre>
              <div className="result-actions">
                <button className="button button-secondary" type="button" onClick={() => void handleCopy()}>복사</button>
                <button className="button button-secondary" type="button" onClick={() => download("txt")}>TXT 저장</button>
                <button className="button button-secondary" type="button" onClick={() => download("csv")}>CSV 저장</button>
              </div>
            </>
          ) : (
            <div className="result-empty">
              <span aria-hidden="true">{"{ }"}</span>
              <h3>결과가 여기에 표시됩니다</h3>
              <p>입력과 옵션을 확인한 후 Utility를 실행하세요.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function ToolOptions({
  toolId,
  options,
  updateOption,
}: {
  toolId: ToolId;
  options: UtilityOptions;
  updateOption: (key: string, value: string | number | boolean) => void;
}) {
  if (toolId === "clean-lines") {
    return (
      <div className="option-fields">
        <CheckOption label="줄 앞뒤 공백 제거" checked={Boolean(options.trimLines)} onChange={(value) => updateOption("trimLines", value)} />
        <CheckOption label="연속 공백을 하나로" checked={Boolean(options.collapseWhitespace)} onChange={(value) => updateOption("collapseWhitespace", value)} />
        <CheckOption label="빈 줄 제거" checked={Boolean(options.removeBlankLines)} onChange={(value) => updateOption("removeBlankLines", value)} />
      </div>
    );
  }
  if (toolId === "deduplicate") {
    return (
      <div className="option-fields">
        <CheckOption label="빈 줄 무시" checked={Boolean(options.ignoreBlankLines)} onChange={(value) => updateOption("ignoreBlankLines", value)} />
        <details className="advanced-options">
          <summary>고급 옵션</summary>
          <CheckOption label="대소문자 구분" checked={Boolean(options.caseSensitive)} onChange={(value) => updateOption("caseSensitive", value)} />
        </details>
      </div>
    );
  }
  if (toolId === "split-length") {
    return (
      <div className="option-fields two-columns">
        <NumberOption label="최소 길이" value={Number(options.minimum)} min={0} max={256} onChange={(value) => updateOption("minimum", value)} />
        <NumberOption label="최대 길이" value={Number(options.maximum)} min={1} max={256} onChange={(value) => updateOption("maximum", value)} />
        <p className="option-help">한글과 Emoji는 Unicode 문자 단위로 계산합니다.</p>
      </div>
    );
  }
  if (toolId === "filter-text") {
    return (
      <div className="option-fields">
        <label className="field-label">필터 문자열<input value={String(options.query)} onChange={(event) => updateOption("query", event.target.value)} /></label>
        <label className="field-label">필터 방식<select value={String(options.mode)} onChange={(event) => updateOption("mode", event.target.value)}><option value="include">포함</option><option value="exclude">제외</option></select></label>
        <details className="advanced-options">
          <summary>고급 옵션</summary>
          <CheckOption label="대소문자 구분" checked={Boolean(options.caseSensitive)} onChange={(value) => updateOption("caseSensitive", value)} />
        </details>
      </div>
    );
  }
  if (toolId === "combine") {
    return (
      <div className="option-fields">
        <label className="field-label">두 번째 목록<textarea className="option-textarea" value={String(options.secondaryInput)} onChange={(event) => updateOption("secondaryInput", event.target.value)} spellCheck={false} /></label>
        <label className="field-label">구분자<input value={String(options.separator)} onChange={(event) => updateOption("separator", event.target.value)} maxLength={20} /></label>
      </div>
    );
  }
  return (
    <div className="option-fields">
      <p className="option-help prominent">각 항목은 최대 7자까지 처리합니다.</p>
      <details className="advanced-options">
        <summary>고급 옵션</summary>
        <NumberOption label="최대 결과" value={Number(options.maximumResults)} min={1} max={10_000} onChange={(value) => updateOption("maximumResults", value)} />
      </details>
    </div>
  );
}

function CheckOption({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="check-option"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span aria-hidden="true" /><b>{label}</b></label>;
}

function NumberOption({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="field-label">{label}<input type="number" value={value} min={min} max={max} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
