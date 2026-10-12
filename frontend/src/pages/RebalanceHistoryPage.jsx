import React, { useState, useEffect } from 'react';
import { rebalanceApi } from '../api/rebalanceApi';

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
        onShowToast?.('سوابق ریبالانسینگ مستقیماً از دیتابیس PostgreSQL به‌روزرسانی شد! 🔄', 'success');
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
    onShowToast?.(`${label} کپی شد! 📋`, 'success');
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
    if (asset === 'USDT') {
      return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    return num.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
  };

  // Filter records by Asset and Search Query only (No mock/sim mode)
  const filteredRecords = records.filter((r) => {
    if (assetFilter !== 'ALL' && (r.asset || '').toUpperCase() !== assetFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchHash = (r.tx_hash || '').toLowerCase().includes(q);
      const matchFrom = (r.from_address || '').toLowerCase().includes(q);
      const matchTo = (r.to_address || '').toLowerCase().includes(q);
      const matchAsset = (r.asset || '').toLowerCase().includes(q);
      const matchIdx = r.derivation_index !== null && r.derivation_index !== undefined && String(r.derivation_index).includes(q);
      return matchHash || matchFrom || matchTo || matchAsset || matchIdx;
    }
    return true;
  });

  // Calculate real statistics
  const totalCount = records.length;
  const isSuccess = (status) => status === 'SUCCESS' || status === 'COMPLETED';

  const totalUsdtSwept = records
    .filter((r) => (r.asset || '').toUpperCase() === 'USDT' && isSuccess(r.status))
    .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

  const totalBnbSwept = records
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
            <span>📊</span> سوابق و لاگ ریبالانسینگ بایننس اسمارت چین (BSC Sweeper & Gas Station)
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <button
            className="btn-sim-action"
            onClick={() => fetchRecords(true)}
            disabled={loading || refreshing}
            style={{ padding: '0.6rem 1.25rem', borderColor: 'var(--cyan)' }}
          >
            {refreshing ? 'در حال همگام‌سازی از DB...' : '🔄 به‌روزرسانی زنده از دیتابیس'}
          </button>
        </div>
      </div>

      {/* KPI Stats Bar (Real Production Stats) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.8rem',
          marginBottom: '1.5rem',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '1rem',
          borderRadius: '12px',
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            کل عملیات ریبالانسینگ BSC:
          </span>
          <strong style={{ fontSize: '1.15rem', color: 'var(--cyan-glow)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{totalCount}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>تراکنش</span>
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            وضعیت اجرای عملیات:
          </span>
          <strong style={{ fontSize: '0.92rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>۱۰۰٪ آنچین و زنده 🚀</span>
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            مجموع تتر تجمیع شده (USDT):
          </span>
          <strong style={{ fontSize: '1.15rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{totalUsdtSwept.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>USDT</span>
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            مجموع BNB تجمیع شده:
          </span>
          <strong style={{ fontSize: '1.15rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{totalBnbSwept.toFixed(4)}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>BNB</span>
          </strong>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>
            کارمزد گس مصرفی Gas Station:
          </span>
          <strong style={{ fontSize: '1.05rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>{totalGasBnb.toFixed(6)}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>BNB</span>
          </strong>
        </div>
      </div>

      {/* Filter and Search Bar (Clean - No Mock/Mode Filter) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.25rem',
          background: 'rgba(30, 41, 59, 0.4)',
          padding: '0.75rem 1rem',
          borderRadius: '10px'
        }}
      >
        {/* Asset Filter Only */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginLeft: '0.3rem' }}>فیلتر دارایی:</span>
          <button
            className="btn-sim-action"
            style={{
              padding: '0.35rem 0.8rem',
              fontSize: '0.78rem',
              backgroundColor: assetFilter === 'ALL' ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
              borderColor: assetFilter === 'ALL' ? 'var(--cyan)' : 'rgba(255, 255, 255, 0.1)',
              color: assetFilter === 'ALL' ? 'var(--cyan-glow)' : 'var(--text-muted)'
            }}
            onClick={() => setAssetFilter('ALL')}
          >
            همه دارایی‌ها
          </button>
          <button
            className="btn-sim-action"
            style={{
              padding: '0.35rem 0.8rem',
              fontSize: '0.78rem',
              backgroundColor: assetFilter === 'USDT' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              borderColor: assetFilter === 'USDT' ? '#10b981' : 'rgba(255, 255, 255, 0.1)',
              color: assetFilter === 'USDT' ? '#34d399' : 'var(--text-muted)'
            }}
            onClick={() => setAssetFilter('USDT')}
          >
            تتر (USDT)
          </button>
          <button
            className="btn-sim-action"
            style={{
              padding: '0.35rem 0.8rem',
              fontSize: '0.78rem',
              backgroundColor: assetFilter === 'BNB' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              borderColor: assetFilter === 'BNB' ? '#f59e0b' : 'rgba(255, 255, 255, 0.1)',
              color: assetFilter === 'BNB' ? '#fbbf24' : 'var(--text-muted)'
            }}
            onClick={() => setAssetFilter('BNB')}
          >
            بی‌ان‌بی (BNB)
          </button>
        </div>

        {/* Search Input */}
        <div style={{ minWidth: '240px', flex: '1', maxWidth: '380px' }}>
          <input
            type="text"
            className="form-control"
            placeholder="🔍 جستجو بر اساس هش، آدرس والت یا اندیس..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.85rem',
              fontSize: '0.82rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#fff'
            }}
          />
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#fca5a5',
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.85rem'
          }}
        >
          ❌ {error}
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏳</div>
          <div>در حال بارگذاری سوابق ریبالانسینگ BSC از دیتابیس PostgreSQL...</div>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '12px',
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
          <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>هیچ رکورد ریبالانسینگی یافت نشد</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
            {searchQuery
              ? 'هیچ نتیجه‌ای مطابق با عبارت جستجوی شما پیدا نشد.'
              : 'هنوز هیچ عملیات ریبالانسینگ آنچینی ثبت نشده است. پس از اجرای سوئیپ واقعی روی شبکه بایننس، لاگ‌های رسمی تراکنش در این جدول ثبت می‌شوند.'}
          </p>
        </div>
      ) : (
        /* Data Table (Fixed width 100%, NO Horizontal Scrolling) */
        <div style={{ width: '100%', overflow: 'hidden', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <table
            className="custom-table"
            style={{
              width: '100%',
              tableLayout: 'fixed',
              borderCollapse: 'collapse',
              fontSize: '0.82rem'
            }}
          >
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ width: '13%', padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>زمان ثبت</th>
                <th style={{ width: '21%', padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>ولت اشتقاقی مبدأ (From)</th>
                <th style={{ width: '18%', padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>خزانه‌داری مقصد (Master)</th>
                <th style={{ width: '13%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>دارایی و مقدار</th>
                <th style={{ width: '12%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>کارمزد سوخت Gas</th>
                <th style={{ width: '9%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>وضعیت</th>
                <th style={{ width: '14%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>هش تراکنش آنچین</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r, idx) => {
                const bscExplorerUrl = `https://bscscan.com/tx/${r.tx_hash}`;

                return (
                  <tr
                    key={r.id || idx}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.25)' : 'transparent'
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
                              color: 'var(--cyan-glow)',
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
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--cyan)',
                                cursor: 'pointer',
                                padding: '1px',
                                fontSize: '0.72rem'
                              }}
                              title="کپی آدرس مبدأ"
                            >
                              📋
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
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--cyan)',
                              cursor: 'pointer',
                              padding: '1px',
                              fontSize: '0.72rem'
                            }}
                            title="کپی آدرس خزانه‌داری"
                          >
                            📋
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Amount & Asset */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 700, color: r.asset === 'USDT' ? '#10b981' : '#fbbf24', fontSize: '0.88rem' }}>
                        {formatAmount(r.amount, r.asset)}
                      </span>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginRight: '0.25rem' }}>
                        {r.asset}
                      </span>
                    </td>

                    {/* Gas Fee */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span style={{ color: '#fbbf24', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
                        {(Number(r.gas_fee_bnb ?? r.gas_fee) || 0) > 0 ? `${Number(r.gas_fee_bnb ?? r.gas_fee).toFixed(6)}` : '0'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginRight: '0.2rem' }}>
                        BNB
                      </span>
                    </td>

                    {/* Status Badge (Pure Production Status) */}
                    <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          backgroundColor: isSuccess(r.status) ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isSuccess(r.status) ? '#34d399' : '#f87171',
                          border: isSuccess(r.status) ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                        }}
                      >
                        {isSuccess(r.status) ? 'موفق ✅' : 'ناموفق ❌'}
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
                                color: 'var(--cyan)',
                                textDecoration: 'none',
                                fontFamily: 'monospace',
                                fontSize: '0.76rem',
                                background: 'rgba(6, 182, 212, 0.1)',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                border: '1px solid rgba(6, 182, 212, 0.25)'
                              }}
                              title="مشاهده در بلاک‌اکسپلورر BscScan"
                            >
                              <span>{r.tx_hash.slice(0, 6)}...{r.tx_hash.slice(-4)}</span>
                              <span style={{ fontSize: '0.68rem', marginRight: '0.2rem' }}>↗</span>
                            </a>
                            <button
                              onClick={() => handleCopy(r.tx_hash, 'هش تراکنش')}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                padding: '1px',
                                fontSize: '0.72rem'
                              }}
                              title="کپی هش تراکنش"
                            >
                              📋
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
