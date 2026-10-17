import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, AlertTriangle, LogIn, Loader2 } from 'lucide-react';

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
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border-color)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            className="brand-icon-box"
            style={{ margin: '0 auto 1rem', width: '52px', height: '52px' }}
          >
            <Lock size={24} />
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', marginBottom: '0.4rem' }}>
            ورود به داشبورد درگاه پرداخت
          </h2>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--rose-subtle)',
              border: '1px solid var(--rose)',
              color: '#fda4af',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <AlertTriangle size={16} />
            <span>{error}</span>
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
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                در حال احراز هویت...
              </>
            ) : (
              <>
                <LogIn size={16} />
                ورود به سامانه
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
