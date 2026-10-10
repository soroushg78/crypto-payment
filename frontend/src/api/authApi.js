import { apiClient } from './client';

export const authApi = {
  /**
   * لاگین ادمین از طریق بک‌اند با بررسی رمز هش شده Bcrypt و ریت‌لیمیت
   * @param {string} username
   * @param {string} password
   */
  async login(username, password) {
    return apiClient.post('/api/v1/auth/login', { username, password });
  }
};
