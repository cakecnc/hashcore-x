export function createCsv(rows: string[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${cell.replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

export async function copyText(
  value: string,
  clipboard: Pick<Clipboard, "writeText"> = navigator.clipboard,
): Promise<void> {
  if (!value) throw new Error("복사할 결과가 없습니다.");
  await clipboard.writeText(value);
}

export function downloadTextFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = createTextBlob(content, mimeType);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function createTextBlob(content: string, mimeType: string): Blob {
  return new Blob([content], { type: `${mimeType};charset=utf-8` });
}

export function createResultFilename(toolId: string, extension: "txt" | "csv") {
  const timestamp = new Date().toISOString().replaceAll(":", "-").replace(/\.\d{3}Z$/, "Z");
  return `${toolId}-${timestamp}.${extension}`;
}
