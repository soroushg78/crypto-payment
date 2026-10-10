import React from 'react';

export default function NetworkSelector({
  networks,
  selectedNetwork,
  onSelectNetwork,
  currencies,
  selectedCurrency,
  onSelectCurrency,
  loadingCurrencies
}) {
  return (
    <div>
      <div className="selector-group">
        <label className="selector-label">شبکه بلاکچین (Blockchain Network):</label>
        <div className="pill-grid">
          {networks.map((net) => (
            <button
              key={net.id}
              type="button"
              className={`pill-btn ${selectedNetwork?.id === net.id ? 'selected' : ''}`}
              onClick={() => onSelectNetwork(net)}
            >
              {net.name}
            </button>
          ))}
        </div>
      </div>

      <div className="selector-group">
        <label className="selector-label">ارز واریز (Currency):</label>
        {loadingCurrencies ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            در حال بارگذاری ارزهای شبکه...
          </div>
        ) : (
          <div className="pill-grid">
            {currencies.map((curr) => (
              <button
                key={curr.id}
                type="button"
                className={`pill-btn ${selectedCurrency?.id === curr.id ? 'selected' : ''}`}
                onClick={() => onSelectCurrency(curr)}
              >
                {curr.symbol}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
