import React, { useState } from 'react';
import { invoiceApi } from '../api/invoiceApi';
import { rebalanceApi } from '../api/rebalanceApi';
import { Bell, BookOpen, Zap, Send, Loader2 } from 'lucide-react';

export default function ApiDocsPage({ onShowToast }) {
  const [activeDocTab, setActiveDocTab] = useState('invoices');

  // Interactive Tester States
  const [testNetwork, setTestNetwork] = useState('bsc');
  const [testCurrency, setTestCurrency] = useState('usdt');
  const [testAmount, setTestAmount] = useState('15.00');
  const [testTelegramUser, setTestTelegramUser] = useState('babasoroush');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleTestCreateInvoice = async () => {
    try {
      setIsTesting(true);
      setTestResult(null);

      const isNumeric = /^\d+$/.test(testTelegramUser.trim());
      const res = await invoiceApi.createInvoice({
        amount_usd: parseFloat(testAmount),
        network: testNetwork,
        currency: testCurrency,
        telegramId: isNumeric ? parseInt(testTelegramUser.trim(), 10) : undefined,
        username: !isNumeric ? testTelegramUser.trim() : undefined
      });

      setTestResult(res);
      onShowToast?.('درخواست با موفقیت ارسال شد و فاکتور تولید گردید!', 'success');
    } catch (err) {
      setTestResult({ error: err.message });
      onShowToast?.(`خطا در ایجاد فاکتور: ${err.message}`, 'error');
    } finally {
      setIsTesting(false);
    }
  };

  const curlExample = `curl -X POST http://localhost:8080/api/v1/invoices \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount_usd": ${testAmount},
    "network": "${testNetwork}",
    "currency": "${testCurrency}",
    "username": "${testTelegramUser}"
  }'`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. API Header */}
      <div className="card-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <BookOpen size={24} color="var(--primary)" />
              <h2 className="card-title" style={{ margin: 0 }}>
                مستندات فنی API و سند اتصال وب‌هوک (NowPayments In-House Replacement)
              </h2>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.4rem', lineHeight: 1.6 }}>
              سرویس اختصاصی درگاه پرداخت کریپتو برای اتصال به بک‌اند صرافی یا سیستم‌های فروشگاهی. بدون کارمزد واسط، مستقیماً متصل به نودهای BSC و TON.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn-sim-action ${activeDocTab === 'invoices' ? 'active' : ''}`}
              style={{ borderColor: activeDocTab === 'invoices' ? 'var(--primary)' : undefined }}
              onClick={() => setActiveDocTab('invoices')}
            >
              ۱. ایجاد فاکتور (Invoices)
            </button>
            <button
              className={`btn-sim-action ${activeDocTab === 'webhook' ? 'active' : ''}`}
              style={{ borderColor: activeDocTab === 'webhook' ? 'var(--cyan)' : undefined }}
              onClick={() => setActiveDocTab('webhook')}
            >
              ۲. مشخصات وب‌هوک (Webhooks)
            </button>
            <button
              className={`btn-sim-action ${activeDocTab === 'rebalance' ? 'active' : ''}`}
              style={{ borderColor: activeDocTab === 'rebalance' ? 'var(--cyan)' : undefined }}
              onClick={() => setActiveDocTab('rebalance')}
            >
              ۳. اندپوینت ریبالانس (Sweeper)
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Invoices Section */}
      {activeDocTab === 'invoices' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Spec description */}
          <div className="card-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <span className="badge" style={{ background: '#059669', color: '#fff', fontWeight: 'bold' }}>
                POST
              </span>
              <code style={{ fontSize: '1rem', color: '#38bdf8' }}>/api/v1/invoices</code>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1rem' }}>
              ایجاد فاکتور جدید و تخصیص آنی آدرس والت اختصاصی (در شبکه BSC با ساختار HD-Wallet) یا آدرس خزانه همراه با ممو تصادفی (در شبکه TON).
            </p>

            <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '0.5rem' }}>پارامترهای ورودی (JSON Body):</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-dim)' }}>
                    <th style={{ padding: '0.5rem' }}>فیلد</th>
                    <th style={{ padding: '0.5rem' }}>نوع</th>
                    <th style={{ padding: '0.5rem' }}>الزامی</th>
                    <th style={{ padding: '0.5rem' }}>توضیحات</th>
                  </tr>
                </thead>
                <tbody style={{ fontFamily: 'monospace' }}>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--cyan)' }}>amount_usd</td>
                    <td style={{ padding: '0.5rem' }}>number</td>
                    <td style={{ padding: '0.5rem', color: '#fb7185' }}>بله</td>
                    <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>مبلغ دلاری فاکتور (مثال: 10.00)</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--cyan)' }}>network</td>
                    <td style={{ padding: '0.5rem' }}>string</td>
                    <td style={{ padding: '0.5rem', color: '#fb7185' }}>بله</td>
                    <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>شبکه: "bsc" یا "ton"</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--cyan)' }}>currency</td>
                    <td style={{ padding: '0.5rem' }}>string</td>
                    <td style={{ padding: '0.5rem', color: '#fb7185' }}>بله</td>
                    <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>نماد ارز: "usdt"، "bnb"، "ton"</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.5rem', color: 'var(--cyan)' }}>username / telegram_id</td>
                    <td style={{ padding: '0.5rem' }}>string / int</td>
                    <td style={{ padding: '0.5rem', color: '#fb7185' }}>بله (الزامی)</td>
                    <td style={{ padding: '0.5rem', color: '#cbd5e1' }}>شناسه عددی تلگرام یا نام کاربری خریدار</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: '#fff', marginBottom: '0.5rem' }}>نمونه cURL:</h4>
              <div
                style={{
                  background: '#090d16',
                  padding: '0.8rem',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: '#94a3b8',
                  direction: 'ltr',
                  overflowX: 'auto'
                }}
              >
                <pre style={{ margin: 0 }}>{curlExample}</pre>
              </div>
            </div>
          </div>

          {/* Interactive Tester Console */}
          <div className="card-panel">
            <h3 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={18} color="var(--primary)" /> کنسول تست زنده اندپوینت (Try It Out)
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="selector-label">شبکه (Network):</label>
                <select
                  className="input-custom"
                  value={testNetwork}
                  onChange={(e) => {
                    const net = e.target.value;
                    setTestNetwork(net);
                    if (net === 'ton') setTestCurrency('gram');
                    else setTestCurrency('usdt');
                  }}
                  style={{ background: '#0f172a' }}
                >
                  <option value="bsc">BNB Smart Chain (bsc)</option>
                  <option value="ton">The Open Network (ton)</option>
                </select>
              </div>

              <div>
                <label className="selector-label">ارز (Currency):</label>
                <select
                  className="input-custom"
                  value={testCurrency}
                  onChange={(e) => setTestCurrency(e.target.value)}
                  style={{ background: '#0f172a' }}
                >
                  {testNetwork === 'bsc' ? (
                    <>
                      <option value="usdt">USDT (BEP-20)</option>
                      <option value="bnb">BNB (Native Coin)</option>
                    </>
                  ) : (
                    <option value="gram">GRAM (کوین اصلی گرام)</option>
                  )}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="selector-label">مبلغ دلاری (amount_usd):</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-custom"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  style={{ direction: 'ltr' }}
                />
              </div>

              <div>
                <label className="selector-label">آی‌دی تلگرام (username / id):</label>
                <input
                  type="text"
                  className="input-custom"
                  value={testTelegramUser}
                  onChange={(e) => setTestTelegramUser(e.target.value)}
                  style={{ direction: 'ltr' }}
                />
              </div>
            </div>

            <button
              className="btn-submit"
              onClick={handleTestCreateInvoice}
              disabled={isTesting}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
            >
              {isTesting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  در حال ارسال درخواست و استعلام نرخ روز...
                </>
              ) : (
                <>
                  <Send size={16} />
                  ارسال درخواست به API و مشاهده پاسخ زنده
                </>
              )}
            </button>

            {testResult && (
              <div style={{ marginTop: '1.25rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'block', marginBottom: '0.4rem' }}>
                  پاسخ زنده بازگشتی از سرور (Live API Response):
                </span>
                <div
                  style={{
                    background: '#090d16',
                    padding: '1rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: '#34d399',
                    direction: 'ltr',
                    maxHeight: '260px',
                    overflowY: 'auto'
                  }}
                >
                  <pre style={{ margin: 0 }}>{JSON.stringify(testResult, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Webhook Specs Section */}
      {activeDocTab === 'webhook' && (
        <div className="card-panel">
          <h3 style={{ fontSize: '1.2rem', color: '#fff', marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={18} style={{ color: 'var(--primary)' }} />
            ساختار وب‌هوک و اعتبارسنجی امضای امنیتی (Webhook HMAC-SHA256)
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            به محض اینکه ناظر بلاکچین تراکنش واریزی کاربر را در شبکه کشف و به حدنصاب تاییدیه‌ها برساند، یک درخواست{' '}
            <code>POST</code> به اندپوینت مرچنت ارسال می‌شود. جهت جلوگیری از جعل (Tampering)، امضای هش در هدر{' '}
            <code>X-Signature</code> قرار می‌گیرد.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--cyan-glow)', marginBottom: '0.5rem' }}>
                نمونه پی‌لود ارسالی به وب‌هوک شما (Webhook JSON Body):
              </h4>
              <div
                style={{
                  background: '#090d16',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  direction: 'ltr'
                }}
              >
                <pre style={{ margin: 0 }}>{`{
  "event": "PAYMENT_CONFIRMED",
  "invoice_id": "0f0a9ee1-edf7-4650-b8c1-4f212ce63775",
  "invoice_number": "INV-2026-6117d9",
  "telegram_username": "babasoroush",
  "status": "PAID",
  "amount_usd": 15.00,
  "crypto_amount": 15.00,
  "currency": "USDT",
  "network": "bsc",
  "tx_hash": "0x892a...c4b1",
  "pay_address": "0xb1c8EfF6dE12aa0B49B3d6cE86c7517C856b6D76",
  "paid_at": "2026-10-11T00:50:00Z"
}`}</pre>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', color: '#fbbf24', marginBottom: '0.5rem' }}>
                اعتبارسنجی امضا در بک‌اند اصلی شما (Go / Python):
              </h4>
              <div
                style={{
                  background: '#090d16',
                  padding: '1rem',
                  borderRadius: '8px',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  color: '#a7f3d0',
                  direction: 'ltr'
                }}
              >
                <pre style={{ margin: 0 }}>{`// Go Example:
func VerifyWebhookSignature(payload []byte, secret, headerSig string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedSig := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expectedSig), []byte(headerSig))
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Rebalance Sweeper API Specs */}
      {activeDocTab === 'rebalance' && (
        <div className="card-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
            <span className="badge" style={{ background: '#059669', color: '#fff', fontWeight: 'bold' }}>
              POST
            </span>
            <code style={{ fontSize: '1rem', color: '#38bdf8' }}>/api/v1/rebalance/sweep</code>
          </div>

          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '1.25rem' }}>
            اندپوینت ویژه تیم عملیات والکس (Operations & Blockchain Ops) برای تخلیه و متمرکزسازی وجوه واریزشده کاربران به والت خزانه اصلی (Master Treasury). این اندپوینت کلید خصوصی والت را صرفاً در حافظه رم بر اساس اندیس اشتقاق محاسبه کرده و پس از امضای تراکنش بلافاصله از حافظه پاک می‌کند.
          </p>

          <div
            style={{
              background: '#090d16',
              padding: '1rem',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              color: '#94a3b8',
              direction: 'ltr'
            }}
          >
            <pre style={{ margin: 0 }}>{`// Request Payload:
{
  "derivation_index": 0,
  "asset": "USDT", // or "BNB"
  "treasury_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "real_broadcast": false // true for broadcasting to BSC RPC; false for simulation
}`}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
