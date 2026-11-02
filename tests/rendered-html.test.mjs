import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished Korean home page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="ko"/i);
  assert.match(html, /<title>HASHCORE X<\/title>/i);
  assert.match(html, /텍스트 Utility를/);
  assert.match(html, /서버 전송 없음/);
  assert.match(html, /추천 Utility/);
  assert.match(html, /https:\/\/www\.paypal\.com\/ncp\/payment\/W7KAJ837HWYFA/);
  assert.match(html, /https:\/\/www\.paypal\.com\/ncp\/payment\/HC8WC5F8MAT7A/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("server-renders all required routes", async () => {
  const routes = [
    ["/tools", "필요한 도구를 찾으세요"],
    ["/workspace", "워크스페이스"],
    ["/history", "최근 작업 기록"],
    ["/guide", "사용 가이드"],
    ["/runner", "로컬 GPU Runner"],
  ];

  for (const [pathname, expectedText] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), new RegExp(expectedText), pathname);
  }
});

test("removes disposable starter assets and metadata", async () => {
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(page, /SkeletonPreview|codex-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
