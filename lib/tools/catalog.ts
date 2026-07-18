import type { ToolDefinition, ToolId } from "./types";

export const tools: ToolDefinition[] = [
  {
    id: "clean-lines",
    name: "빈 줄·공백 정리",
    originalName: "Text cleanup",
    category: "Convert",
    description: "줄 앞뒤 공백과 연속 공백, 빈 줄을 선택적으로 정리합니다.",
    inputFormat: "TXT · 줄 단위 텍스트",
    sample: "  apple  pie  \n\nbanana\n  한글   예시  \n",
    recommended: true,
  },
  {
    id: "deduplicate",
    name: "중복 제거",
    originalName: "rli-style unique list",
    category: "Convert",
    description: "입력 순서를 유지하면서 중복된 항목을 제거합니다.",
    inputFormat: "TXT · CSV · 줄 단위 텍스트",
    sample: "alpha\nbeta\nalpha\n한글\n한글\ngamma",
    recommended: true,
  },
  {
    id: "split-length",
    name: "길이별 분류",
    originalName: "splitlen",
    category: "Analyze",
    description: "각 항목을 Unicode 문자 길이로 분류하고 범위를 제한합니다.",
    inputFormat: "TXT · 줄 단위 텍스트",
    sample: "a\ncat\n한글\nsecurity\n도구상자",
    recommended: true,
  },
  {
    id: "filter-text",
    name: "문자열 포함·제외",
    originalName: "req-include / req-exclude inspired",
    category: "Analyze",
    description: "지정 문자열을 포함하거나 제외한 항목만 남깁니다.",
    inputFormat: "TXT · 줄 단위 텍스트",
    sample: "admin-2026\nguest-2025\n관리자-2026\nuser-2026",
  },
  {
    id: "combine",
    name: "목록 결합",
    originalName: "combinator",
    category: "Generate",
    description: "두 목록의 모든 조합을 구분자와 함께 생성합니다.",
    inputFormat: "두 개의 줄 단위 목록",
    sample: "blue\ngreen\n검정",
  },
  {
    id: "permutations",
    name: "단순 순열 생성",
    originalName: "permute",
    category: "Generate",
    description: "짧은 항목의 중복 없는 문자 순열을 안전한 한도 안에서 생성합니다.",
    inputFormat: "최대 7자 · 줄 단위 텍스트",
    sample: "abc\n가나",
  },
];

export function getTool(toolId: ToolId): ToolDefinition {
  return tools.find((tool) => tool.id === toolId) ?? tools[0];
}

export function isToolId(value: string | undefined): value is ToolId {
  return tools.some((tool) => tool.id === value);
}
