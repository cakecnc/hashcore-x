import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const description = "Hashcat 작업용 텍스트 목록을 서버 전송 없이 브라우저에서 정리하고 분석하는 안전한 Utility Workbench.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim();
  const rawHost = forwardedHost ?? requestHeaders.get("host") ?? "localhost:3000";
  const host = /^[a-z0-9.-]+(?::\d{1,5})?$/i.test(rawHost) ? rawHost : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim();
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1")
    ? "http"
    : forwardedProtocol === "http" ? "http" : "https";

  return {
    metadataBase: new URL(`${protocol}://${host}`),
    title: {
      default: "HashCat Web Utils",
      template: "%s · HashCat Web Utils",
    },
    description,
    openGraph: {
      title: "HashCat Web Utils",
      description,
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "HashCat Web Utils Browser-only Text Utility Workbench" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "HashCat Web Utils",
      description,
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
