import React, { useState, useEffect } from 'react';
import { rebalanceApi } from '../api/rebalanceApi';

const formatTehranDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const formatter = new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(d);
  } catch {
    return dateStr;
  }
};

export default function RebalancePage({ onShowToast, onNavigateToRecords }) {
  const [wallets, setWallets] = useState([]);
  const [securitySpecs, setSecuritySpecs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Individual Sweep Modal State
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [sweepAsset, setSweepAsset] = useState('USDT');
  const [treasuryAddr, setTreasuryAddr] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [sweepError, setSweepError] = useState('');
  const [gasEstimate, setGasEstimate] = useState(null);
  const [estimatingGas, setEstimatingGas] = useState(false);

  // Batch Multi-Select & Rebalance State
  const [selectedIndexes, setSelectedIndexes] = useState([]);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    running: false,
    currentStep: 0,
    totalSteps: 0,
    currentWallet: null,
    logs: [],
    completed: false
  });

  // TON Treasury State (Informational Only - TON is Memo-based Direct Treasury)
  const [tonData, setTonData] = useState(null);
  const [activeNetworkTab, setActiveNetworkTab] = useState('bsc'); // 'bsc' or 'ton'

  const fetchGasEstimate = async (wallet, asset, treasury) => {
    if (!wallet) return;
    try {
      setEstimatingGas(true);
      const est = await rebalanceApi.estimateGas({
        derivationIndex: wallet.derivation_index,
        asset: asset,
        treasuryAddress: treasury
      });
      setGasEstimate(est);
    } catch (err) {
      console.warn('Failed to estimate gas from node:', err);
    } finally {
      setEstimatingGas(false);
    }
  };

  const loadData = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [walletsData, specsData, tonTreasuryData] = await Promise.all([
        rebalanceApi.getBSCWallets(),
        rebalanceApi.getSecuritySpecs(),
        rebalanceApi.getTONTreasury().catch((err) => {
          console.warn('Failed to load TON treasury:', err);
          return null;
        })
      ]);

      setWallets(walletsData || []);
      setSecuritySpecs(specsData);
      if (tonTreasuryData) setTonData(tonTreasuryData);
      if (isManual) onShowToast?.('اطلاعات والت‌ها و موجودی‌های بلاکچین (BSC و TON) به‌روزرسانی شد.', 'success');
    } catch (err) {
      onShowToast?.(`خطا در دریافت اطلاعات ریبالانسینگ: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenSweep = (wallet) => {
    setSelectedWallet(wallet);
    const initialAsset = wallet.usdt_balance > 0 ? 'USDT' : 'BNB';
    setSweepAsset(initialAsset);
    setSweepResult(null);
    setSweepError('');
    setGasEstimate(null);
    fetchGasEstimate(wallet, initialAsset, treasuryAddr);
  };

  const handleAssetChange = (newAsset) => {
    setSweepAsset(newAsset);
    if (selectedWallet) {
      fetchGasEstimate(selectedWallet, newAsset, treasuryAddr);
    }
  };

  const handleExecuteSweep = async () => {
    if (!selectedWallet) return;
    try {
      setSweeping(true);
      setSweepResult(null);
      setSweepError('');

      const res = await rebalanceApi.sweepWallet({
        derivationIndex: selectedWallet.derivation_index,
        asset: sweepAsset,
        treasuryAddress: treasuryAddr,
        realBroadcast: true
      });

      setSweepResult(res);
      onShowToast?.(
        'تراکنش ریبالانسینگ واقعی به نود شبکه BSC ارسال و در دیتابیس ثبت گردید! 🚀✅',
        'success'
      );
      // Reload balances after sweep
      loadData(false);
    } catch (err) {
      setSweepError(err.message || 'خطا در اجرای سوئیپ');
      onShowToast?.(`خطا: ${err.message}`, 'error');
    } finally {
      setSweeping(false);
    }
  };

  const readyWallets = wallets.filter((w) => w.bnb_balance > 0.0005 || w.usdt_balance > 0);
  const isAllSelected = wallets.length > 0 && wallets.every((w) => selectedIndexes.includes(w.derivation_index));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIndexes([]);
    } else {
      setSelectedIndexes(wallets.map((w) => w.derivation_index));
    }
  };

  const toggleSelectWallet = (index) => {
    setSelectedIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const getTargetWalletsForBatch = () => {
    if (selectedIndexes.length > 0) {
      return wallets.filter((w) => selectedIndexes.includes(w.derivation_index));
    }
    return wallets;
  };

  const handleOpenBatchModal = () => {
    const targets = getTargetWalletsForBatch();
    if (targets.length === 0) {
      onShowToast?.('هیچ والتی با موجودی آماده جهت ریبالانس وجود ندارد', 'error');
      return;
    }
    setBatchProgress({
      running: false,
      currentStep: 0,
      totalSteps: targets.length,
      currentWallet: null,
      logs: [],
      completed: false
    });
    setShowBatchModal(true);
  };

  const handleExecuteBatchSweep = async () => {
    const targets = getTargetWalletsForBatch();
    if (targets.length === 0) return;

    setBatchProgress({
      running: true,
      currentStep: 0,
      totalSteps: targets.length,
      currentWallet: targets[0],
      logs: [],
      completed: false
    });

    const newLogs = [];
    for (let i = 0; i < targets.length; i++) {
      const w = targets[i];
      const asset = w.usdt_balance > 0 ? 'USDT' : 'BNB';

      setBatchProgress((prev) => ({
        ...prev,
        currentStep: i + 1,
        currentWallet: w
      }));

      try {
        const res = await rebalanceApi.sweepWallet({
          derivationIndex: w.derivation_index,
          asset: asset,
          treasuryAddress: treasuryAddr,
          realBroadcast: true
        });

        newLogs.push({
          success: true,
          index: w.derivation_index,
          address: w.address,
          asset: res.asset_swept || asset,
          amount: res.amount_swept,
          txHash: res.sweep_tx_hash,
          refuelTx: res.refuel_tx_hash,
          message: `والت #${w.derivation_index} با موفقیت ریبالانس شد`
        });
      } catch (err) {
        newLogs.push({
          success: false,
          index: w.derivation_index,
          address: w.address,
          asset: asset,
          message: `خطا در والت #${w.derivation_index}: ${err.message}`
        });
      }

      setBatchProgress((prev) => ({
        ...prev,
        logs: [...newLogs]
      }));
    }

    setBatchProgress((prev) => ({
      ...prev,
      running: false,
      completed: true
    }));

    onShowToast?.('عملیات ریبالانس دسته‌جمعی به پایان رسید! 🚀', 'success');
    loadData(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Network Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.8rem',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '0.5rem',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          flexWrap: 'wrap'
        }}
      >
        <button
          className={`tab-btn ${activeNetworkTab === 'bsc' ? 'active' : ''}`}
          onClick={() => setActiveNetworkTab('bsc')}
          style={{
            flex: '1 1 240px',
            padding: '0.8rem 1.2rem',
            borderRadius: '10px',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: activeNetworkTab === 'bsc' ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))' : 'transparent',
            borderColor: activeNetworkTab === 'bsc' ? '#fbbf24' : 'transparent',
            color: activeNetworkTab === 'bsc' ? '#fbbf24' : 'var(--text-muted)'
          }}
        >
          <span>🟡</span>
          <span>شبکه بایننس اسمارت چین (BSC HD-Wallets)</span>
          <span style={{ fontSize: '0.78rem', background: 'rgba(0,0,0,0.4)', padding: '2px 8px', borderRadius: '12px' }}>
            {wallets.length} والت
          </span>
        </button>

        <button
          className={`tab-btn ${activeNetworkTab === 'ton' ? 'active' : ''}`}
          onClick={() => setActiveNetworkTab('ton')}
          style={{
            flex: '1 1 240px',
            padding: '0.8rem 1.2rem',
            borderRadius: '10px',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: activeNetworkTab === 'ton' ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.25), rgba(2, 132, 199, 0.15))' : 'transparent',
            borderColor: activeNetworkTab === 'ton' ? '#38bdf8' : 'transparent',
            color: activeNetworkTab === 'ton' ? '#38bdf8' : 'var(--text-muted)'
          }}
        >
          <span>💎</span>
          <span>شبکه تون‌کوین و گرام (TON Master Treasury & Memo)</span>
          <span style={{ fontSize: '0.78rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px' }}>
            {tonData?.items?.length || 0} تراکنش
          </span>
        </button>
      </div>

      {/* BSC Section */}
      {activeNetworkTab === 'bsc' && (
        <>

          {/* 3. Live Wallets Table & Sweep Trigger */}
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📋</span> لیست والت‌های مشتریان و مدیریت ریبالانسینگ (BSC)
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  تعداد کل والت‌ها: <strong>{wallets.length}</strong> | آماده انتقال به خزانه: <strong style={{ color: readyWallets.length > 0 ? '#34d399' : 'var(--text-muted)' }}>{readyWallets.length}</strong>
                  {selectedIndexes.length > 0 && (
                    <span style={{ color: 'var(--cyan-glow)', marginRight: '0.5rem' }}>
                      | تیک‌خورده: <strong>{selectedIndexes.length} والت</strong>
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                {/* Batch Rebalance Selected */}
                {selectedIndexes.length > 0 && (
                  <button
                    className="btn-sim-action"
                    onClick={handleOpenBatchModal}
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #2563eb)',
                      color: '#fff',
                      borderColor: 'transparent',
                      padding: '0.55rem 1.1rem',
                      fontWeight: 700,
                      boxShadow: '0 4px 14px rgba(6, 182, 212, 0.4)'
                    }}
                  >
                    🚀 ریبالانس دسته‌جمعی ({selectedIndexes.length} والت انتخابی)
                  </button>
                )}

                {/* Batch Rebalance All Ready */}
                {readyWallets.length > 0 && selectedIndexes.length === 0 && (
                  <button
                    className="btn-sim-action"
                    onClick={handleOpenBatchModal}
                    style={{
                      background: 'rgba(52, 211, 153, 0.15)',
                      borderColor: '#34d399',
                      color: '#34d399',
                      padding: '0.55rem 1.1rem',
                      fontWeight: 700
                    }}
                  >
                    ⚡ ریبالانس یکجای همه والت‌های دارای موجودی ({readyWallets.length})
                  </button>
                )}

                <button
                  className="btn-sim-action"
                  onClick={() => loadData(true)}
                  disabled={refreshing || loading}
                  style={{ padding: '0.55rem 0.9rem' }}
                >
                  {refreshing ? 'در حال استعلام...' : '🔄 استعلام لحظه‌ای'}
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                در حال دریافت اطلاعات والت‌ها و استعلام نود BSC... ⏳
              </div>
            ) : wallets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                هنوز فاکتوری در شبکه BSC صادر نشده است. ابتدا در تب "صدور فاکتور" یک فاکتور BSC بسازید تا والت آن در اینجا نمایان شود.
              </div>
            ) : (
              <div style={{ width: '100%', overflow: 'hidden', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <table
                  className="custom-table"
                  style={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    fontSize: '0.82rem',
                    textAlign: 'right'
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ padding: '0.75rem 0.4rem', textAlign: 'center', width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={toggleSelectAll}
                          title="انتخاب همه گزینه‌ها"
                          style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                        />
                      </th>
                      <th style={{ width: '6%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>اندیس</th>
                      <th style={{ width: '18%', padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>آدرس ولت (EVM)</th>
                      <th style={{ width: '10%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>موجودی BNB</th>
                      <th style={{ width: '10%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>موجودی USDT</th>
                      <th style={{ width: '12%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>وضعیت سوئیپ</th>
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>زمان ایجاد فاکتور</th>
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>زمان پرداخت</th>
                      <th style={{ width: '14%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>عملیات ریبالانس</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w, idx) => {
                      const isChecked = selectedIndexes.includes(w.derivation_index);
                      const hasBalance = w.bnb_balance > 0.0005 || w.usdt_balance > 0;
                      return (
                        <tr
                          key={w.id || idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundColor: isChecked
                              ? 'rgba(6, 182, 212, 0.12)'
                              : idx % 2 === 0
                              ? 'rgba(15, 23, 42, 0.25)'
                              : 'transparent',
                            transition: 'background 0.2s'
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.4rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectWallet(w.derivation_index)}
                              style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontWeight: 'bold', color: 'var(--cyan)', textAlign: 'center' }}>
                            #{w.derivation_index}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            <span title={w.address} style={{ color: 'var(--cyan-glow)', fontSize: '0.78rem' }}>
                              {w.address.slice(0, 8)}...{w.address.slice(-6)}
                            </span>
                            <button
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--cyan)',
                                cursor: 'pointer',
                                padding: '1px',
                                fontSize: '0.72rem',
                                marginRight: '0.3rem'
                              }}
                              onClick={() => {
                                navigator.clipboard.writeText(w.address);
                                onShowToast?.('آدرس ولت کپی شد! ✅', 'success');
                              }}
                              title="کپی آدرس"
                            >
                              📋
                            </button>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: w.bnb_balance > 0 ? '#fbbf24' : 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                              {w.bnb_balance.toFixed(4)} BNB
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: w.usdt_balance > 0 ? '#10b981' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                              {w.usdt_balance.toFixed(2)} USDT
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {w.sweep_status === 'READY_USDT' && (
                              <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                آماده انتقال تتر ⚡
                              </span>
                            )}
                            {w.sweep_status === 'READY_BNB' && (
                              <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                آماده انتقال BNB ⚡
                              </span>
                            )}
                            {w.sweep_status === 'NEED_GAS' && (
                              <span className="badge" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                نیازمند سوخت ⛽
                              </span>
                            )}
                            {w.sweep_status === 'EMPTY' && (
                              <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                خالی / پایش ⏳
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: '#cbd5e1', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
                            {formatTehranDateTime(w.invoice_created_at || w.created_at)}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: w.paid_at ? '#34d399' : 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
                            {w.paid_at ? formatTehranDateTime(w.paid_at) : '-'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn-sim-action"
                              style={{
                                borderColor: hasBalance ? 'var(--cyan)' : 'rgba(255,255,255,0.2)',
                                color: '#fff',
                                background: hasBalance ? 'rgba(6, 182, 212, 0.15)' : 'rgba(255,255,255,0.05)',
                                padding: '0.35rem 0.7rem',
                                fontSize: '0.75rem'
                              }}
                              onClick={() => handleOpenSweep(w)}
                            >
                              ⚡ ریبالانس (Sweep)
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* TON Section */}
      {activeNetworkTab === 'ton' && (
        <>

          {/* TON Treasury Status & KPI Banner */}
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🏦</span> وضعیت خزانه‌داری متمرکز TON (PostgreSQL + Toncenter Node)
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-sim-action"
                  onClick={() => loadData(true)}
                  disabled={refreshing || loading}
                  style={{ padding: '0.55rem 0.9rem' }}
                >
                  {refreshing ? 'در حال استعلام...' : '🔄 استعلام زنده از نود Toncenter'}
                </button>
              </div>
            </div>

            {/* KPI Summary Cards for TON */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
                background: 'rgba(15, 23, 42, 0.6)',
                padding: '1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>موجودی زنده والت در نود TON:</span>
                <strong style={{ fontSize: '1.15rem', color: '#38bdf8', direction: 'ltr', display: 'inline-block' }}>
                  {(tonData?.balance_ton || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} TON / گرام
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>کل تراکنش‌ها / مموهای ثبت‌شده:</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--cyan-glow)' }}>
                  {tonData?.total_invoices || 0} تراکنش
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>تسویه‌شده در خزانه:</span>
                <strong style={{ fontSize: '1.15rem', color: '#34d399' }}>
                  {tonData?.paid_invoices || 0} فاکتور ✅
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>کل واریزی تسویه‌شده به خزانه:</span>
                <strong style={{ fontSize: '1.15rem', color: '#fbbf24', direction: 'ltr', display: 'inline-block' }}>
                  {(tonData?.total_collected_ton || 0).toFixed(4)} TON
                </strong>
              </div>
            </div>

            {/* TON Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                در حال دریافت اطلاعات خزانه‌داری TON و استعلام نود... ⏳
              </div>
            ) : !tonData?.items || tonData.items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                هنوز فاکتوری در شبکه TON صادر نشده است. ابتدا در تب "صدور فاکتور" یک فاکتور TON صادر کنید.
              </div>
            ) : (
              <div style={{ width: '100%', overflow: 'hidden', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <table
                  className="custom-table"
                  style={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    fontSize: '0.82rem',
                    textAlign: 'right'
                  }}
                >
                  <thead>
                    <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <th style={{ width: '22%', padding: '0.75rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>شناسه ممو (Memo / Comment)</th>
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>مبلغ (TON / گرام)</th>
                      <th style={{ width: '13%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>مبلغ دلاری</th>
                      <th style={{ width: '16%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>وضعیت واریز</th>
                      <th style={{ width: '17%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>زمان ایجاد فاکتور</th>
                      <th style={{ width: '17%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>زمان پرداخت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tonData.items.map((item, idx) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                          backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.25)' : 'transparent',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '0.65rem 0.5rem', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontWeight: 700, fontSize: '0.78rem' }}>
                              {item.memo || '-'}
                            </span>
                            {item.memo && (
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--cyan)',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  fontSize: '0.72rem'
                                }}
                                onClick={() => {
                                  navigator.clipboard.writeText(item.memo);
                                  onShowToast?.('شناسه ممو کپی شد! ✅', 'success');
                                }}
                                title="کپی ممو"
                              >
                                📋
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', color: '#38bdf8', direction: 'ltr', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.crypto_amount} TON
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          ${item.amount_usd}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.status === 'PAID' ? (
                            <span className="badge" style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontWeight: 700, fontSize: '0.72rem', padding: '0.2rem 0.5rem', border: '1px solid rgba(52, 211, 153, 0.3)' }}>
                              تسویه‌شده در خزانه ✅
                            </span>
                          ) : item.status === 'PENDING' ? (
                            <span className="badge" style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', fontSize: '0.72rem', padding: '0.2rem 0.5rem', border: '1px solid rgba(251, 191, 36, 0.3)' }}>
                              در انتظار واریز ⏳
                            </span>
                          ) : (
                            <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                              {item.status}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: '#cbd5e1', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
                          {formatTehranDateTime(item.created_at)}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: item.paid_at ? '#34d399' : 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
                          {item.paid_at ? formatTehranDateTime(item.paid_at) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* 4. Sweep Action Modal / Panel */}
      {selectedWallet && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            className="card-panel"
            style={{
              maxWidth: '680px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--cyan)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>
                🚀 اجرای چرخه ریبالانسینگ و تخلیه وجوه به خزانه (Sweep Engine)
              </h3>
              <button
                className="btn-sim-action"
                style={{ padding: '0.2rem 0.6rem' }}
                onClick={() => setSelectedWallet(null)}
              >
                ✕ بستن
              </button>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>والت مبدأ (User Deposit): </span>
                <code style={{ color: 'var(--cyan-glow)', direction: 'ltr' }}>{selectedWallet.address}</code>
              </div>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>اندیس اشتقاق: </span>
                <strong style={{ color: '#fbbf24' }}>Index #{selectedWallet.derivation_index}</strong> (Path: {selectedWallet.derivation_path})
              </div>
            </div>

            {/* Sweep Asset Selector */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="selector-label">ارز مورد نظر جهت ریبالانس و انتقال به خزانه:</label>
              <select
                className="input-custom"
                value={sweepAsset}
                onChange={(e) => handleAssetChange(e.target.value)}
                style={{ background: '#0f172a' }}
              >
                <option value="USDT">تتر BEP-20 (USDT)</option>
                <option value="BNB">کوین اصلی BNB (Native)</option>
              </select>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label className="selector-label" style={{ margin: 0 }}>آدرس والت خزانه مقصد (Master Treasury Cold/Hot Wallet):</label>
                <span style={{ fontSize: '0.74rem', color: '#38bdf8' }}>قابل تغییر به هر آدرس دلخواه ✏️</span>
              </div>
              <input
                type="text"
                className="input-custom"
                value={treasuryAddr}
                placeholder="0x..."
                onChange={(e) => {
                  setTreasuryAddr(e.target.value);
                  if (selectedWallet) fetchGasEstimate(selectedWallet, sweepAsset, e.target.value);
                }}
                style={{ direction: 'ltr', fontSize: '0.85rem' }}
              />
              <span style={{ fontSize: '0.74rem', color: 'var(--text-dim)', display: 'block', marginTop: '0.3rem', lineHeight: 1.4 }}>
                💡 هر آدرس معتبر EVM در شبکه بایننس اسمارت چین (مثل والت شخصی متامسک یا والت سرد صرافی) را می‌توانید در اینجا وارد کنید؛ وجوه مستقیماً به همین آدرس واریز می‌شود.
              </span>
            </div>

            {/* Live Balance Summary & Zero-Balance Guard */}
            <div
              style={{
                padding: '0.8rem 1rem',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>موجودی زنده در بلاکچین (Live On-Chain):</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>استعلام مستقیم از نود BSC</span>
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>
                <div style={{ color: selectedWallet.usdt_balance > 0 ? '#38bdf8' : '#94a3b8' }}>
                  تتر: <span>{selectedWallet.usdt_balance.toFixed(4)} USDT</span>
                </div>
                <div style={{ color: selectedWallet.bnb_balance > 0 ? '#34d399' : '#94a3b8' }}>
                  بی‌ان‌بی: <span>{selectedWallet.bnb_balance.toFixed(6)} BNB</span>
                </div>
              </div>
            </div>

            {/* Live Node Gas Estimation & Gas Station Refuel Calculator */}
            <div
              style={{
                padding: '0.8rem 1rem',
                background: 'rgba(30, 41, 59, 0.7)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 'bold' }}>
                  ⛽ تحلیل زنده کارمزد و سوخت‌رسانی از نود BSC (eth_estimateGas):
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {estimatingGas ? 'در حال استعلام نود...' : 'Direct RPC Calculation'}
                </span>
              </div>

              {gasEstimate ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>نرخ لحظه‌ای گس:</span>
                      <strong style={{ color: '#fbbf24' }}>{gasEstimate.gas_price_gwei} Gwei</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>تخمین واحدهای گس:</span>
                      <strong style={{ color: '#34d399' }}>{gasEstimate.gas_units.toLocaleString()} Units</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>کل کارمزد تراکنش:</span>
                      <strong style={{ color: '#38bdf8' }}>{gasEstimate.total_fee_bnb.toFixed(8)} BNB</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>کسری گس والت:</span>
                      <strong style={{ color: gasEstimate.needs_refuel ? '#f43f5e' : '#34d399' }}>
                        {gasEstimate.deficit_bnb > 0 ? `${gasEstimate.deficit_bnb.toFixed(8)} BNB` : 'تامین است'}
                      </strong>
                    </div>
                  </div>

                  {gasEstimate.needs_refuel ? (
                    <div style={{ color: '#fbbf24', fontSize: '0.78rem', marginTop: '0.3rem', lineHeight: 1.5 }}>
                      💡 <strong>الگوی ایستگاه سوخت‌رسانی (Gas Station):</strong> والت مستر صرافی برای اجرای این تراکنش باید دقیقاً مبلغ <strong>{gasEstimate.deficit_bnb.toFixed(8)} BNB</strong> به این والت تزریق کند.
                    </div>
                  ) : (
                    <div style={{ color: '#34d399', fontSize: '0.78rem', marginTop: '0.3rem' }}>
                      ✅ موجودی BNB این والت برای پرداخت کارمزد تراکنش در شبکه BSC کافی است.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>در حال محاسبه کارمزد از نود...</div>
              )}
            </div>

            {((sweepAsset === 'USDT' && selectedWallet.usdt_balance <= 0) || (sweepAsset === 'BNB' && selectedWallet.bnb_balance <= 0)) && (
              <div
                style={{
                  padding: '0.8rem 1rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#fca5a5',
                  fontSize: '0.83rem',
                  marginBottom: '1rem',
                  lineHeight: 1.6
                }}
              >
                ⛔ <strong>موجودی واقعی والت صفر است:</strong> برای ارسال تراکنش واقعی به نود اصلی BSC، ابتدا باید {sweepAsset} واقعی به این آدرس واریز شود.
              </div>
            )}

            {sweepError && (
              <div
                style={{
                  padding: '0.8rem 1rem',
                  background: 'rgba(244, 63, 94, 0.15)',
                  border: '1px solid var(--rose)',
                  borderRadius: '8px',
                  color: '#fda4af',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  lineHeight: 1.5
                }}
              >
                ⚠️ <strong>خطای اعتبارسنجی بلاکچین:</strong> {sweepError}
              </div>
            )}

            <button
              className="btn-submit"
              onClick={handleExecuteSweep}
              disabled={
                sweeping ||
                (sweepAsset === 'USDT' && selectedWallet.usdt_balance <= 0) ||
                (sweepAsset === 'BNB' && selectedWallet.bnb_balance <= 0)
              }
              style={{
                opacity:
                  (sweepAsset === 'USDT' && selectedWallet.usdt_balance <= 0) || (sweepAsset === 'BNB' && selectedWallet.bnb_balance <= 0)
                    ? 0.5
                    : 1,
                cursor:
                  (sweepAsset === 'USDT' && selectedWallet.usdt_balance <= 0) || (sweepAsset === 'BNB' && selectedWallet.bnb_balance <= 0)
                    ? 'not-allowed'
                    : 'pointer'
              }}
            >
              {sweeping
                ? 'در حال اجرای مراحل سوئیپ و امضا در حافظه...'
                : (sweepAsset === 'USDT' && selectedWallet.usdt_balance <= 0) || (sweepAsset === 'BNB' && selectedWallet.bnb_balance <= 0)
                ? '⛔ موجودی صفر است (امکان ارسال تراکنش آنچین نیست)'
                : '🚀 برادکست مستقیم تراکنش ریبالانسینگ به نود BSC'}
            </button>

            {/* Step-by-Step Logs */}
            {sweepResult && (
              <div style={{ marginTop: '1.5rem', background: '#090d16', padding: '1.2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h4 style={{ color: '#34d399', fontSize: '1rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>✅</span> لاگ مرحله‌به‌مرحله فرآیند ریبالانسینگ (Trace Logs):
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {sweepResult.logs.map((log) => (
                    <div
                      key={log.step}
                      style={{
                        padding: '0.8rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--cyan)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <strong style={{ fontSize: '0.86rem', color: '#fff' }}>
                          مرحله {log.step}: {log.title}
                        </strong>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.72rem',
                            background: log.status === 'SUCCESS' ? 'rgba(52, 211, 153, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                            color: log.status === 'SUCCESS' ? '#34d399' : '#38bdf8'
                          }}
                        >
                          {log.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.3rem 0', lineHeight: 1.5 }}>
                        {log.description}
                      </p>
                      {log.details && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'monospace', direction: 'ltr' }}>
                          {log.details}
                        </div>
                      )}
                      {log.tx_hash && (
                        <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', direction: 'ltr' }}>
                          <span style={{ color: '#fbbf24' }}>Tx Hash: </span>
                          <a
                            href={`https://bscscan.com/tx/${log.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--cyan-glow)', textDecoration: 'underline' }}
                          >
                            {log.tx_hash}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '6px', fontSize: '0.82rem', color: 'var(--cyan-glow)' }}>
                  💎 <strong>نتیجه:</strong> کلید خصوصی پس از امضای محلی بلافاصله از رم نابود شد و مبلغ <strong>{sweepResult.amount_swept} {sweepResult.asset_swept}</strong> با موفقیت به سمت خزانه رهسپار و در دیتابیس ثبت گردید.
                </div>

                {/* Direct Navigation to Rebalance Ledger */}
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
                  {onNavigateToRecords && (
                    <button
                      className="btn-sim-action"
                      onClick={() => {
                        setSelectedWallet(null);
                        onNavigateToRecords();
                      }}
                      style={{
                        flex: 1,
                        background: 'rgba(6, 182, 212, 0.2)',
                        color: 'var(--cyan-glow)',
                        borderColor: 'var(--cyan)',
                        padding: '0.65rem 1rem',
                        fontWeight: 700
                      }}
                    >
                      📊 مشاهده این عملیات در جدول سوابق ریبالانسینگ (Ledger) ↗
                    </button>
                  )}
                  <button
                    className="btn-sim-action"
                    onClick={() => setSelectedWallet(null)}
                    style={{ padding: '0.65rem 1.2rem' }}
                  >
                    بستن پنجره
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Batch Sweep Modal / Panel */}
      {showBatchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            className="card-panel"
            style={{
              maxWidth: '720px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              border: '1px solid var(--cyan)',
              boxShadow: '0 8px 32px rgba(6, 182, 212, 0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🚀</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#fff' }}>
                  ریبالانس دسته‌جمعی والت‌ها به خزانه مستر (Batch Sweeping)
                </h3>
              </div>
              <button
                className="btn-sim-action"
                onClick={() => {
                  if (batchProgress.running) {
                    if (!window.confirm('عملیات ریبالانس در حال اجراست. آیا مایل به بستن پنجره هستید؟')) return;
                  }
                  setShowBatchModal(false);
                }}
                style={{ padding: '0.3rem 0.6rem', fontSize: '1rem' }}
              >
                ✕
              </button>
            </div>

            {/* Target Wallets Summary */}
            {(() => {
              const targets = getTargetWalletsForBatch();
              const totalBNB = targets.reduce((sum, w) => sum + (w.bnb_balance || 0), 0);
              const totalUSDT = targets.reduce((sum, w) => sum + (w.usdt_balance || 0), 0);

              return (
                <div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: '0.8rem',
                      marginBottom: '1.2rem',
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block' }}>تعداد والت‌های هدف:</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--cyan-glow)' }}>{targets.length} والت</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block' }}>مجموع موجودی BNB:</span>
                      <strong style={{ fontSize: '1.1rem', color: '#34d399' }}>{totalBNB.toFixed(6)} BNB</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block' }}>مجموع موجودی USDT:</span>
                      <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{totalUSDT.toFixed(2)} USDT</strong>
                    </div>
                  </div>

                  {/* Treasury Address Field */}
                  <div style={{ marginBottom: '1.2rem' }}>
                    <label style={{ fontSize: '0.82rem', color: '#fbbf24', display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
                      🏦 آدرس والت خزانه مقصد (Master Treasury Destination):
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={treasuryAddr}
                      onChange={(e) => setTreasuryAddr(e.target.value)}
                      disabled={batchProgress.running}
                      placeholder="0x..."
                      style={{ direction: 'ltr', fontFamily: 'monospace', fontSize: '0.88rem' }}
                    />
                    <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.2rem', display: 'block' }}>
                      💡 تمام دارایی‌های والت‌های انتخاب‌شده مستقیم به این آدرس واریز می‌شوند (می‌توانید به آدرس متامسک شخصی خود تغییر دهید).
                    </small>
                  </div>

                  {/* Gas Station Notice */}
                  <div
                    style={{
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.3)',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      marginBottom: '1.2rem',
                      fontSize: '0.82rem',
                      color: '#fbbf24',
                      lineHeight: 1.6
                    }}
                  >
                    ⛽ <strong>سوخت‌رسانی خودکار (Gas Station):</strong> اگر والتی حاوی تتر باشد ولی BNB کافی برای کارمزد شبکه نداشته باشد، ولت سوخت‌رسان مستر (اکانت ۱ متامسک) به صورت خودکار به آن BNB تزریق کرده و سپس تتر را ریبالانس می‌کند.
                  </div>

                  {/* Progress Indicator when running */}
                  {batchProgress.running && (
                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: 'var(--cyan-glow)', fontWeight: 600 }}>
                          در حال پردازش: والت {batchProgress.currentStep} از {batchProgress.totalSteps}...
                        </span>
                        <span style={{ color: '#fff', fontFamily: 'monospace' }}>
                          {Math.round((batchProgress.currentStep / batchProgress.totalSteps) * 100)}%
                        </span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${(batchProgress.currentStep / batchProgress.totalSteps) * 100}%`,
                            background: 'linear-gradient(90deg, #06b6d4, #34d399)',
                            transition: 'width 0.4s ease'
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Start / Close Actions */}
                  {!batchProgress.running && !batchProgress.completed && (
                    <div style={{ display: 'flex', gap: '0.8rem' }}>
                      <button
                        className="btn-submit"
                        onClick={handleExecuteBatchSweep}
                        disabled={targets.length === 0}
                        style={{ flex: 1, padding: '0.75rem', fontWeight: 700 }}
                      >
                        🚀 تایید و اجرای ریبالانس دسته‌جمعی ({targets.length} والت)
                      </button>
                      <button
                        className="btn-sim-action"
                        onClick={() => setShowBatchModal(false)}
                        style={{ padding: '0.75rem 1.2rem' }}
                      >
                        انصراف
                      </button>
                    </div>
                  )}

                  {/* Execution Logs Feed */}
                  {batchProgress.logs.length > 0 && (
                    <div style={{ marginTop: '1.2rem', background: '#090d16', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                      <h4 style={{ color: '#fff', fontSize: '0.92rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>📋</span> گزارش گام‌به‌گام تراکنش‌های ریبالانس:
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '240px', overflowY: 'auto' }}>
                        {batchProgress.logs.map((log, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: log.success ? 'rgba(52, 211, 153, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                              border: `1px solid ${log.success ? 'rgba(52, 211, 153, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                              borderRadius: '6px',
                              padding: '0.6rem 0.8rem',
                              fontSize: '0.82rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: log.success ? '#34d399' : '#f43f5e' }}>
                                {log.success ? '✅' : '❌'} والت #{log.index} ({log.address.slice(0, 8)}...{log.address.slice(-6)})
                              </span>
                              {log.amount > 0 && (
                                <span style={{ color: '#fbbf24', fontWeight: 700, direction: 'ltr' }}>
                                  {log.amount} {log.asset}
                                </span>
                              )}
                            </div>
                            {log.txHash && (
                              <div style={{ marginTop: '0.3rem', fontSize: '0.75rem', direction: 'ltr' }}>
                                <span style={{ color: 'var(--text-dim)' }}>Sweep Tx: </span>
                                <a
                                  href={`https://bscscan.com/tx/${log.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--cyan-glow)', textDecoration: 'underline' }}
                                >
                                  {log.txHash.slice(0, 20)}...{log.txHash.slice(-8)}
                                </a>
                              </div>
                            )}
                            {log.refuelTx && (
                              <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', direction: 'ltr' }}>
                                <span style={{ color: '#fbbf24' }}>⛽ Refuel Tx: </span>
                                <a
                                  href={`https://bscscan.com/tx/${log.refuelTx}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: '#fbbf24', textDecoration: 'underline' }}
                                >
                                  {log.refuelTx.slice(0, 20)}...{log.refuelTx.slice(-8)}
                                </a>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Completion Banner */}
                  {batchProgress.completed && (
                    <div style={{ marginTop: '1.2rem' }}>
                      <div
                        style={{
                          background: 'rgba(52, 211, 153, 0.15)',
                          border: '1px solid #34d399',
                          borderRadius: '8px',
                          padding: '0.9rem',
                          textAlign: 'center',
                          color: '#34d399',
                          fontWeight: 700,
                          fontSize: '0.92rem',
                          marginBottom: '0.8rem'
                        }}
                      >
                        🎉 تمام والت‌های انتخابی با موفقیت ریبالانس و به خزانه منتقل شدند!
                      </div>
                      <button
                        className="btn-submit"
                        onClick={() => setShowBatchModal(false)}
                        style={{ width: '100%', padding: '0.75rem' }}
                      >
                        بستن پنجره گزارش
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

