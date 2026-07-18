import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { HistoryList } from "@/components/HistoryList";

export const metadata: Metadata = { title: "작업 기록" };

export default function HistoryPage() {
  return <AppShell active="history"><HistoryList /></AppShell>;
}
