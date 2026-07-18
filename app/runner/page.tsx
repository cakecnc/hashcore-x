import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { HashcatRunnerClient } from "@/components/HashcatRunnerClient";

export const metadata: Metadata = { title: "로컬 GPU Runner" };

export default function RunnerPage() {
  return (
    <AppShell active="runner" fullWidth>
      <HashcatRunnerClient />
    </AppShell>
  );
}
