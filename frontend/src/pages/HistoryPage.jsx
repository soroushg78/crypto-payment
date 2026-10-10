import React from 'react';

export default function HistoryPage({ history, onClear, onCopy }) {
  return (
    <div className="card-panel">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <h2 className="card-title">سوابق فاکتورهای ایجاد شده در این نشست</h2>
        {history.length > 0 && (
          <button
            className="btn-sim-action"
            style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.4)' }}
            onClick={onClear}
          >
            پاک کردن سوابق
          </button>
        )}
      </div>

      {history.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="history-table">
            <thead>
              <tr>
                <th>شماره فاکتور</th>
                <th>خدمت</th>
                <th>مبلغ کریپتو</th>
                <th>شبکه</th>
                <th>Comment / Memo</th>
                <th>آدرس والت</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {history.map((inv) => (
                <tr key={inv.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', direction: 'ltr' }}>
                    {inv.invoice_number}
                  </td>
                  <td>{inv.service_title || 'سفارش'}</td>
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--cyan-glow)',
                      direction: 'ltr',
                      fontWeight: 700
                    }}
                  >
                    {inv.crypto_amount} {inv.currency_symbol}
                  </td>
                  <td>{inv.network_name || inv.network_id}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', color: '#fbbf24', fontWeight: 800 }}>
                    {inv.pay_memo || '-'}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', direction: 'ltr' }}>
                    {inv.pay_address ? (
                      <span
                        style={{ cursor: 'pointer', color: 'var(--cyan)' }}
                        onClick={() => onCopy?.(inv.pay_address, 'آدرس کیف پول')}
                        title="کلیک برای کپی"
                      >
                        {inv.pay_address.slice(0, 8)}...{inv.pay_address.slice(-6)} 📋
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    <span className={`inv-status-badge status-${inv.status}`}>{inv.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2.5rem 0' }}>
          هنوز فاکتوری در این نشست صادر نشده است.
        </p>
      )}
    </div>
  );
}
