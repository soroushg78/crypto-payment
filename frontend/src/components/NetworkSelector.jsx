import React from 'react';

export default function NetworkSelector({
  networks = [],
  selectedNetworkId,
  onChangeNetwork,
  currencies = [],
  selectedCurrencyId,
  onChangeCurrency,
  loadingNetworks,
  loadingCurrencies
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. دراپ‌داون انتخاب شبکه */}
      <div className="selector-group">
        <label className="selector-label">
          ۱. انتخاب شبکه بلاکچین (Blockchain Network):
        </label>
        <select
          className="input-custom"
          style={{ cursor: 'pointer', appearance: 'auto', background: '#0f172a' }}
          value={selectedNetworkId || ''}
          onChange={(e) => onChangeNetwork(e.target.value)}
          disabled={loadingNetworks}
        >
          <option value="">
            {loadingNetworks ? 'در حال بارگذاری شبکه‌ها...' : '-- لطفاً یک شبکه را انتخاب کنید --'}
          </option>
          {networks.map((net) => (
            <option key={net.id} value={net.id}>
              {net.name} ({net.native_currency})
            </option>
          ))}
        </select>
      </div>

      {/* 2. دراپ‌داون انتخاب کارنسی (فقط وقتی شبکه انتخاب شده باشد فعال می‌شود) */}
      <div className="selector-group">
        <label className="selector-label">
          ۲. انتخاب ارز پرداختی (Currency):
        </label>
        <select
          className="input-custom"
          style={{
            cursor: !selectedNetworkId ? 'not-allowed' : 'pointer',
            appearance: 'auto',
            background: '#0f172a',
            opacity: !selectedNetworkId ? 0.6 : 1
          }}
          value={selectedCurrencyId || ''}
          onChange={(e) => onChangeCurrency(e.target.value)}
          disabled={!selectedNetworkId || loadingCurrencies}
        >
          {!selectedNetworkId ? (
            <option value="">-- ابتدا شبکه بلاکچین را در بالا انتخاب کنید --</option>
          ) : loadingCurrencies ? (
            <option value="">در حال دریافت ارزهای شبکه...</option>
          ) : currencies.length === 0 ? (
            <option value="">ارزی برای این شبکه یافت نشد</option>
          ) : (
            <>
              <option value="">-- لطفاً ارز پرداختی را انتخاب کنید --</option>
              {currencies.map((curr) => (
                <option key={curr.id} value={curr.id}>
                  {curr.symbol} {curr.contract_address ? '(توکن)' : '(کوین اصلی)'}
                </option>
              ))}
            </>
          )}
        </select>
      </div>
    </div>
  );
}
