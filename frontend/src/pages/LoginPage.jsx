import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
    } catch (err) {
      setError(err.message || 'خطا در ورود به سیستم');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '80vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div
        className="card-panel"
        style={{
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          border: '1px solid var(--border-glow)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            className="brand-icon-box"
            style={{ margin: '0 auto 1rem', width: '56px', height: '56px', fontSize: '1.8rem' }}
          >
            🔒
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', marginBottom: '0.4rem' }}>
            ورود به داشبورد درگاه پرداخت
          </h2>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid var(--rose)',
              color: '#fda4af',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontSize: '0.85rem',
              marginBottom: '1.25rem'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="selector-group">
            <label className="selector-label">نام کاربری:</label>
            <input
              type="text"
              className="input-custom"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="نام کاربری..."
              autoFocus
              required
            />
          </div>

          <div className="selector-group">
            <label className="selector-label">رمز عبور:</label>
            <input
              type="password"
              className="input-custom"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز عبور..."
              required
            />
          </div>

          <button
            type="submit"
            className="btn-submit"
            style={{ marginTop: '1.5rem' }}
            disabled={loading}
          >
            {loading ? 'در حال بررسی...' : 'ورود به پنل ➔'}
          </button>
        </form>
      </div>
    </div>
  );
}
