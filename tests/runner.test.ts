import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHashcatBenchmarkArguments,
  buildHashcatJobArguments,
  validateHashMode,
  validateJobRequest,
} from "../local-runner/validation";

const sampleRequest = {
  mode: 0,
  deviceType: "gpu" as const,
  hashes: "0976292bd16a98e329d7e0e33a2d0494",
  candidates: "browser-demo\nhashcat-demo-2026\nlocal-recovery",
  acknowledged: true,
};

test("validates the bounded raw-hash request", () => {
  assert.deepEqual(validateJobRequest(sampleRequest), {
    mode: 0,
    deviceType: "gpu",
    hashes: ["0976292bd16a98e329d7e0e33a2d0494"],
    candidates: ["browser-demo", "hashcat-demo-2026", "local-recovery"],
  });
});

test("rejects unapproved, unsupported, and malformed requests", () => {
  assert.throws(
    () => validateJobRequest({ ...sampleRequest, acknowledged: false }),
    /승인된 데이터/,
  );
  assert.throws(() => validateHashMode(9_999), /지원하지 않는/);
  assert.throws(
    () => validateJobRequest({ ...sampleRequest, hashes: "not-a-hash" }),
    /MD5 형식/,
  );
  assert.throws(
    () => validateJobRequest({ ...sampleRequest, candidates: "a".repeat(257) }),
    /256 bytes/,
  );
});

test("builds fixed Hashcat arguments without user-controlled command fragments", () => {
  const validated = validateJobRequest(sampleRequest);
  const argumentsList = buildHashcatJobArguments(validated, {
    hashes: "/tmp/job/hashes.txt",
    candidates: "/tmp/job/candidates.txt",
    output: "/tmp/job/results.txt",
  });

  assert.deepEqual(argumentsList, [
    "-m",
    "0",
    "-a",
    "0",
    "/tmp/job/hashes.txt",
    "/tmp/job/candidates.txt",
    "-D",
    "2",
    "--outfile",
    "/tmp/job/results.txt",
    "--outfile-format",
    "1,2",
    "--potfile-disable",
    "--restore-disable",
    "--status-json",
    "--status-timer",
    "1",
    "--quiet",
  ]);
  assert.doesNotMatch(argumentsList.join(" "), /hashcat-demo-2026|0976292b/);
});

test("builds a fixed benchmark for the selected device", () => {
  assert.deepEqual(buildHashcatBenchmarkArguments(1400, "cpu"), [
    "-b",
    "-m",
    "1400",
    "-D",
    "1",
    "--machine-readable",
  ]);
});
