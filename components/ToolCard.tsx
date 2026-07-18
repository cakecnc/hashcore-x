import Link from "next/link";
import type { ToolDefinition } from "@/lib/tools/types";

export function ToolCard({ tool }: { tool: ToolDefinition }) {
  return (
    <article className="tool-card">
      <div className="tool-card-topline">
        <span className={`category-badge category-${tool.category.toLowerCase()}`}>
          {tool.category}
        </span>
        <span className="browser-badge">Browser</span>
      </div>
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
      <dl className="tool-meta">
        <div>
          <dt>입력</dt>
          <dd>{tool.inputFormat}</dd>
        </div>
        <div>
          <dt>기반</dt>
          <dd>{tool.originalName}</dd>
        </div>
      </dl>
      <Link className="card-link" href={`/workspace?tool=${tool.id}`}>
        워크스페이스에서 열기 <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
