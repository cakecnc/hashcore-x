import { runUtility } from "./index";
import type { UtilityRequest, UtilityResult } from "./types";

type WorkerResponse =
  | { ok: true; result: UtilityResult }
  | { ok: false; error: string };

export function runUtilityInWorker(
  request: UtilityRequest,
): Promise<UtilityResult> {
  if (typeof Worker === "undefined") {
    return Promise.resolve().then(() => runUtility(request));
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./utility.worker.ts", import.meta.url), {
      type: "module",
    });
    const timeout = window.setTimeout(() => {
      worker.terminate();
      reject(new Error("처리 시간이 제한을 초과했습니다."));
    }, 15_000);

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      window.clearTimeout(timeout);
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      window.clearTimeout(timeout);
      worker.terminate();
      reject(new Error("브라우저 작업자를 시작할 수 없습니다."));
    };
    worker.postMessage(request);
  });
}
