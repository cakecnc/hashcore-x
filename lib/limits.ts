export const MAX_INPUT_BYTES = 1_000_000;
export const MAX_OUTPUT_ITEMS = 10_000;
export const MAX_OUTPUT_CHARACTERS = 2_000_000;
export const LARGE_JOB_WARNING_ITEMS = 5_000;
export const MAX_PERMUTATION_CHARACTERS = 7;
export const MAX_HISTORY_ITEMS = 20;

export function getUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1_000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
