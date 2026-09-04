// Desarrollo: la API vive en otro puerto.
// Producción: el mismo Express sirve el frontend, así que /api es del mismo
// origen y no hay CORS. VITE_API_URL puede sobrescribir ambos casos.
const BASE = (import.meta.env.VITE_API_URL as string | undefined)
  ?? (import.meta.env.DEV ? 'http://localhost:4001/api' : '/api');

function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function setToken(token: string): void {
  localStorage.setItem('auth_token', token);
}

export function clearToken(): void {
  localStorage.removeItem('auth_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (let browser set boundary)
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try { const err = await res.json(); message = err.error ?? err.message ?? message; } catch { /* ignore */ }
    throw new Error(message);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get:    <T>(path: string)                              => request<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body: unknown)               => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)               => request<T>(path, { method: 'PUT',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)              => request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string)                              => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData)          => request<T>(path, { method: 'POST',  body: formData }),
};
