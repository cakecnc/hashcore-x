import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("includes mobile one-column layout and reduced-motion support", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 780px\)/);
  assert.match(css, /\.workspace-grid\s*\{\s*grid-template-columns: 1fr;/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("workspace exposes keyboard-accessible native controls", async () => {
  const source = await readFile(new URL("../components/WorkspaceClient.tsx", import.meta.url), "utf8");
  assert.match(source, /type="file"/);
  assert.match(source, /type="button"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|execCommand|shell|child_process/);
});

test("local runner keeps the execution boundary on loopback", async () => {
  const [server, client] = await Promise.all([
    readFile(new URL("../local-runner/server.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/HashcatRunnerClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(server, /const BIND_ADDRESS = "127\.0\.0\.1"/);
  assert.match(server, /shell: false/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /Boolean\(job && !job\.finishedAt\)/);
  assert.match(server, /child\.kill\("SIGKILL"\)/);
  assert.doesNotMatch(server, /\bexecSync\b|\bexecFileSync\b|\beval\s*\(/);
  assert.match(client, /type="password"/);
  assert.doesNotMatch(client, /localStorage|sessionStorage/);
});
