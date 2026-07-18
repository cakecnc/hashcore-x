import { MAX_HISTORY_ITEMS } from "./limits";
import type { ToolId } from "./tools/types";

const HISTORY_KEY = "hashcat-web-utils:history:v1";
const HISTORY_UPDATED_EVENT = "hashcat-web-utils:history-updated";

export interface HistoryRecord {
  id: string;
  toolId: ToolId;
  toolName: string;
  createdAt: string;
  status: "completed" | "failed";
  inputCount: number;
  outputCount: number;
  durationMs: number;
}

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

export function readHistory(storage: StorageAdapter): HistoryRecord[] {
  return readHistorySnapshot(storage.getItem(HISTORY_KEY));
}

export function readHistorySnapshot(value: string | null): HistoryRecord[] {
  try {
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryRecord).slice(0, MAX_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function saveHistory(
  storage: StorageAdapter,
  record: HistoryRecord,
): HistoryRecord[] {
  const next = [record, ...readHistory(storage).filter((item) => item.id !== record.id)]
    .slice(0, MAX_HISTORY_ITEMS);
  storage.setItem(HISTORY_KEY, JSON.stringify(next));
  notifyHistoryChange();
  return next;
}

export function deleteHistory(
  storage: StorageAdapter,
  recordId: string,
): HistoryRecord[] {
  const next = readHistory(storage).filter((record) => record.id !== recordId);
  storage.setItem(HISTORY_KEY, JSON.stringify(next));
  notifyHistoryChange();
  return next;
}

export function clearHistory(storage: StorageAdapter): HistoryRecord[] {
  storage.setItem(HISTORY_KEY, "[]");
  notifyHistoryChange();
  return [];
}

export function getHistorySnapshot(): string {
  return typeof window === "undefined"
    ? "[]"
    : window.localStorage.getItem(HISTORY_KEY) ?? "[]";
}

export function subscribeHistory(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === HISTORY_KEY) listener();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(HISTORY_UPDATED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(HISTORY_UPDATED_EVENT, listener);
  };
}

function notifyHistoryChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HISTORY_UPDATED_EVENT));
  }
}

function isHistoryRecord(value: unknown): value is HistoryRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<HistoryRecord>;
  return (
    typeof record.id === "string" &&
    typeof record.toolId === "string" &&
    typeof record.toolName === "string" &&
    typeof record.createdAt === "string" &&
    (record.status === "completed" || record.status === "failed") &&
    typeof record.inputCount === "number" &&
    typeof record.outputCount === "number" &&
    typeof record.durationMs === "number"
  );
}
