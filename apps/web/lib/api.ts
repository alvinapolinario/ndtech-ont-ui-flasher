/** Browser-side API client for the NDTECH ONT Customizer backend. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new ApiClientError(json?.error ?? `Request failed (${res.status})`, res.status, json?.code);
  }
  // Unwrap the { data } envelope. Use an explicit key check so endpoints that
  // legitimately return `data: null` (e.g. "no workspace yet") resolve to null
  // rather than leaking the envelope object.
  if (json && typeof json === 'object' && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Absolute URL helpers for non-JSON endpoints (raw asset bytes, HTML report). */
export const urls = {
  assetRaw: (assetId: string) => `${API_URL}/api/assets/${assetId}/raw`,
  report: (workspaceId: string) => `${API_URL}/api/workspaces/${workspaceId}/report`,
  profileLogo: (profileId: string) => `${API_URL}/api/profiles/${profileId}/logo`,
  profileFavicon: (profileId: string) => `${API_URL}/api/profiles/${profileId}/favicon`,
};

/** Upload a file (logo/favicon) to a profile via multipart/form-data. */
export async function uploadProfileAsset(
  profileId: string,
  kind: 'logo' | 'favicon',
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append(kind, file);
  await api.post(`/profiles/${profileId}/${kind}`, form);
}
