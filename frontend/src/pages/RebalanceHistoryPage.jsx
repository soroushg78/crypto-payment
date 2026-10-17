import React, { useState, useEffect } from 'react';
import { rebalanceApi } from '../api/rebalanceApi';
import {
  BarChart3,
  RefreshCw,
  Activity,
  Search,
  AlertTriangle,
  Loader2,
  Inbox,
  Copy,
  CheckCircle2,
  XCircle,
  ExternalLink
} from 'lucide-react';

export default function RebalanceHistoryPage({ onShowToast, onNavigateToRebalance }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [assetFilter, setAssetFilter] = useState('ALL'); // 'ALL', 'USDT', 'BNB'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecords = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await rebalanceApi.getRebalanceRecords(150);
      const list = Array.isArray(res) ? res : res?.data || [];
      // Ensure only real BSC rebalance records are loaded
      const bscList = list.filter((r) => {
        const net = (r.network_id || r.network || '').toLowerCase();
        return net === 'bsc' || net === '' || net.includes('bep');
      });
      setRecords(bscList);

      if (isManual) {
        onShowToast?.('سوابق ریبالانسینگ مستقیماً از دیتابیس PostgreSQL به‌روزرسانی شد', 'success');
      }
    } catch (err) {
      console.error('Failed to fetch rebalance records:', err);
      setError(err.message || 'خطا در ارتباط با سرور و دیتابیس');
      if (isManual) {
        onShowToast?.(`خطا در استعلام سوابق: ${err.message}`, 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    onShowToast?.(`${label} کپی شد`, 'success');
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

  const formatAmount = (amt, asset) => {
    if (amt === undefined || amt === null) return '0';
    const num = Number(amt);
    if (isNaN(num)) return amt;
    return asset === 'USDT' ? num.toFixed(2) : num.toFixed(6);
  };

  const isSuccess = (status) => {
    const s = (status || '').toUpperCase();
    return s === 'COMPLETED' || s === 'SUCCESS' || s === 'CONFIRMED';
  };

  // Filter and Search logic
  const filteredRecords = records.filter((r) => {
    // 1. Asset Filter
    if (assetFilter !== 'ALL' && (r.asset || '').toUpperCase() !== assetFilter) {
      return false;
    }

    // 2. Search Query (Filter by tx_hash, from_address, to_address, derivation_index)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTx = (r.tx_hash || '').toLowerCase().includes(q);
      const matchFrom = (r.from_address || '').toLowerCase().includes(q);
      const matchTo = (r.to_address || '').toLowerCase().includes(q);
      const matchIndex = String(r.derivation_index ?? '').includes(q);
      return matchTx || matchFrom || matchTo || matchIndex;
    }

    return true;
  });

  // Calculate high-level stats
  const totalCount = records.length;
  const successfulCount = records.filter((r) => isSuccess(r.status)).length;
  const failedCount = totalCount - successfulCount;

  const totalSweptUSDT = records
    .filter((r) => (r.asset || '').toUpperCase() === 'USDT' && isSuccess(r.status))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalSweptBNB = records
    .filter((r) => (r.asset || '').toUpperCase() === 'BNB' && isSuccess(r.status))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalGasBnb = records
    .reduce((sum, r) => sum + (Number(r.gas_fee_bnb ?? r.gas_fee) || 0), 0);

  return (
    <div className="card-panel">
      {/* Header and Controls */}
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
            <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
            سوابق و لاگ ریبالانسینگ بایننس اسمارت چین (BSC Sweeper & Gas Station)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn-sim-action"
            onClick={() => fetchRecords(true)}
            disabled={loading || refreshing}
            style={{ padding: '0.6rem 1.25rem', borderColor: '#334366' }}
          >
            {refreshing ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                در حال همگام‌سازی از DB...
              </>
            ) : (
              <>
                <RefreshCw size={14} />
                به‌روزرسانی زنده از دیتابیس
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.8rem',
          marginBottom: '1.5rem',
          background: '#0f172a',
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            کل عملیات ریبالانسینگ BSC:
          </span>
          <strong style={{ fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{totalCount}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>تراکنش</span>
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            وضعیت شبکه:
          </span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--emerald-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Activity size={16} />
            <span>۱۰۰٪ آنچین و زنده</span>
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            مجموع تتر (USDT) منتقل‌شده:
          </span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--emerald-text)', direction: 'ltr', display: 'inline-block' }}>
            ${totalSweptUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            مجموع کارمزد گس (Gas Paid):
          </span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--amber-text)', direction: 'ltr', display: 'inline-block' }}>
            {totalGasBnb.toFixed(5)} BNB
          </strong>
        </div>
      </div>

      {/* Filters and Search Toolbar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.25rem',
          flexWrap: 'wrap',
          background: '#0f172a',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          border: '1px solid var(--border-color)'
        }}
      >
        {/* Asset Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>فیلتر دارایی:</span>
          <button
            style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: assetFilter === 'ALL' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              background: assetFilter === 'ALL' ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
              color: assetFilter === 'ALL' ? '#93c5fd' : 'var(--text-muted)'
            }}
            onClick={() => setAssetFilter('ALL')}
          >
            همه موارد
          </button>
          <button
            style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: assetFilter === 'USDT' ? '1px solid var(--emerald)' : '1px solid var(--border-color)',
              background: assetFilter === 'USDT' ? 'rgba(5, 150, 105, 0.15)' : 'transparent',
              color: assetFilter === 'USDT' ? 'var(--emerald-text)' : 'var(--text-muted)'
            }}
            onClick={() => setAssetFilter('USDT')}
          >
            تتر (USDT)
          </button>
          <button
            style={{
              padding: '0.3rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              border: assetFilter === 'BNB' ? '1px solid var(--amber)' : '1px solid var(--border-color)',
              background: assetFilter === 'BNB' ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
              color: assetFilter === 'BNB' ? 'var(--amber-text)' : 'var(--text-muted)'
            }}
            onClick={() => setAssetFilter('BNB')}
          >
            بی‌ان‌بی (BNB)
          </button>
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '240px', flex: '1', maxWidth: '380px', position: 'relative' }}>
          <input
            type="text"
            className="input-custom"
            placeholder="جستجو بر اساس هش، آدرس والت یا اندیس..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem'
            }}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: 'var(--rose-subtle)',
            border: '1px solid var(--rose)',
            color: '#fca5a5',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
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

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
          <div>در حال بارگذاری سوابق ریبالانسینگ BSC از دیتابیس PostgreSQL...</div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: '#0f172a',
            borderRadius: '10px',
            border: '1px dashed var(--border-color)'
          }}
        >
          <Inbox size={36} style={{ color: 'var(--text-dim)', margin: '0 auto 0.75rem' }} />
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>هیچ رکورد ریبالانسینگی یافت نشد</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            {searchQuery
              ? 'هیچ نتیجه‌ای مطابق با عبارت جستجوی شما پیدا نشد.'
              : 'هنوز هیچ عملیات ریبالانسینگ آنچینی ثبت نشده است. پس از اجرای سوئیپ واقعی روی شبکه بایننس، لاگ‌های رسمی تراکنش در این جدول ثبت می‌شوند.'}
          </p>
        </div>
      ) : (
        /* Data Table */
        <div style={{ width: '100%', overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <table
            className="history-table"
            style={{ width: '100%' }}
          >
            <thead>
              <tr>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>زمان ثبت</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>ولت اشتقاقی مبدأ (From)</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>خزانه‌داری مقصد (Master)</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>دارایی و مقدار</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کارمزد سوخت Gas</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>وضعیت</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>هش تراکنش آنچین</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, idx) => {
                const bscExplorerUrl = `https://bscscan.com/tx/${r.tx_hash}`;

                return (
                  <tr
                    key={r.id || idx}
                    style={{
                      backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.4)' : 'transparent'
                    }}
                  >
                    {/* Date and Time */}
                    <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#cbd5e1', fontSize: '0.78rem' }}>{formatDate(r.created_at)}</span>
                    </td>

                    {/* From Wallet & Derivation */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#fbbf24',
                              backgroundColor: 'rgba(245, 158, 11, 0.12)',
                              padding: '0.1rem 0.35rem',
                              borderRadius: '4px'
                            }}
                          >
                            {r.derivation_index !== null && r.derivation_index !== undefined ? `ولت #${r.derivation_index}` : 'BSC'}
                          </span>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '0.76rem',
                              color: '#93c5fd',
                              direction: 'ltr',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={r.from_address}
                          >
                            {r.from_address ? `${r.from_address.slice(0, 6)}...${r.from_address.slice(-4)}` : '-'}
                          </span>
                          {r.from_address && (
                            <button
                              onClick={() => handleCopy(r.from_address, 'آدرس ولت مبدأ')}
                              className="copy-icon-btn"
                              title="کپی آدرس مبدأ"
                            >
                              <Copy size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* To Address (Master Treasury) */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '0.76rem',
                            color: '#e2e8f0',
                            direction: 'ltr',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                          title={r.to_address}
                        >
                          {r.to_address ? `${r.to_address.slice(0, 6)}...${r.to_address.slice(-4)}` : '-'}
                        </span>
                        {r.to_address && (
                          <button
                            onClick={() => handleCopy(r.to_address, 'آدرس خزانه‌داری')}
                            className="copy-icon-btn"
                            title="کپی آدرس خزانه‌داری"
                          >
                            <Copy size={11} />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Amount & Asset */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: r.asset === 'USDT' ? 'var(--emerald-text)' : 'var(--amber-text)', fontSize: '0.88rem' }}>
                        {formatAmount(r.amount, r.asset)}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                        {r.asset}
                      </span>
                    </td>

                    {/* Gas Fee */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--amber-text)', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {(Number(r.gas_fee_bnb ?? r.gas_fee) || 0) > 0 ? `${Number(r.gas_fee_bnb ?? r.gas_fee).toFixed(6)}` : '0'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginRight: '0.2rem' }}>
                        BNB
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: isSuccess(r.status) ? 'var(--emerald-subtle)' : 'var(--rose-subtle)',
                          color: isSuccess(r.status) ? 'var(--emerald-text)' : 'var(--rose-text)',
                          border: isSuccess(r.status) ? '1px solid rgba(5, 150, 105, 0.4)' : '1px solid rgba(225, 29, 72, 0.4)'
                        }}
                      >
                        {isSuccess(r.status) ? (
                          <>
                            <CheckCircle2 size={12} />
                            <span>موفق</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={12} />
                            <span>ناموفق</span>
                          </>
                        )}
                      </span>
                    </td>

                    {/* Transaction Hash & Link */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}>
                        {r.tx_hash ? (
                          <>
                            <a
                              href={bscExplorerUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                color: '#93c5fd',
                                textDecoration: 'none',
                                fontFamily: 'monospace',
                                fontSize: '0.76rem',
                                background: '#1e293b',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem'
                              }}
                              title="مشاهده در بلاک‌اکسپلورر BscScan"
                            >
                              <span>{r.tx_hash.slice(0, 6)}...{r.tx_hash.slice(-4)}</span>
                              <ExternalLink size={10} />
                            </a>
                            <button
                              onClick={() => handleCopy(r.tx_hash, 'هش تراکنش')}
                              className="copy-icon-btn"
                              title="کپی هش تراکنش"
                            >
                              <Copy size={11} />
                            </button>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.74rem' }}>ثبت نشده</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
