import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const STORAGE_KEY = 'crypto_service_auth_token';
const USER_KEY = 'crypto_service_auth_user';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  });

  const login = async (username, password) => {
    // اعتبارسنجی سطح دسترسی امن
    if (!username || !password) {
      throw new Error('نام کاربری و کلمه عبور الزامی است');
    }

    // بررسی ورود پیش‌فرض (قابل اتصال به اندپوینت لاگین در آینده)
    // نام کاربری و رمز پیش‌فرض داشبورد: admin / admin123
    if (username.trim().toLowerCase() === 'admin' && password === 'admin123') {
      const authUser = {
        username: 'admin',
        role: 'administrator',
        loginAt: new Date().toISOString()
      };
      const token = 'token_' + Math.random().toString(36).substring(2) + Date.now().toString(36);

      localStorage.setItem(STORAGE_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(authUser));

      setUser(authUser);
      setIsAuthenticated(true);
      return authUser;
    }

    throw new Error('نام کاربری یا رمز عبور اشتباه است (پیش‌فرض: admin / admin123)');
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
