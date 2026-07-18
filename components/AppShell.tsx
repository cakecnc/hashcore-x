import Link from "next/link";
import type { ReactNode } from "react";

type NavigationKey = "home" | "tools" | "workspace" | "runner" | "history" | "guide";

const navigation: { key: NavigationKey; href: string; label: string }[] = [
  { key: "home", href: "/", label: "홈" },
  { key: "tools", href: "/tools", label: "도구" },
  { key: "workspace", href: "/workspace", label: "워크스페이스" },
  { key: "runner", href: "/runner", label: "GPU 실행" },
  { key: "history", href: "/history", label: "기록" },
  { key: "guide", href: "/guide", label: "가이드" },
];

interface AppShellProps {
  active: NavigationKey;
  children: ReactNode;
  fullWidth?: boolean;
}

export function AppShell({ active, children, fullWidth = false }: AppShellProps) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        본문 바로가기
      </a>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="HashCat Web Utils 홈">
          <span className="brand-mark" aria-hidden="true">HC</span>
          <span>
            <strong>HashCat</strong>
            <small>WEB UTILS</small>
          </span>
        </Link>
        <nav className="main-nav" aria-label="주요 메뉴">
          {navigation.map((item) => (
            <Link
              key={item.key}
              className={active === item.key ? "nav-link is-active" : "nav-link"}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link className="header-cta" href="/workspace">
          도구 시작하기
        </Link>
      </header>
      <main
        id="main-content"
        className={fullWidth ? "main-content main-content-wide" : "main-content"}
      >
        {children}
      </main>
      <footer className="site-footer">
        <div>
          <strong>HashCat Web Utils</strong>
          <p>브라우저 Utility와 제한된 로컬 GPU 실행기</p>
        </div>
        <div className="footer-links">
          <Link href="/guide#license">MIT License</Link>
          <a href="https://github.com/hashcat/hashcat-utils" rel="noreferrer" target="_blank">
            원본 저장소
          </a>
        </div>
      </footer>
    </div>
  );
}
