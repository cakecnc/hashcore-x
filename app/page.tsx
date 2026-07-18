import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { RecentJobs } from "@/components/RecentJobs";
import { SafetyNotice } from "@/components/SafetyNotice";
import { ToolCard } from "@/components/ToolCard";
import { tools } from "@/lib/tools/catalog";

export default function Home() {
  const recommendedTools = tools.filter((tool) => tool.recommended);

  return (
    <AppShell active="home">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><i aria-hidden="true" /> BROWSER-ONLY SECURITY UTILS</span>
          <h1>텍스트 Utility를<br /><em>명령어 없이.</em></h1>
          <p>
            Hashcat 작업 전후의 텍스트 목록을 안전하게 정리하고 분석하세요.
            브라우저 Utility는 설치와 서버 전송 없이 현재 탭에서만 처리합니다.
          </p>
          <form className="hero-search" action="/tools" method="get">
            <label htmlFor="home-tool-search">Utility 검색</label>
            <div>
              <span aria-hidden="true">⌕</span>
              <input id="home-tool-search" name="q" type="search" placeholder="예: 중복 제거, 길이별 분류" />
              <button type="submit">검색</button>
            </div>
          </form>
          <div className="hero-actions">
            <Link className="button button-primary" href="/workspace">도구 시작하기 <span aria-hidden="true">→</span></Link>
            <Link className="button button-ghost" href="/guide">사용 가이드 보기</Link>
          </div>
        </div>
        <div className="hero-terminal" aria-label="브라우저 처리 흐름 예시">
          <div className="terminal-bar"><span /><span /><span /><b>LOCAL WORKBENCH</b></div>
          <div className="terminal-body">
            <span className="terminal-label">INPUT</span>
            <code>alpha{`\n`}beta{`\n`}alpha{`\n`}한글</code>
            <span className="terminal-arrow" aria-hidden="true">↓</span>
            <span className="terminal-label">DEDUPLICATE</span>
            <div className="terminal-progress"><span /></div>
            <span className="terminal-label">OUTPUT</span>
            <code className="terminal-output">alpha{`\n`}beta{`\n`}한글</code>
            <div className="terminal-status"><span aria-hidden="true">✓</span> 완료 · 3개 결과 · 서버 전송 없음</div>
          </div>
        </div>
      </section>

      <SafetyNotice />

      <section className="recommended-section" aria-labelledby="recommended-heading">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">START HERE</span>
            <h2 id="recommended-heading">추천 Utility</h2>
          </div>
          <Link href="/tools">모든 도구 보기 <span aria-hidden="true">→</span></Link>
        </div>
        <div className="tool-grid">
          {recommendedTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        </div>
      </section>

      <section className="workflow-strip" aria-label="사용 흐름">
        {["도구 선택", "파일·텍스트 입력", "옵션 선택", "브라우저 실행", "결과 확인·저장"].map((step, index) => (
          <div key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong>{index < 4 ? <b aria-hidden="true">→</b> : null}</div>
        ))}
      </section>

      <RecentJobs />
    </AppShell>
  );
}
