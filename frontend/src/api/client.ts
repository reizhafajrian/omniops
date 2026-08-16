/// <reference types="vite/client" />




const TOKEN_KEY = 'omniops_bearer_token';


/**
 * Get or set the Bearer Auth token from LocalStorage or runtime env.
 */
export function getStoredToken(): string {
  const envToken = import.meta.env.VITE_OMNIOPS_TOKEN;
  const stored = localStorage.getItem(TOKEN_KEY);

  if (stored && stored !== 'change_me_to_a_long_random_secret') {
    return stored;
  }
  if (envToken && envToken.trim() !== '') {
    return envToken.trim();
  }
  return stored || 'change_me_to_a_long_random_secret';
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Generic fetch wrapper attaching Authorization Bearer header.
 */
export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    if (isJson) {
      try {
        const errJson = await response.json();
        if (errJson && errJson.error) {
          errorMsg = errJson.error;
        }
      } catch {
        // Fallback
      }
    }
    throw new Error(errorMsg);
  }

  if (!isJson) {
    throw new Error('Backend engine returned non-JSON response. Please verify the Rust API backend is running at http://127.0.0.1:9090');
  }

  return response.json();
}


