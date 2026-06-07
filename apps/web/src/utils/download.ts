export function downloadAsFile(content: string, filename: string, mimeType = "text/plain"): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // WebKit reads the blob URL asynchronously after click(); revoking it in the
  // same task aborts the download, so defer the revoke past the current task.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
