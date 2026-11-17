const BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const TOKEN_KEY = 'clinicflow.token';
export const UNAUTHORIZED_EVENT = 'clinicflow:unauthorized';

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

function clearSession() {
  setStoredToken(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }
}

/**
 * Error thrown for any non-2xx API response. Carries the HTTP status and the
 * optional field-level validation details returned by the backend.
 */
export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, query) {
  const url = `${BASE_URL}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(path, { method = 'GET', body, query } = {}) {
  const headers = { Accept: 'application/json' };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(
      'Unable to reach the server. Please check your connection.',
      0,
      'NETWORK_ERROR',
    );
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    // Expired/invalid sessions should log the user out everywhere, except when
    // the login endpoint itself rejects bad credentials.
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      clearSession();
    }

    const error = payload?.error || {};
    throw new ApiError(
      error.message || `Request failed with status ${response.status}`,
      response.status,
      error.code,
      error.details,
    );
  }

  return payload;
}

export const api = {
  get: (path, query) => request(path, { query }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};
