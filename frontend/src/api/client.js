// Base API Client for Go Crypto Service backend

export const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? 'http://localhost:8080' : '');

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    // Check token and 24-hour expiration
    try {
      const token = localStorage.getItem('crypto_service_auth_token');
      const expiryStr = localStorage.getItem('crypto_service_auth_expires_at');
      if (token && expiryStr) {
        const expiry = parseInt(expiryStr, 10);
        if (Date.now() >= expiry) {
          // Token expired, purge storage
          localStorage.removeItem('crypto_service_auth_token');
          localStorage.removeItem('crypto_service_auth_user');
          localStorage.removeItem('crypto_service_auth_expires_at');
        } else {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
        signal: options.signal || AbortSignal.timeout(10000)
      });

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg = json?.error || `خطای سرور (${response.status})`;
        throw new Error(errorMsg);
      }

      if (json && json.success === false) {
        throw new Error(json.error || 'عملیات با خطا مواجه شد');
      }

      return json?.data !== undefined ? json.data : json;
    } catch (err) {
      if (err.name === 'TimeoutError') {
        throw new Error('زمان پاسخ‌دهی سرور به پایان رسید (Timeout)');
      }
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}

export const apiClient = new ApiClient();
