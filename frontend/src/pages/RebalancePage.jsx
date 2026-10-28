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
  XCircle,
  ShieldCheck,
  Split
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
  const [activeNetworkTab, setActiveNetworkTab] = useState('bsc'); // 'bsc', 'eth', or 'ton'

  // Multi-Vault Many-to-Many Destination Splits (Default: 70% Cold, 20% Hot, 10% Gas Buffer)
  const [vaultSplits, setVaultSplits] = useState([
    { address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', percentage: 70, label: 'خزانه سرد (Cold Storage Vault)' },
    { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', percentage: 20, label: 'خزانه گرم (Hot Withdrawal Pool)' },
    { address: '0xafF24acd08c51cDaACeD358533A01f37634580c5', percentage: 10, label: 'مخزن گس و عملیات (Gas Tank Buffer)' }
  ]);

  // Individual Sweep Modal State
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [sweepAsset, setSweepAsset] = useState('USDT');
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [sweepError, setSweepError] = useState('');
  const [gasEstimate, setGasEstimate] = useState(null);
  const [estimatingGas, setEstimatingGas] = useState(false);
  const [operatorMnemonic, setOperatorMnemonic] = useState('');

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

  const nativeCoin = activeNetworkTab === 'eth' ? 'ETH' : 'BNB';
  const explorerBase = activeNetworkTab === 'eth' ? 'https://etherscan.io/tx/' : 'https://bscscan.com/tx/';

  const fetchGasEstimate = async (wallet, asset, network = activeNetworkTab) => {
    if (!wallet) return;
    try {
      setEstimatingGas(true);
      const est = await rebalanceApi.estimateGas({
        derivationIndex: wallet.derivation_index,
        asset: asset,
        treasuryAddress: vaultSplits[0]?.address,
        network: network
      });
      setGasEstimate(est);
    } catch (err) {
      console.warn('Failed to estimate gas from node:', err);
    } finally {
      setEstimatingGas(false);
    }
  };

  const loadData = async (isManual = false, targetNetwork = activeNetworkTab) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);

      const [walletsData, specsData, tonTreasuryData] = await Promise.all([
        targetNetwork === 'ton' ? Promise.resolve([]) : rebalanceApi.getWallets(targetNetwork),
        rebalanceApi.getSecuritySpecs(),
        rebalanceApi.getTONTreasury().catch((err) => {
          console.warn('Failed to load TON treasury:', err);
          return null;
        })
      ]);

      setWallets(walletsData || []);
      setSecuritySpecs(specsData);
      if (tonTreasuryData) setTonData(tonTreasuryData);
      if (isManual) onShowToast?.(`اطلاعات والت‌ها و نود ${targetNetwork.toUpperCase()} به‌روزرسانی شد.`, 'success');
    } catch (err) {
      onShowToast?.(`خطا در دریافت اطلاعات: ${err.message}`, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false, activeNetworkTab);
    setSelectedIndexes([]);
  }, [activeNetworkTab]);

  const handleOpenSweep = (wallet) => {
    setSelectedWallet(wallet);
    const initialAsset = wallet.usdt_balance > 0 ? 'USDT' : nativeCoin;
    setSweepAsset(initialAsset);
    setSweepResult(null);
    setSweepError('');
    setGasEstimate(null);
    fetchGasEstimate(wallet, initialAsset, activeNetworkTab);
  };

  const handleAssetChange = (newAsset) => {
    setSweepAsset(newAsset);
    if (selectedWallet) {
      fetchGasEstimate(selectedWallet, newAsset, activeNetworkTab);
    }
  };

  const handleExecuteSweep = async () => {
    if (!selectedWallet) return;
    try {
      setSweeping(true);
      setSweepResult(null);
      setSweepError('');

      const res = await rebalanceApi.sweepWallet({
        network: activeNetworkTab,
        derivationIndex: selectedWallet.derivation_index,
        asset: sweepAsset,
        vaultSplits: vaultSplits,
        realBroadcast: true,
        mnemonic: operatorMnemonic || undefined
      });

      setSweepResult(res);
      onShowToast?.(
        `تراکنش تسهیم Many-to-Many به نود ${activeNetworkTab.toUpperCase()} ارسال و در دیتابیس ثبت گردید`,
        'success'
      );
      loadData(false, activeNetworkTab);
    } catch (err) {
      setSweepError(err.message || 'خطا در اجرای سوئیپ');
      onShowToast?.(`خطا: ${err.message}`, 'error');
    } finally {
      setSweeping(false);
    }
  };

  const readyWallets = wallets.filter((w) => (w.native_balance || w.bnb_balance) > 0.0005 || w.usdt_balance > 0);
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
      const asset = w.usdt_balance > 0 ? 'USDT' : nativeCoin;

      setBatchProgress((prev) => ({
        ...prev,
        currentStep: i + 1,
        currentWallet: w
      }));

      try {
        const res = await rebalanceApi.sweepWallet({
          network: activeNetworkTab,
          derivationIndex: w.derivation_index,
          asset: asset,
          vaultSplits: vaultSplits,
          realBroadcast: true,
          mnemonic: operatorMnemonic || undefined
        });

        newLogs.push({
          success: true,
          index: w.derivation_index,
          address: w.address,
          asset: res.asset_swept || asset,
          amount: res.amount_swept,
          txHash: res.sweep_tx_hash,
          refuelTx: res.refuel_tx_hash,
          splits: res.splits,
          message: `والت #${w.derivation_index} با موفقیت به ۳ خزانه تسهیم شد`
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

    loadData(false, activeNetworkTab);
    onShowToast?.('عملیات تسهیم دسته‌جمعی Many-to-Many به پایان رسید', 'success');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Network Switcher Tabs (BSC, Ethereum, TON) */}
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
            flex: '1 1 200px',
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
          <span>بایننس اسمارت چین (BSC)</span>
          {activeNetworkTab === 'bsc' && (
            <span style={{ fontSize: '0.78rem', background: '#0f172a', padding: '2px 8px', borderRadius: '6px' }}>
              {wallets.length} والت
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeNetworkTab === 'eth' ? 'active' : ''}`}
          onClick={() => setActiveNetworkTab('eth')}
          style={{
            flex: '1 1 200px',
            padding: '0.8rem 1.2rem',
            borderRadius: '8px',
            fontSize: '0.92rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: activeNetworkTab === 'eth' ? '#1e293b' : 'transparent',
            borderColor: activeNetworkTab === 'eth' ? 'var(--primary)' : 'transparent',
            color: activeNetworkTab === 'eth' ? '#fff' : 'var(--text-muted)'
          }}
        >
          <Split size={16} color="#60a5fa" />
          <span>شبکه اتریوم (Ethereum - EVM)</span>
          {activeNetworkTab === 'eth' && (
            <span style={{ fontSize: '0.78rem', background: '#0f172a', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px' }}>
              {wallets.length} والت
            </span>
          )}
        </button>

        <button
          className={`tab-btn ${activeNetworkTab === 'ton' ? 'active' : ''}`}
          onClick={() => setActiveNetworkTab('ton')}
          style={{
            flex: '1 1 200px',
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
          <span>شبکه تون (TON - GRAM)</span>
          <span style={{ fontSize: '0.78rem', background: '#0f172a', color: '#93c5fd', padding: '2px 8px', borderRadius: '6px' }}>
            {tonData?.items?.length || 0} تراکنش
          </span>
        </button>
      </div>

      {/* EVM Section (BSC and ETH) */}
      {(activeNetworkTab === 'bsc' || activeNetworkTab === 'eth') && (
        <>
          {/* Live Wallets Table & Sweep Trigger */}
          <div className="card-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={18} style={{ color: 'var(--primary)' }} />
                  لیست والت‌های مشتریان و مدیریت ریبالانسینگ ({activeNetworkTab.toUpperCase()})
                </h3>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                  تعداد کل والت‌ها: <strong>{wallets.length}</strong> | آماده تسهیم Many-to-Many: <strong style={{ color: readyWallets.length > 0 ? 'var(--emerald-text)' : 'var(--text-muted)' }}>{readyWallets.length}</strong>
                  {selectedIndexes.length > 0 && (
                    <span style={{ color: '#93c5fd', marginRight: '0.5rem' }}>
                      | تیک‌خورده: <strong>{selectedIndexes.length} والت</strong>
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
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
                    تسهیم دسته‌جمعی ({selectedIndexes.length} والت انتخابی)
                  </button>
                )}

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
                    تسهیم یکجای همه والت‌های دارای موجودی ({readyWallets.length})
                  </button>
                )}

                <button
                  className="btn-sim-action"
                  onClick={() => loadData(true, activeNetworkTab)}
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
                      استعلام لحظه‌ای نود
                    </>
                  )}
                </button>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>در حال دریافت اطلاعات والت‌ها و استعلام نود {activeNetworkTab.toUpperCase()}...</span>
              </div>
            ) : wallets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                هنوز فاکتوری در شبکه {activeNetworkTab.toUpperCase()} صادر نشده است. ابتدا در تب "صدور فاکتور" یک فاکتور بسازید تا والت در اینجا نمایان شود.
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
                          title="انتخاب همه والت‌ها"
                        />
                      </th>
                      <th style={{ width: '80px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>ایندکس</th>
                      <th style={{ width: '30%', padding: '0.75rem 0.5rem' }}>آدرس واریز مشتری</th>
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center' }}>موجودی {nativeCoin}</th>
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center' }}>موجودی USDT</th>
                      <th style={{ width: '15%', padding: '0.75rem 0.5rem', textAlign: 'center' }}>وضعیت سوئیپ</th>
                      <th style={{ width: '120px', padding: '0.75rem 0.5rem', textAlign: 'center' }}>عملیات تسهیم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w, idx) => {
                      const nativeB = w.native_balance !== undefined ? w.native_balance : w.bnb_balance;
                      const isSelected = selectedIndexes.includes(w.derivation_index);
                      return (
                        <tr
                          key={w.id || w.derivation_index}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.15)' : idx % 2 === 0 ? 'rgba(15, 23, 42, 0.25)' : 'transparent'
                          }}
                        >
                          <td style={{ padding: '0.65rem 0.4rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectWallet(w.derivation_index)}
                            />
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontFamily: 'monospace', color: '#93c5fd' }}>
                            #{w.derivation_index}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', direction: 'ltr', textAlign: 'left' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ color: '#fff', fontSize: '0.78rem' }}>{w.address}</span>
                              <button
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '1px' }}
                                onClick={() => {
                                  navigator.clipboard.writeText(w.address);
                                  onShowToast?.('آدرس کپی شد', 'success');
                                }}
                                title="کپی آدرس"
                              >
                                <Copy size={13} />
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontFamily: 'monospace', color: nativeB > 0 ? 'var(--emerald)' : 'var(--text-muted)', direction: 'ltr' }}>
                            {nativeB.toFixed(6)} {nativeCoin}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontFamily: 'monospace', color: w.usdt_balance > 0 ? '#38bdf8' : 'var(--text-muted)', direction: 'ltr', fontWeight: w.usdt_balance > 0 ? 700 : 400 }}>
                            {w.usdt_balance.toFixed(2)} USDT
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            {w.sweep_status === 'READY_USDT' ? (
                              <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.2)', color: 'var(--emerald)' }}>آماده تسهیم USDT</span>
                            ) : w.sweep_status === 'READY_NATIVE' ? (
                              <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.2)', color: 'var(--emerald)' }}>آماده تسهیم {nativeCoin}</span>
                            ) : w.sweep_status === 'NEED_GAS' ? (
                              <span className="badge" style={{ background: 'rgba(217, 119, 6, 0.2)', color: 'var(--amber)' }}>نیاز به سوخت</span>
                            ) : (
                              <span className="badge" style={{ background: 'rgba(148, 163, 184, 0.1)', color: 'var(--text-muted)' }}>خالی</span>
                            )}
                          </td>
                          <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                            <button
                              className="btn-sim-action"
                              onClick={() => handleOpenSweep(w)}
                              style={{
                                padding: '0.35rem 0.75rem',
                                fontSize: '0.75rem',
                                background: (nativeB > 0.0005 || w.usdt_balance > 0) ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                                color: (nativeB > 0.0005 || w.usdt_balance > 0) ? '#fff' : 'var(--text-dim)',
                                borderColor: 'transparent'
                              }}
                            >
                              <Split size={12} />
                              تسهیم ۷۰/۲۰/۱۰
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

      {/* TON Master Treasury Section */}
      {activeNetworkTab === 'ton' && (
        <div className="card-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap', gap: '0.8rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} style={{ color: 'var(--primary)' }} />
                خزانه‌داری متمرکز شبکه گرام (TON Master Treasury & Memo Routing)
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', display: 'block' }}>
                آدرس خزانه رسمی: <strong style={{ fontFamily: 'monospace', color: 'var(--amber)' }}>{tonData?.treasury_address || 'در حال دریافت...'}</strong>
              </span>
            </div>

            <button
              className="btn-sim-action"
              onClick={() => loadData(true, 'ton')}
              disabled={refreshing || loading}
              style={{ padding: '0.55rem 0.9rem' }}
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              استعلام زنده نود TON
            </button>
          </div>

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

          {/* TON Invoices Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              در حال دریافت تراکنش‌های خزانه‌داری TON...
            </div>
          ) : !tonData?.items || tonData.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              هنوز فاکتوری در شبکه TON صادر نشده است.
            </div>
          ) : (
            <div style={{ width: '100%', overflow: 'hidden', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>شناسه ممو (Memo)</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>مبلغ (GRAM)</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>مبلغ دلاری</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>وضعیت واریز</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>زمان ایجاد</th>
                  </tr>
                </thead>
                <tbody>
                  {tonData.items.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: idx % 2 === 0 ? 'rgba(15, 23, 42, 0.25)' : 'transparent' }}>
                      <td style={{ padding: '0.65rem 0.5rem', fontFamily: 'monospace', color: 'var(--amber)', fontWeight: 700 }}>
                        {item.memo || '-'}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontFamily: 'monospace', color: '#38bdf8' }}>
                        {item.crypto_amount} GRAM
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>
                        ${item.amount_usd}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center' }}>
                        {item.status === 'PAID' ? (
                          <span className="badge" style={{ background: 'rgba(5, 150, 105, 0.15)', color: 'var(--emerald)' }}>تسویه‌شده</span>
                        ) : (
                          <span className="badge" style={{ background: 'rgba(217, 119, 6, 0.15)', color: 'var(--amber)' }}>در انتظار</span>
                        )}
                      </td>
                      <td style={{ padding: '0.65rem 0.5rem', textAlign: 'center', color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                        {formatTehranDateTime(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Single Multi-Vault Sweep Modal */}
      {selectedWallet && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card-panel" style={{ maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Split size={20} color="#60a5fa" />
                تسهیم چندخزانه‌ای Many-to-Many ({activeNetworkTab.toUpperCase()})
              </h3>
              <button onClick={() => setSelectedWallet(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                ✕
              </button>
            </div>

            {/* Wallet Info Banner */}
            <div style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '0.8rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.82rem' }}>
              <div>آدرس مبدأ مشتری: <strong style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{selectedWallet.address}</strong> (ایندکس #{selectedWallet.derivation_index})</div>
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '1rem' }}>
                <span>موجودی {nativeCoin}: <strong>{(selectedWallet.native_balance || selectedWallet.bnb_balance || 0).toFixed(6)}</strong></span>
                <span>موجودی تتر: <strong>{(selectedWallet.usdt_balance || 0).toFixed(2)} USDT</strong></span>
              </div>
            </div>

            {/* Asset Selection */}
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-dim)', marginBottom: '0.4rem' }}>انتخاب دارایی جهت تسهیم:</label>
              <div style={{ display: 'flex', gap: '0.8rem' }}>
                <button
                  type="button"
                  onClick={() => handleAssetChange('USDT')}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    background: sweepAsset === 'USDT' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: '6px',
                    fontWeight: 700
                  }}
                >
                  تتر (USDT)
                </button>
                <button
                  type="button"
                  onClick={() => handleAssetChange(nativeCoin)}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    background: sweepAsset === nativeCoin ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: '#fff',
                    borderRadius: '6px',
                    fontWeight: 700
                  }}
                >
                  کوین بومی ({nativeCoin})
                </button>
              </div>
            </div>

            {/* Multi-Vault Destination Configuration (70%, 20%, 10%) */}
            <div style={{ marginBottom: '1.2rem', background: 'rgba(15, 23, 42, 0.75)', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <label style={{ fontSize: '0.84rem', color: '#93c5fd', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Landmark size={15} />
                  تسهیم چندخزانه‌ای Many-to-Many (۷۰٪ سرد، ۲۰٪ گرم، ۱۰٪ مخزن گس):
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--emerald)' }}>مجموع: ۱۰۰٪</span>
              </div>

              {vaultSplits.map((v, vIdx) => (
                <div key={vIdx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--amber)', width: '140px', flexShrink: 0, fontWeight: 600 }}>
                    {v.label}:
                  </span>
                  <input
                    type="text"
                    value={v.address}
                    onChange={(e) => {
                      const updated = [...vaultSplits];
                      updated[vIdx].address = e.target.value;
                      setVaultSplits(updated);
                    }}
                    placeholder="0x..."
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.6rem',
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '5px',
                      color: '#fff',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace',
                      direction: 'ltr'
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: '75px', flexShrink: 0 }}>
                    <input
                      type="number"
                      value={v.percentage}
                      onChange={(e) => {
                        const updated = [...vaultSplits];
                        updated[vIdx].percentage = parseFloat(e.target.value) || 0;
                        setVaultSplits(updated);
                      }}
                      style={{
                        width: '45px',
                        padding: '0.45rem 0.3rem',
                        background: 'rgba(30, 41, 59, 0.8)',
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                        borderRadius: '5px',
                        color: '#60a5fa',
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        textAlign: 'center'
                      }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>٪</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Operator Mnemonic Input for Zero-Key Security */}
            <div style={{ marginBottom: '1.2rem', textAlign: 'right' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#93c5fd', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                عبارت ۱۲ کلمه‌ای بازیابی (امضای تراکنش‌ها در RAM موقت):
              </label>
              <input
                type="password"
                placeholder="۱۲ کلمه بازیابی را وارد کنید"
                value={operatorMnemonic}
                onChange={(e) => setOperatorMnemonic(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 0.8rem',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.82rem',
                  fontFamily: 'monospace',
                  direction: 'ltr'
                }}
              />
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'block', marginTop: '0.3rem' }}>
                کلید خصوصی صرفاً برای چند میلی‌ثانیه جهت امضای تراکنش‌های ۳ گانه در RAM استفاده شده و بلافاصله امحا می‌شود.
              </span>
            </div>

            {sweepError && (
              <div style={{ padding: '0.7rem', background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8rem' }}>
                {sweepError}
              </div>
            )}

            <button
              className="btn-submit"
              onClick={handleExecuteSweep}
              disabled={sweeping}
              style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
            >
              {sweeping ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  در حال امضا و تسهیم آنچین به ۳ خزانه...
                </>
              ) : (
                <>
                  <Split size={16} />
                  اجرای آنچین تسهیم Many-to-Many (۷۰/۲۰/۱۰)
                </>
              )}
            </button>

            {/* Results */}
            {sweepResult && (
              <div style={{ marginTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                <h4 style={{ color: 'var(--emerald)', fontSize: '0.95rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 size={18} /> لاگ موفقیت‌آمیز تسهیم Many-to-Many:
                </h4>

                {sweepResult.splits && sweepResult.splits.length > 0 && (
                  <div style={{ padding: '0.8rem', background: 'rgba(5, 150, 105, 0.1)', borderRadius: '6px', marginBottom: '0.8rem' }}>
                    <strong style={{ fontSize: '0.82rem', color: 'var(--emerald)', display: 'block', marginBottom: '0.4rem' }}>
                      تفکیک خروجی به خزانه‌ها:
                    </strong>
                    {sweepResult.splits.map((sp, idx) => (
                      <div key={idx} style={{ fontSize: '0.78rem', color: '#e2e8f0', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
                        <span>{sp.label} ({sp.percentage}%):</span>
                        <span style={{ color: '#60a5fa' }}>{sp.amount.toFixed(4)} {sweepResult.asset_swept}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {sweepResult.logs.map((log) => (
                    <div key={log.step} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <strong>مرحله {log.step}: {log.title}</strong>
                        <span style={{ color: 'var(--emerald)' }}>{log.status}</span>
                      </div>
                      <p style={{ margin: '0.2rem 0', color: 'var(--text-muted)' }}>{log.description}</p>
                      {log.tx_hash && (
                        <a href={`${explorerBase}${log.tx_hash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', direction: 'ltr', display: 'inline-block' }}>
                          Tx: {log.tx_hash.slice(0, 22)}...
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Batch Many-to-Many Rebalance Modal */}
      {showBatchModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="card-panel" style={{ maxWidth: '720px', width: '100%', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Split size={20} color="var(--primary)" />
                تسهیم دسته‌جمعی Many-to-Many ({activeNetworkTab.toUpperCase()})
              </h3>
              {!batchProgress.running && (
                <button onClick={() => setShowBatchModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Target Vaults Configuration */}
            <div style={{ marginBottom: '1.2rem', background: 'rgba(15, 23, 42, 0.75)', padding: '0.9rem', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                <label style={{ fontSize: '0.84rem', color: '#93c5fd', fontWeight: 'bold' }}>
                  آدرس‌های ۳ خزانه‌ مقصد جهت تسهیم تمام والت‌های ورودی:
                </label>
                <span style={{ fontSize: '0.75rem', color: 'var(--emerald)' }}>مجموع: ۱۰۰٪</span>
              </div>

              {vaultSplits.map((v, vIdx) => (
                <div key={vIdx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--amber)', width: '140px', flexShrink: 0, fontWeight: 600 }}>
                    {v.label}:
                  </span>
                  <input
                    type="text"
                    value={v.address}
                    disabled={batchProgress.running}
                    onChange={(e) => {
                      const updated = [...vaultSplits];
                      updated[vIdx].address = e.target.value;
                      setVaultSplits(updated);
                    }}
                    placeholder="0x..."
                    style={{ flex: 1, padding: '0.45rem 0.6rem', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '5px', color: '#fff', fontSize: '0.8rem', fontFamily: 'monospace', direction: 'ltr' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', width: '75px', flexShrink: 0 }}>
                    <input
                      type="number"
                      value={v.percentage}
                      disabled={batchProgress.running}
                      onChange={(e) => {
                        const updated = [...vaultSplits];
                        updated[vIdx].percentage = parseFloat(e.target.value) || 0;
                        setVaultSplits(updated);
                      }}
                      style={{ width: '45px', padding: '0.45rem 0.3rem', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '5px', color: '#60a5fa', fontSize: '0.8rem', fontWeight: 'bold', textAlign: 'center' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>٪</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Operator Mnemonic */}
            <div style={{ marginBottom: '1.2rem', textAlign: 'right' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: '#93c5fd', marginBottom: '0.4rem', fontWeight: 'bold' }}>
                عبارت ۱۲ کلمه‌ای بازیابی (جهت امضای دسته‌جمعی در RAM موقت):
              </label>
              <input
                type="password"
                placeholder="۱۲ کلمه بازیابی را وارد کنید"
                value={operatorMnemonic}
                onChange={(e) => setOperatorMnemonic(e.target.value)}
                disabled={batchProgress.running}
                style={{ width: '100%', padding: '0.65rem 0.8rem', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(148, 163, 184, 0.3)', borderRadius: '6px', color: '#f8fafc', fontSize: '0.82rem', fontFamily: 'monospace', direction: 'ltr' }}
              />
            </div>

            {!batchProgress.running && !batchProgress.completed && (
              <button
                className="btn-submit"
                onClick={handleExecuteBatchSweep}
                style={{ width: '100%', padding: '0.75rem', fontWeight: 700 }}
              >
                شروع عملیات تسهیم دسته‌جمعی Many-to-Many
              </button>
            )}

            {/* Progress / Logs */}
            {batchProgress.running && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.4rem', color: '#60a5fa' }}>
                  <span>در حال پردازش: والت {batchProgress.currentStep} از {batchProgress.totalSteps}...</span>
                  <span>{Math.round((batchProgress.currentStep / batchProgress.totalSteps) * 100)}%</span>
                </div>
              </div>
            )}

            {batchProgress.logs.length > 0 && (
              <div style={{ marginTop: '1rem', maxHeight: '200px', overflowY: 'auto' }}>
                {batchProgress.logs.map((log, lIdx) => (
                  <div key={lIdx} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '5px', marginBottom: '0.4rem', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: log.success ? 'var(--emerald)' : '#ef4444' }}>{log.message}</span>
                      {log.txHash && (
                        <a href={`${explorerBase}${log.txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa', direction: 'ltr' }}>
                          Tx
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {batchProgress.completed && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ padding: '0.8rem', background: 'rgba(5, 150, 105, 0.2)', color: 'var(--emerald)', borderRadius: '6px', textAlign: 'center', fontWeight: 700, marginBottom: '0.8rem' }}>
                  تمام والت‌ها با موفقیت بر اساس الگوی Many-to-Many به ۳ خزانه تفکیک شدند!
                </div>
                <button className="btn-submit" onClick={() => setShowBatchModal(false)} style={{ width: '100%', padding: '0.75rem' }}>
                  بستن پنجره گزارش
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
