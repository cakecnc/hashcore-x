import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { WorkspaceClient } from "@/components/WorkspaceClient";
import { isToolId } from "@/lib/tools/catalog";

export const metadata: Metadata = { title: "워크스페이스" };

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ tool?: string }>;
}) {
  const { tool } = await searchParams;
  return (
    <AppShell active="workspace" fullWidth>
      <WorkspaceClient initialToolId={isToolId(tool) ? tool : "clean-lines"} />
    </AppShell>
  );
}
