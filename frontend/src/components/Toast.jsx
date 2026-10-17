import React from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export default function Toast({ message, type = 'info' }) {
  if (!message) return null;

  const borderStyle =
    type === 'error'
      ? { borderColor: 'var(--rose)', color: '#fda4af' }
      : type === 'success'
      ? { borderColor: 'var(--emerald)', color: '#6ee7b7' }
      : { borderColor: 'var(--primary)', color: '#93c5fd' };

  return (
    <div className="toast-msg" style={borderStyle}>
      {type === 'error' && <AlertCircle size={16} />}
      {type === 'success' && <CheckCircle2 size={16} />}
      {type === 'info' && <Info size={16} />}
      <span>{message}</span>
    </div>
  );
}
