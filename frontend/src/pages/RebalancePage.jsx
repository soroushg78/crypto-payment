import React, { useState, useEffect } from 'react';
import { rebalanceApi } from '../api/rebalanceApi';
import {
  Coins,
  Layers,
  Users,
  Send,
  ArrowDownToLine,
  RefreshCw,
  Loader2,
  Copy,
  CheckCircle2,
  Fuel,
  Clock,
  Landmark,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Info,
  FileText,
  XCircle
} from 'lucide-react';

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
        'تراکنش ریبالانسینگ واقعی به نود شبکه BSC ارسال و در دیتابیس ثبت گردید',
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

    onShowToast?.('عملیات ریبالانس دسته‌جمعی به پایان رسید', 'success');
    loadData(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Network Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.8rem',
          background: '#0f172a',
          padding: '0.5rem',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          flexWrap: 'wrap'
        }}
      >
        <button
          className={`tab-btn ${activeNetworkTab === 'bsc' ? 'active' : ''}`}
          onClick={() => setActiveNetworkTab('bsc')}
          style={{
            flex: '1 1 240px',
            padding: '0.8rem 1.2rem',
            borderRadius: '8px',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: activeNetworkTab === 'bsc' ? '#1e293b' : 'transparent',
            borderColor: activeNetworkTab === 'bsc' ? 'var(--primary)' : 'transparent',
            color: activeNetworkTab === 'bsc' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Coins size={16} />
          <span>شبکه بایننس اسمارت چین (BSC HD-Wallets)</span>
          <span style={{ fontSize: '0.78rem', background: '#0f172a', padding: '2px 8px', borderRadius: '6px' }}>
            {wallets.length} والت
          </span>
        </button>

        <button
          className={`tab-btn ${activeNetworkTab === 'ton' ? 'active' : ''}`}
          onClick={() => setActiveNetworkTab('ton')}
          style={{
            flex: '1 1 240px',
            padding: '0.8rem 1.2rem',
            borderRadius: '8px',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: activeNetworkTab === 'ton' ? '#1e293b' : 'transparent',
            borderColor: activeNetworkTab === 'ton' ? 'var(--primary)' : 'transparent',
            color: activeNetworkTab === 'ton' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Layers size={16} />
          <span>شبکه گرام (TON Master Treasury & Memo)</span>
          <span style={{ fontSize: '0.78rem', background: '#0f172a', color: '#93c5fd', padding: '2px 8px', borderRadius: '6px' }}>
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
                  <Users size={18} style={{ color: 'var(--primary)' }} />
                  لیست والت‌های مشتریان و مدیریت ریبالانسینگ (BSC)
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  تعداد کل والت‌ها: <strong>{wallets.length}</strong> | آماده انتقال به خزانه: <strong style={{ color: readyWallets.length > 0 ? 'var(--emerald-text)' : 'var(--text-muted)' }}>{readyWallets.length}</strong>
                  {selectedIndexes.length > 0 && (
                    <span style={{ color: '#93c5fd', marginRight: '0.5rem' }}>
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
                      background: 'var(--primary)',
                      color: '#fff',
                      borderColor: 'var(--primary)',
                      padding: '0.55rem 1.1rem',
                      fontWeight: 700
                    }}
                  >
                    <Send size={15} />
                    ریبالانس دسته‌جمعی ({selectedIndexes.length} والت انتخابی)
                  </button>
                )}

                {/* Batch Rebalance All Ready */}
                {readyWallets.length > 0 && selectedIndexes.length === 0 && (
                  <button
                    className="btn-sim-action btn-sim-success"
                    onClick={handleOpenBatchModal}
                    style={{
                      padding: '0.55rem 1.1rem',
                      fontWeight: 700
                    }}
                  >
                    <ArrowDownToLine size={15} />
                    ریبالانس یکجای همه والت‌های دارای موجودی ({readyWallets.length})
                  </button>
                )}

                <button
                  className="btn-sim-action"
                  onClick={() => loadData(true)}
                  disabled={refreshing || loading}
                  style={{ padding: '0.55rem 0.9rem' }}
                >
                  {refreshing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      در حال استعلام...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} />
                      استعلام لحظه‌ای
                    </>
                  )}
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>در حال دریافت اطلاعات والت‌ها و استعلام نود BSC...</span>
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
                            <span title={w.address} style={{ color: '#93c5fd', fontSize: '0.78rem' }}>
                              {w.address.slice(0, 8)}...{w.address.slice(-6)}
                            </span>
                            <button
                              className="copy-icon-btn"
                              style={{ marginRight: '0.3rem', padding: '1px 3px' }}
                              onClick={() => {
                                navigator.clipboard.writeText(w.address);
                                onShowToast?.('آدرس ولت کپی شد', 'success');
                              }}
                              title="کپی آدرس"
                            >
                              <Copy size={11} />
                            </button>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: w.bnb_balance > 0 ? 'var(--amber-text)' : 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                              {w.bnb_balance.toFixed(4)} BNB
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ color: w.usdt_balance > 0 ? 'var(--emerald-text)' : 'var(--text-muted)', fontWeight: 700, fontSize: '0.78rem', fontFamily: 'monospace' }}>
                              {w.usdt_balance.toFixed(2)} USDT
                            </span>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            {w.sweep_status === 'READY_USDT' && (
                              <span className="badge" style={{ background: 'rgba(37, 99, 235, 0.15)', color: '#93c5fd', border: '1px solid rgba(37, 99, 235, 0.3)', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                <CheckCircle2 size={11} />
                                آماده انتقال تتر
                              </span>
                            )}
                            {w.sweep_status === 'READY_BNB' && (
                              <span className="badge" style={{ background: 'var(--emerald-subtle)', color: 'var(--emerald-text)', border: '1px solid rgba(5, 150, 105, 0.3)', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                <CheckCircle2 size={11} />
                                آماده انتقال BNB
                              </span>
                            )}
                            {w.sweep_status === 'NEED_GAS' && (
                              <span className="badge" style={{ background: 'var(--amber-subtle)', color: 'var(--amber-text)', border: '1px solid rgba(217, 119, 6, 0.3)', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                <Fuel size={11} />
                                نیازمند سوخت
                              </span>
                            )}
                            {w.sweep_status === 'EMPTY' && (
                              <span className="badge" style={{ background: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)', fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}>
                                <Clock size={11} />
                                خالی / پایش
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: '#cbd5e1', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
                            {formatTehranDateTime(w.invoice_created_at || w.created_at)}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: w.paid_at ? 'var(--emerald-text)' : 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
                            {w.paid_at ? formatTehranDateTime(w.paid_at) : '-'}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn-sim-action"
                              style={{
                                borderColor: hasBalance ? 'var(--primary)' : 'var(--border-color)',
                                color: '#fff',
                                background: hasBalance ? 'rgba(37, 99, 235, 0.2)' : 'transparent',
                                padding: '0.35rem 0.7rem',
                                fontSize: '0.75rem'
                              }}
                              onClick={() => handleOpenSweep(w)}
                            >
                              <ArrowDownToLine size={12} />
                              ریبالانس (Sweep)
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
                  <Landmark size={20} color="var(--primary)" /> وضعیت خزانه‌داری متمرکز TON (PostgreSQL + Toncenter Node)
                </h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-sim-action"
                  onClick={() => loadData(true)}
                  disabled={refreshing || loading}
                  style={{ padding: '0.55rem 0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {refreshing ? (
                    <>
                      <Loader2 size={15} className="spin" />
                      در حال استعلام...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={15} />
                      استعلام زنده از نود Toncenter
                    </>
                  )}
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
                  {(tonData?.balance_ton || 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} GRAM
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>کل تراکنش‌ها / مموهای ثبت‌شده:</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>
                  {tonData?.total_invoices || 0} تراکنش
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>تسویه‌شده در خزانه:</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--emerald)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  {tonData?.paid_invoices || 0} فاکتور
                  <CheckCircle2 size={16} />
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.2rem' }}>کل واریزی تسویه‌شده به خزانه:</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--amber)', direction: 'ltr', display: 'inline-block' }}>
                  {(tonData?.total_collected_ton || 0).toFixed(4)} GRAM
                </strong>
              </div>
            </div>

            {/* TON Table */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                <Loader2 size={18} className="spin" />
                در حال دریافت اطلاعات خزانه‌داری TON و استعلام نود...
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
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>مبلغ (GRAM)</th>
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
                            <span style={{ fontFamily: 'monospace', color: 'var(--amber)', fontWeight: 700, fontSize: '0.78rem' }}>
                              {item.memo || '-'}
                            </span>
                            {item.memo && (
                              <button
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-muted)',
                                  cursor: 'pointer',
                                  padding: '1px',
                                  display: 'inline-flex',
                                  alignItems: 'center'
                                }}
                                onClick={() => {
                                  navigator.clipboard.writeText(item.memo);
                                  onShowToast?.('شناسه ممو کپی شد!', 'success');
                                }}
                                title="کپی ممو"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', color: '#38bdf8', direction: 'ltr', fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.crypto_amount} {item.currency || 'GRAM'}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', direction: 'ltr', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>
                          ${item.amount_usd}
                        </td>
                        <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {item.status === 'PAID' ? (
                            <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.15)', color: 'var(--emerald)', fontWeight: 700, fontSize: '0.72rem', padding: '0.2rem 0.5rem', border: '1px solid rgba(5, 150, 105, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={12} />
                              تسویه‌شده در خزانه
                            </span>
                          ) : item.status === 'PENDING' ? (
                            <span className="badge" style={{ background: 'rgba(217, 119, 6, 0.15)', color: 'var(--amber)', fontSize: '0.72rem', padding: '0.2rem 0.5rem', border: '1px solid rgba(217, 119, 6, 0.3)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Clock size={12} />
                              در انتظار واریز
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
                        <td style={{ padding: '0.65rem 0.5rem', fontSize: '0.78rem', color: item.paid_at ? 'var(--emerald)' : 'var(--text-dim)', textAlign: 'center', whiteSpace: 'nowrap', direction: 'ltr' }}>
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
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowDownToLine size={20} color="var(--primary)" />
                اجرای چرخه ریبالانسینگ و تخلیه وجوه به خزانه (Sweep Engine)
              </h3>
              <button
                className="btn-sim-action"
                style={{ padding: '0.2rem 0.6rem' }}
                onClick={() => setSelectedWallet(null)}
              >
                ✕ بستن
              </button>
            </div>

            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.8rem 1rem', borderRadius: '8px', marginBottom: '1.2rem' }}>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>اندیس اشتقاق: </span>
                <strong style={{ color: 'var(--amber)' }}>Index #{selectedWallet.derivation_index}</strong> (Path: {selectedWallet.derivation_path})
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
              <label className="selector-label" style={{ marginBottom: '0.4rem', display: 'block' }}>آدرس والت خزانه مقصد (Master Treasury Cold/Hot Wallet):</label>
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
                border: '1px solid rgba(37, 99, 235, 0.25)',
                borderRadius: '8px',
                marginBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.82rem', color: '#60a5fa', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Fuel size={15} />
                  تحلیل زنده کارمزد و سوخت‌رسانی از نود BSC (eth_estimateGas):
                </span>
                {estimatingGas && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    در حال استعلام نود...
                  </span>
                )}
              </div>

              {gasEstimate ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.82rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>نرخ لحظه‌ای گس:</span>
                      <strong style={{ color: 'var(--amber)' }}>{gasEstimate.gas_price_gwei} Gwei</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>تخمین واحدهای گس:</span>
                      <strong style={{ color: 'var(--emerald)' }}>{gasEstimate.gas_units.toLocaleString()} Units</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>کل کارمزد تراکنش:</span>
                      <strong style={{ color: '#38bdf8' }}>{gasEstimate.total_fee_bnb.toFixed(8)} BNB</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.74rem' }}>کسری گس والت:</span>
                      <strong style={{ color: gasEstimate.needs_refuel ? 'var(--rose)' : 'var(--emerald)' }}>
                        {gasEstimate.deficit_bnb > 0 ? `${gasEstimate.deficit_bnb.toFixed(8)} BNB` : 'تامین است'}
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>در حال محاسبه کارمزد از نود...</div>
              )}
            </div>

            {((sweepAsset === 'USDT' && selectedWallet.usdt_balance <= 0) || (sweepAsset === 'BNB' && selectedWallet.bnb_balance <= 0)) && (
              <div
                style={{
                  padding: '0.8rem 1rem',
                  background: 'rgba(225, 29, 72, 0.1)',
                  border: '1px solid rgba(225, 29, 72, 0.3)',
                  borderRadius: '8px',
                  color: '#fda4af',
                  fontSize: '0.83rem',
                  marginBottom: '1rem',
                  lineHeight: 1.6,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}
              >
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>موجودی واقعی والت صفر است:</strong> برای ارسال تراکنش واقعی به نود اصلی BSC، ابتدا باید {sweepAsset} واقعی به این آدرس واریز شود.
                </div>
              </div>
            )}

            {sweepError && (
              <div
                style={{
                  padding: '0.8rem 1rem',
                  background: 'rgba(225, 29, 72, 0.15)',
                  border: '1px solid var(--rose)',
                  borderRadius: '8px',
                  color: '#fda4af',
                  fontSize: '0.85rem',
                  marginBottom: '1rem',
                  lineHeight: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem'
                }}
              >
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>خطای اعتبارسنجی بلاکچین:</strong> {sweepError}
                </div>
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
                ? 'موجودی صفر است (امکان ارسال تراکنش آنچین نیست)'
                : 'برادکست مستقیم تراکنش ریبالانسینگ به نود BSC'}
            </button>

            {/* Step-by-Step Logs */}
            {sweepResult && (
              <div style={{ marginTop: '1.5rem', background: '#090d16', padding: '1.2rem', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <h4 style={{ color: 'var(--emerald)', fontSize: '1rem', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={18} /> لاگ مرحله‌به‌مرحله فرآیند ریبالانسینگ (Trace Logs):
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                  {sweepResult.logs.map((log) => (
                    <div
                      key={log.step}
                      style={{
                        padding: '0.8rem',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '6px',
                        borderLeft: '3px solid var(--primary)'
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
                            background: log.status === 'SUCCESS' ? 'rgba(5, 150, 105, 0.2)' : 'rgba(37, 99, 235, 0.2)',
                            color: log.status === 'SUCCESS' ? 'var(--emerald)' : '#60a5fa'
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
                          <span style={{ color: 'var(--amber)' }}>Tx Hash: </span>
                          <a
                            href={`https://bscscan.com/tx/${log.tx_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#60a5fa', textDecoration: 'underline' }}
                          >
                            {log.tx_hash}
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '1rem', padding: '0.8rem', background: 'rgba(37, 99, 235, 0.1)', borderRadius: '6px', fontSize: '0.82rem', color: '#93c5fd' }}>
                  <strong>نتیجه:</strong> کلید خصوصی پس از امضای محلی بلافاصله از رم نابود شد و مبلغ <strong>{sweepResult.amount_swept} {sweepResult.asset_swept}</strong> با موفقیت به سمت خزانه رهسپار و در دیتابیس ثبت گردید.
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
                        background: 'rgba(37, 99, 235, 0.15)',
                        color: '#93c5fd',
                        borderColor: 'var(--primary)',
                        padding: '0.65rem 1rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <BarChart3 size={15} />
                      مشاهده این عملیات در جدول سوابق ریبالانسینگ (Ledger)
                      <ExternalLink size={13} />
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
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-card)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ArrowDownToLine size={22} color="var(--primary)" />
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
                      <strong style={{ fontSize: '1.1rem', color: '#60a5fa' }}>{targets.length} والت</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block' }}>مجموع موجودی BNB:</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--emerald)' }}>{totalBNB.toFixed(6)} BNB</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', display: 'block' }}>مجموع موجودی USDT:</span>
                      <strong style={{ fontSize: '1.1rem', color: '#38bdf8' }}>{totalUSDT.toFixed(2)} USDT</strong>
                    </div>
                  </div>

                  {/* Treasury Address Field */}
                  <div style={{ marginBottom: '1.2rem' }}>
                    <label style={{ fontSize: '0.82rem', color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', fontWeight: 600 }}>
                      <Landmark size={15} />
                      آدرس والت خزانه مقصد (Master Treasury Destination):
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
                    <small style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Info size={13} />
                      تمام دارایی‌های والت‌های انتخاب‌شده مستقیم به این آدرس واریز می‌شوند (می‌توانید به آدرس متامسک شخصی خود تغییر دهید).
                    </small>
                  </div>

                  {/* Gas Station Notice */}
                  <div
                    style={{
                      background: 'rgba(217, 119, 6, 0.1)',
                      border: '1px solid rgba(217, 119, 6, 0.3)',
                      borderRadius: '8px',
                      padding: '0.8rem',
                      marginBottom: '1.2rem',
                      fontSize: '0.82rem',
                      color: 'var(--amber)',
                      lineHeight: 1.6,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem'
                    }}
                  >
                    <Fuel size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>سوخت‌رسانی خودکار (Gas Station):</strong> اگر والتی حاوی تتر باشد ولی BNB کافی برای کارمزد شبکه نداشته باشد، ولت سوخت‌رسان مستر (اکانت ۱ متامسک) به صورت خودکار به آن BNB تزریق کرده و سپس تتر را ریبالانس می‌کند.
                    </div>
                  </div>

                  {/* Progress Indicator when running */}
                  {batchProgress.running && (
                    <div style={{ marginBottom: '1.2rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                        <span style={{ color: '#60a5fa', fontWeight: 600 }}>
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
                            background: 'var(--primary)',
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
                        style={{ flex: 1, padding: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                      >
                        <ArrowDownToLine size={16} />
                        تایید و اجرای ریبالانس دسته‌جمعی ({targets.length} والت)
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
                        <FileText size={16} color="var(--primary)" /> گزارش گام‌به‌گام تراکنش‌های ریبالانس:
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '240px', overflowY: 'auto' }}>
                        {batchProgress.logs.map((log, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: log.success ? 'rgba(5, 150, 105, 0.08)' : 'rgba(225, 29, 72, 0.08)',
                              border: `1px solid ${log.success ? 'rgba(5, 150, 105, 0.3)' : 'rgba(225, 29, 72, 0.3)'}`,
                              borderRadius: '6px',
                              padding: '0.6rem 0.8rem',
                              fontSize: '0.82rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: log.success ? 'var(--emerald)' : 'var(--rose)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                {log.success ? <CheckCircle2 size={14} color="#059669" /> : <XCircle size={14} color="#e11d48" />}
                                والت #{log.index} ({log.address.slice(0, 8)}...{log.address.slice(-6)})
                              </span>
                              {log.amount > 0 && (
                                <span style={{ color: 'var(--amber)', fontWeight: 700, direction: 'ltr' }}>
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
                                  style={{ color: '#60a5fa', textDecoration: 'underline' }}
                                >
                                  {log.txHash.slice(0, 20)}...{log.txHash.slice(-8)}
                                </a>
                              </div>
                            )}
                            {log.refuelTx && (
                              <div style={{ marginTop: '0.2rem', fontSize: '0.75rem', direction: 'ltr' }}>
                                <span style={{ color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <Fuel size={12} /> Refuel Tx:
                                </span>
                                <a
                                  href={`https://bscscan.com/tx/${log.refuelTx}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ color: 'var(--amber)', textDecoration: 'underline' }}
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
                          background: 'rgba(5, 150, 105, 0.15)',
                          border: '1px solid var(--emerald)',
                          borderRadius: '8px',
                          padding: '0.9rem',
                          textAlign: 'center',
                          color: 'var(--emerald)',
                          fontWeight: 700,
                          fontSize: '0.92rem',
                          marginBottom: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        <CheckCircle2 size={20} />
                        تمام والت‌های انتخابی با موفقیت ریبالانس و به خزانه منتقل شدند!
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

