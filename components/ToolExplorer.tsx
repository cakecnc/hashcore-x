"use client";

import { useMemo, useState } from "react";
import { tools } from "@/lib/tools/catalog";
import type { ToolCategory } from "@/lib/tools/types";
import { ToolCard } from "./ToolCard";

const filters: (ToolCategory | "All")[] = ["All", "Analyze", "Convert", "Generate"];

export function ToolExplorer({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<ToolCategory | "All">("All");
  const visibleTools = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
    return tools.filter((tool) => {
      const matchesFilter = filter === "All" || tool.category === filter;
      const haystack = `${tool.name} ${tool.description} ${tool.originalName}`.toLocaleLowerCase("ko-KR");
      return matchesFilter && (!normalizedQuery || haystack.includes(normalizedQuery));
    });
  }, [filter, query]);

  return (
    <section aria-labelledby="tools-heading">
      <div className="page-heading">
        <span className="eyebrow">BROWSER UTILITIES</span>
        <h1 id="tools-heading">필요한 도구를 찾으세요</h1>
        <p>원본 Utility의 핵심 흐름을 브라우저에 맞게 안전하게 다시 작성했습니다.</p>
      </div>
      <div className="tool-controls">
        <label className="search-field">
          <span className="visually-hidden">Utility 검색</span>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="도구명 또는 기능으로 검색"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기">×</button>
          ) : null}
        </label>
        <div className="filter-tabs" aria-label="도구 카테고리 필터">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              className={filter === item ? "is-active" : undefined}
              onClick={() => setFilter(item)}
              aria-pressed={filter === item}
            >
              {item === "All" ? "전체" : item}
            </button>
          ))}
        </div>
      </div>
      <p className="result-count" aria-live="polite">{visibleTools.length}개 도구</p>
      {visibleTools.length ? (
        <div className="tool-grid">
          {visibleTools.map((tool) => <ToolCard key={tool.id} tool={tool} />)}
        </div>
      ) : (
        <div className="empty-state">
          <span aria-hidden="true">⌕</span>
          <h2>일치하는 도구가 없습니다</h2>
          <p>검색어를 줄이거나 다른 카테고리를 선택해 보세요.</p>
        </div>
      )}
    </section>
  );
}
