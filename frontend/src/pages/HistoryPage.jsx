import React, { useState, useEffect } from 'react';
import { invoiceApi } from '../api/invoiceApi';
import {
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Loader2,
  ExternalLink
} from 'lucide-react';

export default function HistoryPage({ onCopy, onCountUpdated, onShowToast }) {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchInvoices = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await invoiceApi.listInvoices(100);
      const list = Array.isArray(res) ? res : res?.data || [];
      setInvoices(list);
      onCountUpdated?.(list.length);

      if (isManual) {
        onShowToast?.('سوابق فاکتورها مستقیماً از دیتابیس PostgreSQL به‌روزرسانی شد', 'success');
      }
    } catch (err) {
      console.error('Failed to fetch invoices from DB:', err);
      setError(err.message || 'خطا در ارتباط با سرور و دیتابیس');
      if (isManual) {
        onShowToast?.(`خطا در دریافت سوابق: ${err.message}`, 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const paidCount = invoices.filter((i) => i.status === 'PAID').length;
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length;
  const expiredCount = invoices.filter((i) => i.status === 'EXPIRED').length;

  const formatCrypto = (amt) => {
    if (amt === undefined || amt === null) return '0';
    const num = Number(amt);
    if (isNaN(num)) return amt;
    if (num < 1) {
      return num.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }
    return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString('fa-IR')} ${d.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="card-panel">
      {/* Header & Controls */}
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
        <div>
          <h2 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} />
            سوابق رسمی سفارشات در دیتابیس (PostgreSQL Live Ledger)
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 0 0' }}>
            تمامی فاکتورها مستقیماً از جدول دیتابیس سرور بارگذاری می‌شوند و وضعیت‌های تسویه آنچین همگام هستند.
          </p>
        </div>

        <button
          className="btn-sim-action"
          onClick={() => fetchInvoices(true)}
          disabled={loading || refreshing}
          style={{ padding: '0.6rem 1.2rem', borderColor: '#334366' }}
        >
          {refreshing ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              در حال استعلام نود و DB...
            </>
          ) : (
            <>
              <RefreshCw size={14} />
              استعلام مستقیم از دیتابیس
            </>
          )}
        </button>
      </div>

      {/* Summary KPI Badges */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.8rem',
          marginBottom: '1.5rem',
          background: '#0f172a',
          padding: '0.9rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>کل فاکتورها:</span>
          <strong style={{ fontSize: '1.1rem', color: '#f8fafc', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{invoices.length}</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>سفارش</span>
          </strong>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>تسویه‌شده آنچین:</span>
          <strong style={{ fontSize: '1.1rem', color: 'var(--emerald-text)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{paidCount} پرداخت‌شده</span>
            <CheckCircle2 size={14} />
          </strong>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>در انتظار پرداخت:</span>
          <strong style={{ fontSize: '1.1rem', color: 'var(--amber-text)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{pendingCount} فاکتور</span>
            <Clock size={14} />
          </strong>
        </div>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>منقضی‌شده:</span>
          <strong style={{ fontSize: '1.1rem', color: '#94a3b8', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{expiredCount}</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>فاکتور</span>
          </strong>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: 'var(--rose-subtle)',
            border: '1px solid var(--rose)',
            borderRadius: '8px',
            padding: '0.8rem',
            color: '#fda4af',
            marginBottom: '1rem',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
          <Loader2 size={18} className="animate-spin" />
          <span>در حال دریافت سوابق سفارشات و تراکنش‌ها...</span>
        </div>
      ) : invoices.length > 0 ? (
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <table className="history-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ whiteSpace: 'nowrap' }}>شماره فاکتور</th>
                <th style={{ whiteSpace: 'nowrap' }}>کاربر تلگرام</th>
                <th style={{ whiteSpace: 'nowrap' }}>مبلغ پرداختی</th>
                <th style={{ whiteSpace: 'nowrap' }}>شبکه</th>
                <th style={{ whiteSpace: 'nowrap' }}>آدرس ولت یا ممو</th>
                <th style={{ whiteSpace: 'nowrap' }}>وضعیت تسویه</th>
                <th style={{ whiteSpace: 'nowrap' }}>تاریخ صدور</th>
                <th style={{ whiteSpace: 'nowrap' }}>تاریخ پرداخت</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  {/* شماره فاکتور */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', direction: 'ltr', fontWeight: 700, color: '#f8fafc', fontSize: '0.82rem' }}>
                      {inv.invoice_number}
                    </div>
                  </td>

                  {/* کاربر تلگرام */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {inv.telegram_username ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', direction: 'ltr' }}>
                        <span style={{ color: '#93c5fd', fontWeight: 700, fontSize: '0.82rem' }}>
                          @{inv.telegram_username.replace(/^@/, '')}
                        </span>
                        {inv.telegram_id && (
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                            ID: {inv.telegram_id}
                          </span>
                        )}
                      </div>
                    ) : inv.telegram_id ? (
                      <span style={{ color: '#93c5fd', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', direction: 'ltr' }}>
                        ID: {inv.telegram_id}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>-</span>
                    )}
                  </td>

                  {/* مبلغ کریپتو + معادل دلاری */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        color: '#f8fafc',
                        direction: 'ltr',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                      title={`${inv.crypto_amount} ${inv.currency_symbol}`}
                    >
                      {formatCrypto(inv.crypto_amount)} {inv.currency_symbol}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', direction: 'ltr', marginTop: '2px' }}>
                      ≈ ${inv.amount_usd} USD
                    </div>
                  </td>

                  {/* شبکه */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        background: '#0f172a',
                        border: '1px solid var(--border-color)',
                        color: inv.network_id?.toLowerCase() === 'ton' ? '#38bdf8' : '#e2e8f0',
                        fontWeight: 600
                      }}
                    >
                      {inv.network_id?.toLowerCase() === 'ton' ? 'TON Network' : (inv.network_id?.toLowerCase() === 'bsc' ? 'BSC (BEP20)' : (inv.network_name || inv.network_id))}
                    </span>
                  </td>

                  {/* آدرس ولت واریزی و ممو */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {inv.network_id?.toLowerCase() === 'ton' ? (
                      inv.pay_memo ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                            {inv.pay_memo}
                          </span>
                          <button
                            className="copy-icon-btn"
                            onClick={() => onCopy?.(inv.pay_memo, 'ممو')}
                            title="کپی ممو"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>-</span>
                      )
                    ) : inv.pay_address ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                          <a
                            href={`https://bscscan.com/address/${inv.pay_address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#93c5fd', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            title="مشاهده در BscScan"
                          >
                            {inv.pay_address.slice(0, 6)}...{inv.pay_address.slice(-4)}
                            <ExternalLink size={11} />
                          </a>
                          <button
                            className="copy-icon-btn"
                            onClick={() => onCopy?.(inv.pay_address, 'آدرس کیف پول')}
                            title="کپی آدرس"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                        {inv.pay_memo && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '3px' }}>
                            <span style={{ fontSize: '0.7rem', color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                              {inv.pay_memo}
                            </span>
                            <button
                              className="copy-icon-btn"
                              onClick={() => onCopy?.(inv.pay_memo, 'ممو')}
                              title="کپی ممو"
                            >
                              <Copy size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>

                  {/* وضعیت تسویه */}
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {inv.status === 'PAID' ? (
                      <span
                        className="badge status-PAID"
                        style={{ fontWeight: 700, fontSize: '0.78rem' }}
                      >
                        <CheckCircle2 size={13} />
                        <span>پرداخت شد</span>
                      </span>
                    ) : inv.status === 'PENDING' ? (
                      <span
                        className="badge status-PENDING"
                        style={{ fontWeight: 600, fontSize: '0.78rem' }}
                      >
                        <Clock size={13} />
                        <span>در انتظار (PENDING)</span>
                      </span>
                    ) : (
                      <span
                        className="badge status-EXPIRED"
                        style={{ fontSize: '0.78rem' }}
                      >
                        {inv.status}
                      </span>
                    )}
                  </td>

                  {/* تاریخ صدور */}
                  <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatDate(inv.created_at)}
                  </td>

                  {/* تاریخ پرداخت */}
                  <td style={{ fontSize: '0.76rem', color: inv.paid_at ? 'var(--emerald-text)' : 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                    {formatDate(inv.paid_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2.5rem 0' }}>
          هنوز هیچ فاکتوری در دیتابیس ثبت نشده است. ابتدا در تب "صدور فاکتور" یک فاکتور بسازید.
        </p>
      )}
    </div>
  );
}
