# ⚡ Enterprise Crypto Payment Service & Blockchain Observer

سرویس درگاه پرداخت کریپتو و ناظر مستقیم بلاکچین بدون واسطه (Direct Node Observer)، طراحی شده با معماری تمیز و ماژولار (Clean Architecture + SOLID) در زبان Go و محیط تست و دموی مدرن React.

---

## 📁 ساختار پروژه (Project Structure)

```text
crypto-payment/
├── backend/                  # سرویس اصلی بک‌اند (Go 1.22+ Standard HTTP & PostgreSQL)
│   ├── cmd/api/main.go       # نقطه ورود و سیم‌کشی ماژولار (Composition Root)
│   ├── internal/
│   │   ├── config/           # مدیریت متغیرهای محیطی
│   │   ├── delivery/http/    # لایه وب (کنترلرها، روتر، میدلورها، پاسخ‌ها)
│   │   ├── domain/           # موجودیت‌ها و اینترفیس‌های ۷ گانه
│   │   ├── repository/       # پیاده‌سازی ۷ ریپازیتوری مجزا با pgxpool
│   │   └── usecase/          # منطق‌های کاتالوگ، صدور فاکتور و تسویه حساب
│   ├── migrations/           # مایگریشن‌های گام‌به‌گام دیتابیس (000001 تا 000008)
│   ├── pkg/logger/           # لاگر ساختاریافته slog
│   ├── tests/                # تست‌های واحد و یکپارچگی
│   ├── go.mod / go.sum
│   └── .env.example
│
├── frontend/                 # اپلیکیشن وب تست و دموی پرداخت (React 19 + Vite)
│   ├── src/
│   │   ├── App.jsx           # کاتالوگ، فلوچارت پرداخت، تایمر و شبیه‌ساز تراکنش
│   │   └── index.css         # استایل‌های مدرن Vanilla CSS و Dark Glassmorphism
│   ├── package.json
│   └── vite.config.js
│
├── architecture.html         # داشبورد مستندات بصری معماری و دیاگرام دیتابیس
├── .gitignore
└── README.md
```

---

## 🚀 راهنمای راه‌اندازی سریع (Quickstart)

### ۱. اجرای بک‌اند (Go Backend)
```bash
cd backend

# کپی فایل تنظیمات
cp .env.example .env

# اجرای تست‌ها
go test -v ./...

# اجرای سرور
go run ./cmd/api
```
سرور به طور پیش‌فرض روی آدرس `http://localhost:8080` اجرا می‌شود.

### ۲. اجرای فرانت‌اند (React Demo Frontend)
```bash
cd frontend

# نصب وابستگی‌ها
npm install

# اجرای سرور توسعه
npm run dev
```
محیط دمو روی پورت پیش‌فرض Vite (مانند `http://localhost:5173`) در دسترس خواهد بود.

---

## 💎 ویژگی‌های کلیدی
- **بدون واسطه (Zero Middleman):** اتصال مستقیم به ولیدیتورهای نود TON (کارمزد صفر شرکت‌های درگاه).
- **مدل Master Wallet + Unique Memo:** یک والت مستر امن با مموی اختصاصی برای هر سفارش جهت صرفه‌جویی در کارمزد انتقال.
- **دیتابیس ۷ جدولی نرمال:** تفکیک دقیق `users`, `services`, `networks`, `currencies`, `deposit_addresses`, `invoices`, `observed_transactions`.
- **جلوگیری از Double-Spending:** قید یکتایی `UNIQUE(network_id, tx_hash)` در پایگاه داده.
- **پشتیبانی دوگانه:** آماده اتصال همزمان به وب‌اپلیکیشن تست React و ربات تلگرام.
