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

      <section className="access-section" aria-labelledby="access-heading">
        <div className="section-heading-row">
          <div>
            <span className="eyebrow">HASHCORE X ACCESS</span>
            <h2 id="access-heading">로컬 복구 워크벤치 이용권</h2>
          </div>
          <span className="access-delivery">DIGITAL LICENSE · 배송비 0</span>
        </div>
        <p className="access-lead">
          PayPal에서 결제하고 결제 완료 이메일 기준으로 등록 코드를 발급받으세요.
          카드정보와 결제정보는 HASHCORE X 서버에 저장되지 않습니다.
        </p>
        <div className="access-grid">
          <article className="access-card">
            <span>06 MONTHS</span>
            <h3>6개월 이용권</h3>
            <p className="access-price"><strong>$33</strong><small>USD</small></p>
            <p>승인된 로컬 데이터 복구용 · 디지털 코드 발급</p>
            <a className="paypal-button" href="https://www.paypal.com/ncp/payment/W7KAJ837HWYFA" target="_blank" rel="noopener noreferrer">
              PayPal로 결제 <span aria-hidden="true">↗</span>
            </a>
          </article>
          <article className="access-card access-card-featured">
            <span>12 MONTHS · BEST VALUE</span>
            <h3>1년 이용권</h3>
            <p className="access-price"><strong>$55</strong><small>USD</small></p>
            <p>승인된 로컬 데이터 복구용 · 디지털 코드 발급</p>
            <a className="paypal-button" href="https://www.paypal.com/ncp/payment/HC8WC5F8MAT7A" target="_blank" rel="noopener noreferrer">
              PayPal로 결제 <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>
        <p className="access-note">결제 자체는 PayPal에서 처리됩니다. 결제 후 물리 배송은 없으며, 등록 코드는 결제 확인 후 별도로 발급됩니다.</p>
      </section>

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
