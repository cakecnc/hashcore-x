import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SafetyNotice } from "@/components/SafetyNotice";
import { formatBytes, MAX_INPUT_BYTES, MAX_OUTPUT_ITEMS, MAX_PERMUTATION_CHARACTERS } from "@/lib/limits";

export const metadata: Metadata = { title: "사용 가이드" };

export default function GuidePage() {
  return (
    <AppShell active="guide">
      <section className="guide-page" aria-labelledby="guide-heading">
        <div className="page-heading">
          <span className="eyebrow">SAFE BY DESIGN</span>
          <h1 id="guide-heading">사용 가이드</h1>
          <p>명령어 없이 텍스트 Utility를 사용하는 가장 짧은 방법입니다.</p>
        </div>
        <SafetyNotice />
        <div className="guide-layout">
          <aside className="guide-nav" aria-label="가이드 목차">
            <a href="#quick-start">빠른 시작</a>
            <a href="#utilities">Utility 설명</a>
            <a href="#runner">GPU Runner</a>
            <a href="#data">데이터 처리</a>
            <a href="#limits">안전 제한</a>
            <a href="#license">라이선스</a>
          </aside>
          <div className="guide-content">
            <section id="quick-start">
              <span className="guide-index">01</span><h2>빠른 시작</h2>
              <ol className="guide-steps">
                <li><strong>도구 선택</strong><span><Link href="/tools">도구 화면</Link>에서 목적에 맞는 Utility를 엽니다.</span></li>
                <li><strong>입력 추가</strong><span>UTF-8 TXT·CSV 파일을 선택하거나 텍스트를 붙여 넣습니다.</span></li>
                <li><strong>옵션 확인</strong><span>필수 옵션만 설정하고 고급 옵션은 필요할 때 펼칩니다.</span></li>
                <li><strong>실행 및 저장</strong><span>결과를 확인한 뒤 Clipboard, TXT 또는 CSV로 저장합니다.</span></li>
              </ol>
            </section>
            <section id="utilities">
              <span className="guide-index">02</span><h2>Utility 설명</h2>
              <div className="guide-utility-grid">
                <article><strong>빈 줄·공백 정리</strong><p>줄 앞뒤와 연속 공백, 빈 줄을 선택적으로 정리합니다.</p></article>
                <article><strong>중복 제거</strong><p>첫 등장 순서를 유지하며 같은 항목을 한 번만 남깁니다.</p></article>
                <article><strong>길이별 분류</strong><p>원본 <code>splitlen</code> 흐름을 Unicode 문자 길이 기준으로 제공합니다.</p></article>
                <article><strong>문자열 포함·제외</strong><p>지정 문자열을 포함하거나 제외한 줄만 필터링합니다.</p></article>
                <article><strong>목록 결합</strong><p>원본 <code>combinator</code>처럼 두 목록의 Cartesian Product를 만듭니다.</p></article>
                <article><strong>단순 순열</strong><p>원본 <code>permute</code>의 핵심 동작을 중복 없는 문자 순열로 제한 제공합니다.</p></article>
              </div>
            </section>
            <section id="runner">
              <span className="guide-index">03</span><h2>로컬 GPU Runner</h2>
              <p><Link href="/runner">GPU 실행 화면</Link>은 이 Mac의 Hashcat을 Dictionary attack으로만 제한 실행합니다. 먼저 Hashcat을 설치하고 웹 앱과 Runner를 함께 시작합니다.</p>
              <pre><code>{`brew install hashcat
pnpm dev`}</code></pre>
              <ul>
                <li>터미널에 표시된 일회성 token을 현재 탭에만 입력합니다.</li>
                <li>GPU 또는 CPU, 지원 Hash 모드, Hash 목록과 후보 목록을 선택합니다.</li>
                <li>승인된 데이터 확인 후 Benchmark 또는 Hashcat 작업을 실행합니다.</li>
                <li>작업이 끝나면 민감 결과 지우기로 Runner 메모리에서도 제거합니다.</li>
              </ul>
            </section>
            <section id="data">
              <span className="guide-index">04</span><h2>데이터 처리와 기록</h2>
              <p>브라우저 Utility 입력과 결과는 Web Worker가 현재 탭 안에서 처리합니다. GPU Runner는 Loopback 통신만 사용하며 임시 입력 파일은 작업 종료 즉시 삭제합니다.</p>
              <ul>
                <li>Local Storage에는 도구명, 실행 시각, 상태, 항목 수, 처리 시간만 저장합니다.</li>
                <li>입력 파일명, 입력 원문, 결과 원문은 History에 저장하지 않습니다.</li>
                <li>결과 파일은 사용자가 버튼을 눌렀을 때 현재 기기로만 생성됩니다.</li>
                <li>Runner token은 React 상태에만 유지되고 새로 고침하면 사라집니다.</li>
              </ul>
            </section>
            <section id="limits">
              <span className="guide-index">05</span><h2>안전 제한</h2>
              <dl className="limit-list">
                <div><dt>입력</dt><dd>{formatBytes(MAX_INPUT_BYTES)}</dd></div>
                <div><dt>결과</dt><dd>최대 {MAX_OUTPUT_ITEMS.toLocaleString("ko-KR")}개</dd></div>
                <div><dt>순열 입력</dt><dd>항목당 {MAX_PERMUTATION_CHARACTERS}자</dd></div>
                <div><dt>실행 시간</dt><dd>작업당 15초</dd></div>
              </dl>
              <p>대용량 목록 결합과 순열은 실행 전에 예상 결과 수를 보여주고 추가 확인을 받습니다.</p>
              <p>Runner는 Hash 1,000개, 후보 100,000개, 동시 작업 1개, 실행 시간 5분으로 제한됩니다. 임의 Shell 명령과 원격 Bind는 지원하지 않습니다.</p>
            </section>
            <section id="license">
              <span className="guide-index">06</span><h2>라이선스와 출처</h2>
              <p>명칭과 동작 분석에는 <a href="https://github.com/hashcat/hashcat-utils" rel="noreferrer" target="_blank">hashcat/hashcat-utils</a>의 기준 커밋 <code>8bbf2ba</code>를 참고했습니다. 원본은 Jens Steube가 저작권을 보유하며 MIT License로 배포됩니다.</p>
              <p>브라우저용 TypeScript 코드는 새로 작성되었고 원본 C·Python·Perl 파일은 수정하지 않았습니다. 전체 고지는 <code>THIRD_PARTY_NOTICES.md</code>에 포함되어 있습니다.</p>
            </section>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
