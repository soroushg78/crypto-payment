import React from 'react';

export default function Toast({ message, type = 'info' }) {
  if (!message) return null;

  const bgStyle =
    type === 'error'
      ? { borderColor: 'var(--rose)', color: '#fda4af' }
      : type === 'success'
      ? { borderColor: 'var(--emerald)', color: '#6ee7b7' }
      : { borderColor: 'var(--cyan)', color: '#bae6fd' };

  return (
    <div className="toast-msg" style={bgStyle}>
      {message}
    </div>
  );
}
