// Lightweight API client for the AI Study OS backend.
// Base URL is configurable; auth token is read from localStorage ("token").

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://localhost:3001/v1';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  if (typeof window !== 'undefined') localStorage.setItem('token', token);
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: ApiEnvelope<T> | T | undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const msg =
      (json as ApiEnvelope<T>)?.message ||
      (json as { error?: string })?.error ||
      `Request failed (${res.status})`;
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  // Unwrap the global TransformInterceptor envelope when present.
  if (json && typeof json === 'object' && 'data' in (json as object)) {
    return (json as ApiEnvelope<T>).data as T;
  }
  return json as T;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: authHeaders(),
  });
  return parse<T>(res);
}

export async function apiSend<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

export async function apiUpload<T>(
  path: string,
  form: FormData,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(), // do NOT set Content-Type; browser sets multipart boundary
    body: form,
  });
  return parse<T>(res);
}

/** Downloads an authorized file and triggers a browser save. */
export async function apiDownload(path: string, fallbackName: string) {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] || fallbackName;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
