import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { ToolExplorer } from "@/components/ToolExplorer";

export const metadata: Metadata = { title: "도구" };

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  return (
    <AppShell active="tools">
      <ToolExplorer initialQuery={q.slice(0, 100)} />
    </AppShell>
  );
}
