import { apiFetchRaw } from './api';

export async function downloadBillPdf(params: { id: string }) {
  const res = await apiFetchRaw(`/ap/bills/${encodeURIComponent(params.id)}/export`, { method: 'GET' });
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^";]+)"?/i.exec(cd);
  const fileName = match?.[1] || `bill-${params.id}.pdf`;
  return { blob, fileName };
}

export function triggerBrowserDownload(blob: Blob, fileName: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
