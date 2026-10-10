import React, { createContext, useContext, useState, useEffect } from 'react';

import { authApi } from '../api/authApi';

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
    if (!username || !password) {
      throw new Error('نام کاربری و کلمه عبور الزامی است');
    }

    const data = await authApi.login(username.trim(), password);
    const { token, admin } = data;

    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(admin));

    setUser(admin);
    setIsAuthenticated(true);
    return admin;
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
