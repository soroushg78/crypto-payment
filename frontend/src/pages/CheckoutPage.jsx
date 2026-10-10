import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/catalogApi';
import { invoiceApi } from '../api/invoiceApi';
import PlanSelector from '../components/PlanSelector';
import NetworkSelector from '../components/NetworkSelector';
import InvoiceCard from '../components/InvoiceCard';

export default function CheckoutPage({ onInvoiceCreated, onShowToast }) {
  const [services, setServices] = useState([]);
  const [networks, setNetworks] = useState([]);
  const [currencies, setCurrencies] = useState([]);

  const [selectedService, setSelectedService] = useState(null);
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(null);

  const [telegramId, setTelegramId] = useState('84920194');
  const [activeInvoice, setActiveInvoice] = useState(null);

  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // بارگذاری لیست خدمات و شبکه‌ها از بک‌اند Go
  useEffect(() => {
    let isMounted = true;
    const loadCatalog = async () => {
      try {
        setLoadingCatalog(true);
        const [servicesData, networksData] = await Promise.all([
          catalogApi.getServices(),
          catalogApi.getNetworks()
        ]);

        if (!isMounted) return;

        if (Array.isArray(servicesData) && servicesData.length > 0) {
          setServices(servicesData);
          setSelectedService(servicesData[0]);
        }

        if (Array.isArray(networksData) && networksData.length > 0) {
          setNetworks(networksData);
          setSelectedNetwork(networksData[0]);
        }
      } catch (err) {
        if (isMounted) {
          setErrorMsg(err.message || 'خطا در واکشی کاتالوگ از سرور');
        }
      } finally {
        if (isMounted) setLoadingCatalog(false);
      }
    };

    loadCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  // بارگذاری ارزها هنگام تغییر شبکه
  useEffect(() => {
    if (!selectedNetwork?.id) return;

    let isMounted = true;
    const loadCurrencies = async () => {
      try {
        setLoadingCurrencies(true);
        const currData = await catalogApi.getCurrencies(selectedNetwork.id);
        if (!isMounted) return;

        if (Array.isArray(currData) && currData.length > 0) {
          setCurrencies(currData);
          setSelectedCurrency(currData[0]);
        } else {
          setCurrencies([]);
          setSelectedCurrency(null);
        }
      } catch (err) {
        if (isMounted) {
          onShowToast?.(`خطا در واکشی ارزهای شبکه: ${err.message}`, 'error');
        }
      } finally {
        if (isMounted) setLoadingCurrencies(false);
      }
    };

    loadCurrencies();
    return () => {
      isMounted = false;
    };
  }, [selectedNetwork?.id]);

  // ثبت و صدور فاکتور واقعی در دیتابیس
  const handleCreateInvoice = async () => {
    if (!selectedService || !selectedCurrency || !selectedNetwork) {
      onShowToast?.('لطفاً تمامی گزینه‌ها را انتخاب کنید', 'error');
      return;
    }

    try {
      setCreatingInvoice(true);
      setErrorMsg('');

      const invoiceData = await invoiceApi.createInvoice({
        serviceId: selectedService.id,
        currencyId: selectedCurrency.id,
        networkId: selectedNetwork.id,
        telegramId: telegramId ? parseInt(telegramId, 10) : undefined
      });

      // ترکیب داده‌های کامل جهت نمایش در فاکتور
      const fullInvoice = {
        ...invoiceData,
        service_title: selectedService.title,
        currency_symbol: selectedCurrency.symbol,
        network_name: selectedNetwork.name
      };

      setActiveInvoice(fullInvoice);
      onInvoiceCreated?.(fullInvoice);
      onShowToast?.('فاکتور در دیتابیس صادر شد! آماده ارسال به بلاکچین ⚡', 'success');
    } catch (err) {
      setErrorMsg(err.message || 'خطا در ایجاد فاکتور');
      onShowToast?.(`خطا در ایجاد فاکتور: ${err.message}`, 'error');
    } finally {
      setCreatingInvoice(false);
    }
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    onShowToast?.(`${label} کپی شد! ✅`, 'success');
  };

  const handleStatusChange = (newStatus, updatedData) => {
    if (activeInvoice) {
      setActiveInvoice((prev) => ({
        ...prev,
        status: newStatus,
        ...(updatedData || {})
      }));
    }
  };

  return (
    <div className="checkout-grid">
      {/* انتخاب پلن و شبکه */}
      <div className="card-panel">
        <div className="card-title-wrap">
          <div className="card-step-num">۱</div>
          <h2 className="card-title">انتخاب خدمت از دیتابیس واقعی</h2>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(244, 63, 94, 0.15)',
              border: '1px solid var(--rose)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#fda4af',
              marginBottom: '1rem'
            }}
          >
            ⚠️ {errorMsg}
          </div>
        )}

        <PlanSelector
          services={services}
          selectedService={selectedService}
          onSelect={setSelectedService}
          loading={loadingCatalog}
        />

        <div className="card-title-wrap" style={{ marginTop: '1.8rem' }}>
          <div className="card-step-num">۲</div>
          <h2 className="card-title">انتخاب شبکه و ارز بلاکچین</h2>
        </div>

        <NetworkSelector
          networks={networks}
          selectedNetwork={selectedNetwork}
          onSelectNetwork={setSelectedNetwork}
          currencies={currencies}
          selectedCurrency={selectedCurrency}
          onSelectCurrency={setSelectedCurrency}
          loadingCurrencies={loadingCurrencies}
        />

        <div className="selector-group" style={{ marginTop: '1rem' }}>
          <label className="selector-label">شناسه عددی تلگرام کاربر (جهت اتصال به ربات):</label>
          <input
            type="text"
            className="input-custom"
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder="مثال: 84920194"
          />
        </div>

        <button
          type="button"
          className="btn-submit"
          onClick={handleCreateInvoice}
          disabled={creatingInvoice || loadingCatalog}
        >
          {creatingInvoice ? 'در حال صدور فاکتور در بک‌اند...' : '⚡ صدور فاکتور رسمی (POST /invoices)'}
        </button>
      </div>

      {/* نمایش فاکتور با آدرس خام بلاکچین */}
      <div>
        {activeInvoice ? (
          <InvoiceCard
            invoice={activeInvoice}
            onStatusChange={handleStatusChange}
            onCopy={handleCopy}
            onReset={() => setActiveInvoice(null)}
          />
        ) : (
          <div className="card-panel" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧾</div>
            <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>فاکتوری صادر نشده است</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '360px', margin: '0 auto' }}>
              یک خدمت و ارز انتخاب کرده و روی «صدور فاکتور رسمی» کلیک کنید تا آدرس والت خام و Memo یکتا تولید شود.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
