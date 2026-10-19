import React, { createContext, useContext, useState, useEffect } from 'react';

import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

const STORAGE_KEY = 'crypto_service_auth_token';
const USER_KEY = 'crypto_service_auth_user';
const EXPIRY_KEY = 'crypto_service_auth_expires_at';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const isSessionValid = () => {
  try {
    const token = localStorage.getItem(STORAGE_KEY);
    const expiryStr = localStorage.getItem(EXPIRY_KEY);
    if (!token || !expiryStr) return false;

    const expiryTime = parseInt(expiryStr, 10);
    if (isNaN(expiryTime) || Date.now() >= expiryTime) {
      // Session has expired! Clear storage
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(EXPIRY_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (!isSessionValid()) return null;
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return isSessionValid();
  });

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRY_KEY);
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (username, password) => {
    if (!username || !password) {
      throw new Error('نام کاربری و کلمه عبور الزامی است');
    }

    const data = await authApi.login(username.trim(), password);
    const { token, admin, expires_at } = data;

    // Set 24-hour expiration timestamp
    const expiryTimestamp = expires_at
      ? new Date(expires_at).getTime()
      : Date.now() + TWENTY_FOUR_HOURS_MS;

    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(admin));
    localStorage.setItem(EXPIRY_KEY, expiryTimestamp.toString());

    setUser(admin);
    setIsAuthenticated(true);
    return admin;
  };

  // Heartbeat to automatically log out when 24-hour window expires
  useEffect(() => {
    const checkExpiry = () => {
      if (isAuthenticated && !isSessionValid()) {
        logout();
      }
    };

    // Check every 30 seconds and when user switches back to browser tab
    const interval = setInterval(checkExpiry, 30000);
    window.addEventListener('focus', checkExpiry);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkExpiry);
    };
  }, [isAuthenticated]);

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
