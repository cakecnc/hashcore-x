/// <reference lib="webworker" />

import { runUtility } from "./index";
import type { UtilityRequest, UtilityResult } from "./types";

type WorkerResponse =
  | { ok: true; result: UtilityResult }
  | { ok: false; error: string };

self.onmessage = (event: MessageEvent<UtilityRequest>) => {
  let response: WorkerResponse;
  try {
    response = { ok: true, result: runUtility(event.data) };
  } catch (error) {
    response = {
      ok: false,
      error: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다.",
    };
  }
  self.postMessage(response);
};

export {};
