import React from 'react';

export default function PlanSelector({ services, selectedService, onSelect, loading }) {
  if (loading) {
    return (
      <div style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        در حال بارگذاری کاتالوگ خدمات از سرور...
      </div>
    );
  }

  if (!services || services.length === 0) {
    return (
      <div style={{ padding: '1rem', color: 'var(--rose)', textAlign: 'center' }}>
        هیچ خدمتی در دیتابیس یافت نشد.
      </div>
    );
  }

  return (
    <div className="options-list">
      {services.map((srv) => (
        <div
          key={srv.id}
          className={`plan-item ${selectedService?.id === srv.id ? 'selected' : ''}`}
          onClick={() => onSelect(srv)}
        >
          <div className="plan-info">
            <h4>{srv.title}</h4>
            <p>{srv.description || srv.code}</p>
          </div>
          <div className="plan-price">${parseFloat(srv.price_usd).toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
