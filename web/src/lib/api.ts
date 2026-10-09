export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Paths are relative to /api, which Vite proxies to Nest. The session cookie is sent automatically.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    // Fastify rejects an empty body sent with a JSON content type, so only set it when there is a body.
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message ?? `${res.status} ${res.statusText}`, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// POSTs and reads a streamed text reply (AI chat). onText receives each new piece as it arrives.
export async function streamText(path: string, body: unknown, onText: (text: string) => void) {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.message ?? `${res.status} ${res.statusText}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}

// Streams whose first line is JSON (e.g. { sources }) and the rest is text (the AI's answer).
export async function streamWithHeader<T>(
  path: string,
  body: unknown,
  onHeader: (header: T) => void,
  onText: (text: string) => void,
) {
  let buffer = '';
  let headerDone = false;
  await streamText(path, body, (text) => {
    if (headerDone) return onText(text);
    buffer += text;
    const newline = buffer.indexOf('\n');
    if (newline === -1) return;
    headerDone = true;
    onHeader(JSON.parse(buffer.slice(0, newline)));
    if (buffer.length > newline + 1) onText(buffer.slice(newline + 1));
  });
}

// Shrinks a photo to fit maxSize × maxSize and returns base64 JPEG (no "data:" prefix). Smaller = faster AI.
export async function imageToBase64(file: File, maxSize = 1024) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// File → base64 string (for JSON uploads).
export const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
