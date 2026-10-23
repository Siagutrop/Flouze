/** Client API minimal : cookies httpOnly + retry après refresh sur 401. */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    credentials: 'include',
    headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    ...init,
  });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return request<T>(path, init, true);
  }

  if (!res.ok) {
    let code = 'errors.generic';
    try {
      const body = await res.json();
      const msg = body?.message;
      if (typeof msg === 'string' && msg.includes('.')) code = msg;
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(res.status, code);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'DELETE',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
