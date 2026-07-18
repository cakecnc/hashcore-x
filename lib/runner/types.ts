export type RunnerJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunnerStatus {
  available: boolean;
  version: string | null;
  devices: string;
  gpuDetected: boolean;
  activeJob: boolean;
  runnerVersion: string;
}

export interface RunnerJobProgress {
  current: number;
  total: number;
  percent: number;
  recovered: number;
  speed: number;
}

export interface RunnerJob {
  id: string;
  state: RunnerJobState;
  mode: number;
  deviceType: "gpu" | "cpu";
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  progress: RunnerJobProgress | null;
  results: string[];
  message: string;
  logs: string[];
}

export interface RunnerJobRequest {
  mode: number;
  deviceType: "gpu" | "cpu";
  hashes: string;
  candidates: string;
  acknowledged: boolean;
}

export interface RunnerBenchmarkResult {
  mode: number;
  deviceType: "gpu" | "cpu";
  output: string;
  durationMs: number;
}
