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

    try {
      const response = await fetch(url, {
        ...options,
        headers,
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
