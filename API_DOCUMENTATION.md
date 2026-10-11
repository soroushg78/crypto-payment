# مستندات کامل API میکروسرویس پرداخت کریپتو (In-House Crypto Payment Gateway API)

این سند مرجع رسمی اندپوینت‌های ارتباطی برای اتصال بک‌اند اصلی صرافی والکس به میکروسرویس پرداخت کریپتو است.

---

## ۱. اطلاعات پایه
- **آدرس پایه (Base URL):** `http://localhost:8080/api/v1`
- **فرمت تبادل داده:** `application/json`
- **کدگذاری:** `UTF-8`

---

## ۲. لیست اندپوینت‌ها

### ۲.۱. ایجاد فاکتور جدید (Create Invoice)
این متد جایگزین متدهای پیچیده و چندمرحله‌ای سیستم‌های واسط مانند NowPayments است. نرخ تبدیل لحظه‌ای و تخصیص والت در همین اندپوینت انجام می‌شود.

- **مسیر:** `POST /api/v1/invoices`
- **بدنه درخواست (JSON Request Body):**
```json
{
  "order_id": "WALLEX-ORD-101",
  "amount_usd": 15.00,
  "network": "bsc",
  "currency": "usdt",
  "callback_url": "https://exchange.wallex.ir/api/payments/crypto-webhook",
  "telegram_id": 987654321,
  "username": "babasoroush"
}
```

| فیلد | نوع | الزامی | توضیحات |
| :--- | :--- | :--- | :--- |
| `amount_usd` | number | بله | مبلغ دلاری فاکتور |
| `network` | string | بله | شبکه بلاکچین (`bsc` یا `ton`) |
| `currency` | string | بله | نماد ارز (`usdt`, `bnb`, `ton`) |
| `order_id` | string | خیر | شناسه سفارش در دیتابیس بک‌اند شما |
| `callback_url` | string | خیر | آدرس وب‌هوک جهت اطلاع‌رسانی پس از تایید تراکنش |
| `telegram_id` | integer | خیر | شناسه عددی تلگرام کاربر |
| `username` | string | خیر | نام کاربری تلگرام |

- **نمونه پاسخ موفق (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "0f0a9ee1-edf7-4650-b8c1-4f212ce63775",
    "invoice_number": "INV-2026-6117d9",
    "network_id": "bsc",
    "currency_symbol": "USDT",
    "amount_usd": 15,
    "crypto_amount": 15,
    "exchange_rate": 1,
    "pay_address": "0xb1c8EfF6dE12aa0B49B3d6cE86c7517C856b6D76",
    "pay_memo": null,
    "status": "PENDING",
    "order_id": "WALLEX-ORD-101",
    "callback_url": "https://exchange.wallex.ir/api/payments/crypto-webhook",
    "expires_at": "2026-10-11T01:16:34Z",
    "created_at": "2026-10-11T00:46:34Z"
  }
}
```

---

### ۲.۲. استعلام وضعیت فاکتور (Get Invoice Status)
- **مسیر:** `GET /api/v1/invoices/{id}`
- **پاسخ:** اطلاعات کامل فاکتور به همراه وضعیت (`PENDING`, `PAID`, `EXPIRED`, `UNDERPAID`).

---

### ۲.۳. استعلام شبکه‌ها و ارزها (Catalog)
- **لیست شبکه‌ها:** `GET /api/v1/networks`
  - خروجی: آرایه‌ای از شبکه‌های فعال (`bsc`, `ton`) و آدرس نود مستقیم RPC.
- **لیست ارزهای هر شبکه:** `GET /api/v1/networks/{network_id}/currencies`
  - خروجی: کارنسی‌های شبکه شامل آدرس کانترکت توکن، تعداد اعشار و حداقل واریزی.

---

### ۲.۴. اندپوینت‌های سیستم ریبالانسینگ (Sweeper & Ops)

#### الف) مشاهده لیست والت‌های اختصاص‌یافته و موجودی نود:
- **مسیر:** `GET /api/v1/rebalance/wallets`
- **پاسخ:**
```json
{
  "success": true,
  "data": [
    {
      "derivation_index": 0,
      "derivation_path": "m/44'/60'/0'/0/0",
      "address": "0xb1c8EfF6dE12aa0B49B3d6cE86c7517C856b6D76",
      "network_id": "bsc",
      "bnb_balance": 0.005,
      "usdt_balance": 15.00,
      "needs_refuel": false,
      "sweep_status": "READY_USDT"
    }
  ]
}
```

#### ب) اجرای عملیات تخلیه و سوئیپ به خزانه:
- **مسیر:** `POST /api/v1/rebalance/sweep`
- **بدنه درخواست:**
```json
{
  "derivation_index": 0,
  "asset": "USDT",
  "treasury_address": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "real_broadcast": false
}
```
- **توضیح فیلد `real_broadcast`:**
  - اگر `false` باشد: شبیه‌سازی امن (Dry Run) انجام می‌دهد، گس را محاسبه و امضا در رم را تست می‌کند بدون کسر موجودی.
  - اگر `true` باشد: تراکنش امضا شده را مستقیماً به نود BSC ارسال می‌کند.

---

## ۳. ساختار وب‌هوک (Webhook Dispatch & HMAC Signature)

پس از کشف واریزی توسط ناظر، میکروسرویس درخواست زیر را به `callback_url` ارسال می‌کند:

```http
POST /api/payments/crypto-webhook HTTP/1.1
Host: exchange.wallex.ir
Content-Type: application/json
X-Signature: a58b49f99e3d92f7dc2c317188b488b32d20fa21e25eecae8ec5e7f017fbb808

{
  "event": "PAYMENT_CONFIRMED",
  "invoice_id": "0f0a9ee1-edf7-4650-b8c1-4f212ce63775",
  "invoice_number": "INV-2026-6117d9",
  "order_id": "WALLEX-ORD-101",
  "status": "PAID",
  "amount_usd": 15.00,
  "crypto_amount": 15.00,
  "currency": "USDT",
  "network": "bsc",
  "tx_hash": "0x892a7e782d8c3f4e...",
  "pay_address": "0xb1c8EfF6dE12aa0B49B3d6cE86c7517C856b6D76",
  "paid_at": "2026-10-11T00:50:00Z"
}
```

### اعتبارسنجی امضا در Go:
```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

func VerifySignature(body []byte, secretKey, signatureHeader string) bool {
	mac := hmac.New(sha256.New, []byte(secretKey))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expectedSig), []byte(signatureHeader))
}
```
