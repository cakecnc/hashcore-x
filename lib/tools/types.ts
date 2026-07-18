export type ToolId =
  | "clean-lines"
  | "deduplicate"
  | "split-length"
  | "filter-text"
  | "combine"
  | "permutations";

export type ToolCategory = "Analyze" | "Convert" | "Generate";

export type UtilityOptions = Record<string, boolean | number | string>;

export interface UtilityRequest {
  toolId: ToolId;
  input: string;
  options: UtilityOptions;
}

export interface UtilityResult {
  text: string;
  csvRows: string[][];
  inputCount: number;
  outputCount: number;
  durationMs: number;
  warnings: string[];
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  originalName: string;
  category: ToolCategory;
  description: string;
  inputFormat: string;
  sample: string;
  recommended?: boolean;
}
