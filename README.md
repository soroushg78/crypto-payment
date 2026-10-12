# ⚡ مستندات جامع درگاه پرداخت غیرحضانتی کریپتو و مدیریت خزانه‌داری
## (Enterprise In-House Crypto Payment Gateway & Wallex Treasury Rebalancer)

> **نسخه:** ۲.۵.۰ | **تاریخ به‌روزرسانی:** اکتبر ۲۰۲۶  
> **پشته فناوری:** Go 1.22+ (Clean Architecture & SOLID) | PostgreSQL 16+ (pgxpool) | React 19 + Vite (Dark Glassmorphism) | BSC (EVM) & TON (The Open Network)  
> **وضعیت عملیاتی:** ۱۰۰٪ واقعی (Zero Mock) با اتصال مستقیم به نودهای بلاکچین و پایگاه داده سازمانی

---

## فهرست مطالب (Table of Contents)
1. [چشم‌انداز و هدف سامانه (Vision & Architecture Principles)](#۱-چشم‌انداز-و-هدف-سامانه-vision--architecture-principles)
2. [استراتژی دوگانه شبکه‌ها و مدیریت والت‌ها (Dual-Network Strategy)](#۲-استراتژی-دوگانه-شبکه‌ها-و-مدیریت-والت‌ها-dual-network-strategy)
3. [معماری امنیت کلیدها و الگوی صفر-دیتابیس (Zero DB Key Storage & RAM-Only Derivation)](#۳-معماری-امنیت-کلیدها-و-الگوی-صفر-دیتابیس-zero-db-key-storage--ram-only-derivation)
4. [موتور ریبالانسینگ و الگوی ایستگاه سوخت‌رسانی گس (Gas Station & Sweeper Engine)](#۴-موتور-ریبالانسینگ-و-الگوی-ایستگاه-سوخت‌رسانی-گس-gas-station--sweeper-engine)
5. [موتور رصد خودکار بلاکچین در پس‌زمینه (Background On-Chain Payment Observer)](#۵-موتور-رصد-خودکار-بلاکچین-در-پس‌زمینه-background-on-chain-payment-observer)
6. [ساختار پایگاه داده و دیاگرام جداول ۸ گانه (PostgreSQL Schema & ER Diagram)](#۶-ساختار-پایگاه-داده-و-دیاگرام-جداول-۸-گانه-postgresql-schema--er-diagram)
7. [معماری بک‌اند (Go Clean Architecture & Modular Layout)](#۷-معماری-بک‌اند-go-clean-architecture--modular-layout)
8. [معماری فرانت‌اند و صفحات اپلیکیشن (React SPA & UI Flow)](#۸-معماری-فرانت‌اند-و-صفحات-اپلیکیشن-react-spa--ui-flow)
9. [مرجع کامل و جامع اندپوینت‌های API (Comprehensive REST API Reference)](#۹-مرجع-کامل-و-جامع-اندپوینت‌های-api-comprehensive-rest-api-reference)
10. [راهنمای نصب، متغیرهای محیطی و راه‌اندازی (Installation & Deployment Guide)](#۱۰-راهنمای-نصب-متغیرهای-محیطی-و-راه‌اندازی-installation--deployment-guide)

---

## ۱. چشم‌انداز و هدف سامانه (Vision & Architecture Principles)

این سامانه یک میکروسرویس سازمانی پردازش پرداخت کریپتو و مدیریت خزانه‌داری به‌صورت **کاملاً درون‌سازمانی و غیرحضانتی (In-House & Non-Custodial)** است. 

### تفاوت‌های بنیادی با درگاه‌های شخص ثالث (مانند NOWPayments / CoinPayments):
- **حذف کامل کارمزدهای واسطه‌گری:** تمامی کارمزدهای درگاه‌های متفرقه (معمولاً ۰.۵٪ تا ۲٪ ارزش کل تراکنش‌ها) حذف شده و تنها کارمزد بومی شبکه بلاکچین پرداخت می‌شود.
- **ریسک صفر تحریم و مسدودی:** کنترل کامل کلیدهای عمومی و خصوصی در سرورهای امن سازمانی بوده و دارایی‌ها بدون ریسک بلاک‌شدن یا بلوکه‌سازی توسط نهادهای خارجی پردازش می‌شوند.
- **تسویه آنی و اطلاع‌رسانی وب‌هوک:** فاکتورها بلافاصله پس از نشستن در نود اعتبارسنج و بدون معطلی برای ریبالانس، وضعیت `PAID` گرفته و کال‌بک ارسال می‌گردد.
- **انتزاع کامل برای هسته کسب‌وکار:** سرویس‌های خارجی (ربات تلگرام، اپلیکیشن فروشگاهی، بک‌اند صرافی) نیاز به درگیری با مفاهیم فنی بلاکچین ندارند؛ با ارسال یک درخواست استاندارد `POST /api/v1/invoices` فاکتور کریپتو صادر می‌شود.

---

## ۲. استراتژی دوگانه شبکه‌ها و مدیریت والت‌ها (Dual-Network Strategy)

به دلیل تفاوت‌های ساختاری شبکه‌های EVM و TON، معماری تخصیص والت به دو شیوه بهینه پیاده‌سازی شده است:

| مؤلفه | شبکه بایننس اسمارت چین (BSC / BEP-20) | شبکه تون (The Open Network / TON) |
| :--- | :--- | :--- |
| **رمزارزهای تحت پوشش** | **USDT** (توکن BEP-20)<br>**BNB** (کوین بومی شبکه) | **TON** (کوین بومی شبکه) |
| **استراتژی والت** | **تولید پویای آدرس اختصاصی (`0x...`)** | **تک‌والت خزانه‌داری متمرکز (Master Vault)** |
| **الگوی تفکیک واریز** | از طریق آدرس منحصر‌به‌فرد مقصد (`To Address`) | از طریق مموی تصادفی یکتا (`Memo / Comment`) |
| **نیاز به وارد کردن ممو** | ❌ بدون ممو (عدم سردرگمی کاربر) | ✔️ ممو الزامی (مثال: `ORD-9a4f21`) |
| **قرارداد هوشمند** | تتر رسمی: `0x55d398326f99059fF775485246999027B3197955` | کوین بومی شبکه |
| **تعداد اعشار (Decimals)** | ۱۸ رقم اعشار | ۹ رقم اعشار |
| **فرآیند ریبالانسینگ** | ✔️ الزامی (سوئیپ BEP-20 با Gas Station و اشتقاق RAM-Only) | ❌ بدون نیاز به ریبالانسینگ (Zero-Gas Inflow؛ واریز مستقیم به خزانه) |
| **کارمزد شبکه برای واریز** | پرداخت کارمزد BNB توسط کاربر از مبدأ | پرداخت کارمزد TON توسط کاربر از مبدأ |
| **هزینه پردازش داخلی** | نیاز به گس استیشن تنخواه (Index 0) جهت سوئیپ تتر | صفر مطلق (Zero Gas Overhead) |

---

## ۳. اصل بنیادین امنیتی: عدم ذخیره کلیدهای خصوصی در دیتابیس (Zero Private Key Storage)

یکی از شاخص‌ترین مزیت‌های معماری سازمانی این پروژه، تضمین نشت‌ناپذیری کلیدهای خزانه‌داری و کاربران است:
1. **عبارت بازیابی ارشد (Master Mnemonic Seed):** صرفاً در متغیرهای محیطی رمزنگاری‌شده (`backend/.env`) یا Vault نگهداری می‌شود و هیچ رکوردی از آن در دیتابیس وجود ندارد.
2. **عدم ذخیره کلید در جدول آدرس‌ها:** در دیتابیس، جدول `deposit_addresses` فقط شامل `address` (آدرس عمومی) و `derivation_index` (شمارنده عددی `1`, `2`, `3`, ...) است. هیچ ستونی به نام `private_key` در هیچ کجای دیتابیس وجود ندارد.
3. **اشتقاق در حافظه RAM در زمان نیاز (On-Demand Derivation):**
   - مسیر اشتقاق استاندارد BIP-44 برای BSC:  
     $$\text{Path} = m / 44' / 60' / 0' / 0 / \text{index}$$
   - در لحظه انجام ریبالانسینگ (Sweeping)، کلید خصوصی صرفاً درون حافظه موقت (RAM) پردازشگر Go مشتق شده، تراکنش به صورت محلی با استاندارد EIP-155 و الگوریتم `secp256k1` امضا گردیده و بایت‌های خام تراکنش به نود ارسال می‌شود.
   - بلافاصله پس از امضا، اشاره‌گر کلید از حافظه پاک می‌شود (Zero Memory Footprint).
4. **تخصیص اختصاصی اندیس ۰ برای ایستگاه سوخت‌رسانی:**
   - اندیس `0` در شبکه BSC (`m/44'/60'/0'/0/0`) منحصراً متعلق به کیف پول تنخواه گس (Master Gas Station) است و هرگز به فاکتورهای کاربران تخصیص نمی‌یابد. فاکتورهای کاربران از اندیس ۱ به بعد شروع می‌شوند.

---

## ۴. موتور ریبالانسینگ و الگوی ایستگاه سوخت‌رسانی گس (Gas Station & Sweeper Engine)

> ⚠️ **قانون قطعی دامنه (Domain Principle):** موتور ریبالانسینگ و سوئیپ دارایی‌ها منحصراً متعلق به **شبکه بایننس اسمارت چین (BSC)** است. در شبکه TON، تمامی واریزها به صورت مستقیم در کیف پول خزانه‌داری متمرکز می‌نشیند و به دلیل معماری مبتنی بر ممو، فاقد هرگونه نیاز به ریبالانسینگ داخلی است (Zero-Gas Inflow).

### مسئله گس در تتر بایننس اسمارت چین (BEP-20 Gas Problem):
هنگامی که کاربری به والت اختصاصی خود ۱۰ تتر واریز می‌کند، موجودی تتر ۱۰ است اما موجودی BNB والت صفر است. برای فراخوانی متد `transfer` قرارداد تتر، نود BSC نیاز به پرداخت کارمزد شبکه به صورت BNB (حدود ۰.۰۰۰۲ BNB) دارد.

### الگوی ۴ مرحله‌ای ایستگاه سوخت‌رسانی (Gas Station Pattern):
```
[کاربر: واریز تتر] ──► [تایید آنی فاکتور در دیتابیس]
                               │
                               ▼
        ┌──────────────────────────────────────────────┐
        │        موتور ریبالانسینگ (Wallex Sweeper)     │
        ├──────────────────────────────────────────────┤
        │ ۱. استعلام موجودی زنده از نود BSC (BNB & USDT)│
        │ ۲. در صورت کسری گس: سوخت‌رسانی از تنخواه BNB │
        │ ۳. اشتقاق کلید در RAM و امضای محلی تراکنش      │
        │ ۴. برادکست مستقیم تراکنش به نودهای RPC بایننس │
        └──────────────────────────────────────────────┘
                               │
                               ▼
          [ثبت خودکار در جدول دیتابیس: rebalance_records]
```

1. **بررسی موجودی زنجیره‌ای (Live Balance Check):** فراخوانی مستقیم `eth_getBalance` و متد `balanceOf` قرارداد تتر (`0x55d3...`) از نود بایننس اسمارت چین.
2. **بررسی نیاز به سوخت‌رسانی (Refuel Required?):** در صورت کمبود موجودی BNB (کمتر از ۰.۰۰۰۲ BNB)، کیف پول تنخواه (اندیس ۰) یک تراکنش تزریق گس ارسال می‌کند.
3. **انتقال به خزانه‌داری مرکزی (Sweeping):** کل موجودی تتر یا BNB به والت امن خزانه‌داری متمرکز صرافی منتقل می‌شود.
4. **ثبت رسمی در جدول `rebalance_records` دیتابیس:** کلیه مشخصات عملیات (هش تراکنش، کارمزد، مقدار، مبدأ، مقصد و وضعیت شبیه‌سازی) در PostgreSQL ثبت می‌گردد.

### دوگانه نحوه اجرای سوئیپ (Execution Modes):
- **🚀 برادکست زنده آنچین (Live On-Chain Broadcast):** ارسال بایت‌های خام تراکنش به نود بایننس و ثبت در بلاکچین (`is_simulated = false`). نیازمند موجودی واقعی روی شبکه BSC است.
- **🧪 شبیه‌سازی و تست امن (Preflight / Dry-Run Simulation):** استخراج کلید خصوصی در RAM، تخمین دقیق گس از نود BSC، ساخت و امضای معتبر EIP-155، ارزیابی نیازمندی‌های سوخت‌رسانی و ثبت لاگ تحلیلی در دیتابیس (`is_simulated = true`) بدون نیاز به بالانس تستی روی زنجیره یا مسدود شدن دکمه‌های عملیات.

---

## ۵. موتور رصد خودکار بلاکچین در پس‌زمینه (Background On-Chain Payment Observer)

در زمان شروع به کار سرور، یک Goroutine پایدار در پس‌زمینه آغاز به کار می‌کند:
```go
// هر ۱۰ ثانیه وضعیت فاکتورهای در انتظار را بررسی می‌کند
invoiceUC.StartBackgroundObserver(ctx, 10*time.Second)
```

### نحوه عملکرد رصدگر:
1. **شبکه BSC:**
   - موجودی زنده BNB یا USDT والت فاکتور از نود استعلام می‌شود.
   - چنانچه واریزی به اندازه آستانه مجاز (۹۸٪ فاکتور) باشد، وضعیت فاکتور فوراً به `PAID` تغییر کرده، زمان پرداخت ثبت شده و رکورد تراکنش در `observed_transactions` درج می‌گردد.
   - همچنین اگر والت قبلاً ریبالانس شده باشد (`Nonce > 0`)، رصدگر هوشمند این موضوع را متوجه شده و وضعیت فاکتور را تسویه‌شده اعلام می‌کند.
2. **شبکه TON:**
   - تراکنش‌های ورودی والت خزانه‌داری از طریق کلاینت Toncenter بررسی می‌شود.
   - پیام متنی ممو دیکود شده و در صورت تطابق دقیق `pay_memo` با مقدار واریزی، فاکتور تسویه و هش تراکنش ثبت می‌شود.
3. **مدیریت انقضا (Auto Expiry):** فاکتورهایی که پس از ۳۰ دقیقه واریز نداشته باشند، خودکار به وضعیت `EXPIRED` تغییر می‌یابند.

---

## ۶. ساختار پایگاه داده و دیاگرام جداول ۸ گانه (PostgreSQL Schema & ER Diagram)

پایگاه داده به‌صورت کاملاً نرمال، امن و با قیدهای جامع کلید خارجی طراحی شده است. جداول اضافه و منسوخ‌شده قدیمی (مانند `services`) و ستون‌های زائد به طور کامل پاکسازی شده‌اند و ساختار فعلی دقیقاً شامل ۸ جدول مستقل است:

```mermaid
erDiagram
    users ||--o{ deposit_addresses : "owns"
    users ||--o{ invoices : "places"
    networks ||--o{ currencies : "supports"
    networks ||--o{ deposit_addresses : "hosts"
    networks ||--o{ invoices : "processes"
    networks ||--o{ observed_transactions : "tracks"
    currencies ||--o{ invoices : "denominated_in"
    invoices ||--o{ observed_transactions : "settles"
    networks ||--o{ rebalance_records : "logs"
    
    users {
        uuid id PK
        bigint telegram_id UK
        varchar username
        varchar first_name
        timestamptz created_at
    }

    networks {
        varchar id PK "bsc, ton"
        varchar name
        varchar native_currency "BNB, TON"
        text rpc_endpoint
        boolean is_testnet
        boolean is_active
    }

    currencies {
        uuid id PK
        varchar symbol "USDT, BNB, TON"
        varchar network_id FK
        varchar contract_address
        int decimals "18 for BSC, 9 for TON"
        numeric min_deposit
        boolean is_active
    }

    deposit_addresses {
        uuid id PK
        uuid user_id FK
        varchar network_id FK
        text address
        varchar memo UK
        int derivation_index
        boolean is_assigned
        timestamptz created_at
    }

    invoices {
        uuid id PK
        varchar invoice_number UK
        uuid user_id FK
        uuid currency_id FK
        varchar network_id FK
        numeric amount_usd
        numeric crypto_amount
        numeric exchange_rate
        text pay_address
        varchar pay_memo
        varchar status "PENDING, PAID, EXPIRED, UNDERPAID"
        varchar order_id
        text callback_url
        timestamptz expires_at
        timestamptz paid_at
        timestamptz created_at
        timestamptz updated_at
    }

    observed_transactions {
        uuid id PK
        uuid invoice_id FK
        varchar network_id FK
        text tx_hash
        text from_address
        text to_address
        numeric amount
        text memo
        bigint block_number
        int confirmations
        varchar status "DETECTED, CONFIRMED, REJECTED"
        timestamptz detected_at
        timestamptz confirmed_at
    }

    admins {
        uuid id PK
        varchar username UK
        varchar password_hash "Bcrypt"
        varchar role "SUPER_ADMIN"
        bigint telegram_id UK
        boolean is_active
        timestamptz created_at
        timestamptz last_login_at
    }

    rebalance_records {
        uuid id PK
        varchar network_id "bsc"
        int derivation_index
        text from_address
        text to_address
        varchar asset "USDT, BNB"
        numeric amount
        numeric gas_fee_bnb
        text tx_hash
        varchar status "CONFIRMED, SIMULATED, FAILED"
        boolean is_simulated
        text error_message
        timestamptz created_at
    }
```

### شرح تفصیلی جداول ۸ گانه:
1. **`users`:** اطلاعات مشتریان ثبت‌شده از طریق فرانت‌اند یا ربات تلگرام.
2. **`networks`:** شبکه‌های فعال بلاکچین (`bsc`, `ton`) با آدرس مستقیم نود RPC.
3. **`currencies`:** کوین‌ها و توکن‌ها با آدرس کانترکت رسمی و رقم اعشار.
4. **`deposit_addresses`:** والت‌های تولیدشده بر اساس BIP-44 یا مموی یکتا تخصیص‌یافته به کاربران.
5. **`invoices`:** فاکتورهای مالی با مهلت ۳۰ دقیقه‌ای، نرخ تبدیل لحظه‌ای و فیلدهای مرچنت (`order_id`, `callback_url`).
6. **`observed_transactions`:** تراکنش‌های کشف‌شده با قید حیاتی `CONSTRAINT uq_network_tx_hash UNIQUE(network_id, tx_hash)` جهت جلوگیری قطعی از حمله خرج دوباره (Double-Spending).
7. **`admins`:** حساب‌های اپراتورها و مدیران با هش پسورد Bcrypt جهت ورود ایمن به پنل عملیات.
8. **`rebalance_records`:** جدول اختصاصی لاگ جامع تمامی انتقالات سوئیپ والت‌های اشتقاقی شبکه BSC به والت خزانه‌داری مرکزی (به همراه میزان گس BNB مصرف‌شده، هش تراکنش، اندیس اشتقاق و وضعیت برادکست زنده یا شبیه‌سازی). شبکه TON به دلیل معماری تک‌والت با ممو، فاقد هرگونه فرآیند ریبالانسینگ است.

---

## ۷. معماری بک‌اند (Go Clean Architecture & Modular Layout)

سرویس بک‌اند با ساختار ماژولار انترپرایز در زبان Go پیاده‌سازی شده و از اصول Clean Architecture پیروی می‌کند:

```text
backend/
├── cmd/
│   ├── api/main.go                 # نقطه ورود سرور API و سیم‌کشی ماژولار (Composition Root)
│   └── fresh/main.go               # ابزار پاکسازی کامل داده‌های تست و اجرای مجدد مایگریشن‌ها
├── internal/
│   ├── config/config.go            # بارگذاری تنظیمات محیطی از فایل .env
│   ├── domain/                     # موجودیت‌ها، خطاهای دامنه و اینترفیس‌های ریپازیتوری
│   │   ├── admin.go
│   │   ├── catalog.go
│   │   ├── payment.go              # مدل فاکتور، تراکنش و آدرس
│   │   ├── rebalance.go            # مدل RebalanceRecord و TONTreasuryStatus
│   │   └── repository.go           # قرارداد اینترفیس‌های مخازن داده
│   ├── repository/postgres/        # پیاده‌سازی ریپازیتوری‌ها با pgxpool
│   │   ├── admin_repo.go
│   │   ├── address_repo.go
│   │   ├── catalog_repo.go
│   │   ├── invoice_repo.go
│   │   ├── rebalance_repo.go       # عملیات درج و استعلام سوابق ریبالانسینگ
│   │   ├── transaction_repo.go
│   │   └── postgres.go             # اتصال به دیتابیس و AutoMigrate جداول ۸ گانه
│   ├── usecase/                    # لایه منطق تجاری و قواعد بلاکچین
│   │   ├── auth_usecase.go
│   │   ├── catalog_usecase.go
│   │   ├── invoice_usecase.go      # صدور فاکتور و رصد زنجیره‌ای
│   │   ├── rebalance_usecase.go    # محاسبات گس، اشتقاق BIP-44، سوئیپ و ثبت لاگ
│   │   └── settlement_usecase.go   # جلوگیری از Double-Spend و تسویه تراکنش
│   └── delivery/http/              # لایه وب (HTTP Delivery)
│       ├── auth_handler.go
│       ├── catalog_handler.go
│       ├── health_handler.go       # بررسی زنده سلامت سیستم و دیتابیس
│       ├── invoice_handler.go
│       ├── rebalance_handler.go    # سوئیپ، استعلام والت‌ها و سوابق
│       ├── middleware.go           # میدلورهای CORS، ریت‌لیمیتینگ، لاگ و Panic Recovery
│       └── router.go               # رجیستر مسیرها با ServeMux بومی Go 1.22+
├── migrations/                     # مایگریشن‌های SQL منظم (000001 تا 000008)
├── pkg/
│   ├── bip44/                      # توابع کمکی اشتقاق BIP-44
│   ├── bscrpc/                     # کلاینت مستقیم JSON-RPC به نودهای BSC با امضای محلی
│   ├── hdwallet/                   # پکیج استاندارد HD-Wallet
│   ├── logger/                     # سیستم لاگینگ ساختاریافته slog
│   └── tonrpc/                     # کلاینت مستقیم ارتباط با نودهای شبکه TON
├── go.mod
└── go.sum
```

---

## ۸. معماری فرانت‌اند و صفحات اپلیکیشن (React SPA & UI Flow)

فرانت‌اند با فریم‌ورک React 19، ابزار Vite و استایل سفارشی Dark Glassmorphism بر اساس الگوهای مدرن طراحی رابط کاربری ساخته شده است:

### صفحات و تب‌های فعال در داشبورد:
1. **💳 درگاه پرداخت و صدور فاکتور (`CheckoutPage.jsx`):**
   - انتخاب شبکه (BSC / TON) و رمزارز (USDT / BNB / TON)
   - محاسبه نرخ دلاری و کریپتو با استعلام مستقیم
   - تولید QR کد استاندارد با نمایش آدرس و مموی اختصاصی
   - تایمر معکوس ۳۰ دقیقه‌ای با مانیتورینگ وضعیت فاکتور به صورت زنده (هر ۳ ثانیه پولینگ با رصد زنجیره‌ای در بک‌اند)
2. **🏦 خزانه‌داری و ریبالانسینگ (`RebalancePage.jsx`):**
   - استعلام زنده موجودی تک‌تک والت‌های اشتقاقی از نود بایننس اسمارت چین
   - سوئیچ پویا بین حالت برادکست زنده آنچین (Live) و شبیه‌سازی پیش‌پرواز (Preflight Simulation)
   - محاسبه کسری سوخت و تخمین لحظه‌ای کارمزد گس از روی نود BSC
   - اجرای عملیات سوئیپ تتر و BNB به صورت تک‌به‌تک یا دسته‌جمعی (Batch Sweep) با امکان تست و شبیه‌سازی حتی بدون موجودی تستی
   - تب اختصاصی و شفاف‌سازی معماری خزانه‌داری متمرکز TON (مبنی بر عدم نیاز به ریبالانسینگ و کارمزد صفر داخلی)
3. **📊 سوابق و تاریخچه ریبالانسینگ (`RebalanceHistoryPage.jsx`):**
   - دریافت سوابق ثبت‌شده در جدول اختصاصی `rebalance_records` دیتابیس PostgreSQL
   - کارت‌های KPI تحلیلی زنده (کل سوئیپ‌ها، مجموع تتر تجمیع‌شده، کارمزد گس مصرفی BNB، وضعیت شبکه اختصاصی BSC)
   - فیلترهای هوشمند بر اساس دارایی (همه، USDT، BNB) و حالت اجرا (همه، برادکست زنده، شبیه‌سازی)
   - باکس جستجوی پیشرفته بر اساس هش تراکنش و آدرس مبدأ/مقصد
   - اتصال مستقیم به اکسپلورر BscScan با لینک‌های کلیک‌پذیر
4. **📜 سوابق سفارشات و تراکنش‌ها (`HistoryPage.jsx`):**
   - نمایش لیست سفارشات صادرشده، وضعیت‌های تسویه (`PAID` / `PENDING`) و کپی سریع شناسه‌ها
5. **🔐 ورود اپراتور (`LoginPage.jsx`):**
   - احراز هویت مدیران جهت دسترسی به پنل عملیات با محافظت ریت‌لیمیت

---

## ۹. مرجع کامل و جامع اندپوینت‌های API (Comprehensive REST API Reference)

- **آدرس پایه سرور:** `http://localhost:8080`
- **فرمت تبادل داده:** `application/json; charset=UTF-8`

### ۹.۱. سلامت سیستم (Health Check)
- **مسیر:** `GET /health`
- **پاسخ موفق (200 OK):**
```json
{
  "status": "UP",
  "database": "CONNECTED",
  "service": "wallet-observer",
  "time": "2026-10-12T01:45:00Z"
}
```

---

### ۹.۲. احراز هویت (Authentication)
#### ورود مدیر / اپراتور (محافظت‌شده با نرخ حداکثر ۵ تلاش در دقیقه):
- **مسیر:** `POST /api/v1/auth/login`
- **بدنه درخواست:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```
- **پاسخ موفق (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "18f921d2-...",
      "username": "admin",
      "role": "SUPER_ADMIN"
    }
  }
}
```

---

### ۹.۳. صدور و استعلام فاکتور (Invoices)

#### ۱. صدور فاکتور جدید:
- **مسیر:** `POST /api/v1/invoices`
- **بدنه درخواست:**
```json
{
  "amount_usd": 15.00,
  "network": "bsc",
  "currency": "usdt",
  "order_id": "WALLEX-ORD-101",
  "callback_url": "https://exchange.wallex.ir/api/webhook",
  "telegram_id": 987654321,
  "username": "babasoroush"
}
```
- **نمونه پاسخ موفق (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "c71a39f0-2918-4b92-9112-a1b2c3d4e5f6",
    "invoice_number": "INV-2026-9a9436",
    "network_id": "bsc",
    "currency_symbol": "USDT",
    "amount_usd": 15.00,
    "crypto_amount": 15.00,
    "exchange_rate": 1.00,
    "pay_address": "0x3C767afb6798977934E3727a6EC5B838359488F4",
    "pay_memo": null,
    "status": "PENDING",
    "order_id": "WALLEX-ORD-101",
    "callback_url": "https://exchange.wallex.ir/api/webhook",
    "expires_at": "2026-10-12T02:14:29Z",
    "created_at": "2026-10-12T01:44:29Z"
  }
}
```

#### ۲. استعلام فاکتور با شناسه UUID:
- **مسیر:** `GET /api/v1/invoices/{id}`
- **نکته:** هر بار فراخوانی این اندپوینت، به‌صورت خودکار موجودی آنچین والت را از نود بررسی می‌کند.

#### ۳. استعلام فاکتور با شماره فاکتور (Invoice Number):
- **مسیر:** `GET /api/v1/invoices/number/{number}`
- **مثال:** `GET /api/v1/invoices/number/INV-2026-9a9436`

#### ۴. دریافت لیست فاکتورها:
- **مسیر:** `GET /api/v1/invoices?limit=50`

---

### ۹.۴. کاتالوگ شبکه‌ها و ارزها (Catalog)
- **لیست شبکه‌ها:** `GET /api/v1/networks` (خروجی: شبکه‌های فعال `bsc` و `ton`).
- **لیست ارزهای شبکه:** `GET /api/v1/networks/{network_id}/currencies` (خروجی: کارنسی‌ها، تعداد اعشار و حداقل واریز).

---

### ۹.۵. عملیات خزانه‌داری و ریبالانسینگ (Wallex Sweeper & Ops)

#### ۱. دریافت وضعیت والت‌های مشتق‌شده BSC و موجودی نود:
- **مسیر:** `GET /api/v1/rebalance/wallets`
- **خروجی:** لیست والت‌های تولیدشده، اندیس BIP-44، موجودی لحظه‌ای BNB و USDT، و وضعیت آمادگی برای سوئیپ (`READY_USDT`, `READY_BNB`, `NEED_GAS`, `EMPTY`).

#### ۲. اجرای عملیات سوئیپ یک والت (Sweep Wallet):
- **مسیر:** `POST /api/v1/rebalance/sweep`
- **بدنه درخواست:**
```json
{
  "derivation_index": 1,
  "asset": "USDT",
  "treasury_address": "0x96538b76085aF8Fea9aF07aF5C8a49c66Ec90fe8",
  "real_broadcast": true
}
```
- **توضیح:** در صورت ارسال `real_broadcast: false` عملیات به صورت شبیه‌سازی ایمن انجام می‌شود و در صورت `true` تراکنش واقعی روی نود برادکست می‌گردد. رکورد این عملیات مستقیماً در دیتابیس ذخیره می‌شود.

#### ۳. سوئیپ دسته‌جمعی والت‌ها (Batch Sweep):
- **مسیر:** `POST /api/v1/rebalance/sweep-batch`
- **بدنه درخواست:**
```json
{
  "derivation_indexes": [1, 2, 3],
  "asset": "ALL",
  "real_broadcast": true
}
```

#### ۴. تخمین زنده گس‌فی از روی نود:
- **مسیر:** `GET /api/v1/rebalance/estimate?index=1&asset=USDT`
- **خروجی:** واحدهای گس، قیمت گس به Gwei، کارمزد کل به BNB و میزان کسری گس والت.

#### ۵. مشخصات امنیتی و معماری کلیدها:
- **مسیر:** `GET /api/v1/rebalance/security`
- **خروجی:** مسیر اشتقاق BIP-44، تضمین عدم ذخیره کلید در دیتابیس و الگوی RAM-Only.

#### ۶. دریافت اطلاعات خزانه‌داری متمرکز TON:
- **مسیر:** `GET /api/v1/rebalance/ton`
- **خروجی:** آدرس والت خزانه‌داری رسمی، موجودی زنده استعلام‌شده از نود، لیست فاکتورهای ورودی همراه با مموی یکتا، و تأیید عدم نیاز به ریبالانسینگ (Zero-Gas Inflow).

#### ۷. دریافت سوابق جامع ریبالانسینگ BSC از دیتابیس:
- **مسیر:** `GET /api/v1/rebalance/records?limit=100`
- **خروجی:** تمامی سوابق سوئیپ والت‌های اشتقاقی BSC از جدول `rebalance_records` با تفکیک تراکنش‌های واقعی (`is_simulated: false`) و شبیه‌سازی پیش‌پرواز (`is_simulated: true`)، همراه با کارمزد گس مصرفی، مقادیر USDT/BNB، آدرس‌ها و هش‌های تراکنش.

---

## ۱۰. راهنمای نصب، متغیرهای محیطی و راه‌اندازی (Installation & Deployment Guide)

### پیش‌نیازها:
- **Go:** نسخه 1.22 یا بالاتر
- **Node.js:** نسخه 18 یا بالاتر و `npm`
- **PostgreSQL:** نسخه 14 یا بالاتر

---

### تنظیم متغیرهای محیطی (`backend/.env`):
یک فایل به نام `.env` در مسیر `backend/` با محتوای زیر قرار دهید:

```env
# تنظیمات سرور Go
PORT=8080
HOST=0.0.0.0
APP_ENV=development
LOG_LEVEL=info

# اتصال به دیتابیس PostgreSQL
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/wallet_ledger?sslmode=disable
DB_MAX_CONNS=25
DB_MIN_CONNS=5

# امنیت و کلیدهای خزانه‌داری
JWT_SECRET=super_secret_jwt_key_wallex_ops_2026
BSC_MASTER_MNEMONIC="your twelve word seed phrase for bsc hd wallet derivation"
BSC_RPC_ENDPOINT=https://bsc-dataseed.binance.org
BSC_TREASURY_ADDRESS=0x96538b76085aF8Fea9aF07aF5C8a49c66Ec90fe8

# شبکه TON
TON_ENDPOINT=https://toncenter.com/api/v2
TON_API_KEY=""
TON_MASTER_MNEMONIC="your 24 words official ton wallet mnemonic phrase here"
TON_TREASURY_WALLET=UQCoIO3NMFAZJnXOPdlZqCrahKRiGBB8I6fSaa4ij6qKquQw
```

---

### مراحل اجرا:

#### ۱. ایجاد پایگاه داده در PostgreSQL:
```sql
CREATE DATABASE wallet_ledger;
```

#### ۲. اجرای سرور بک‌اند (با مایگریشن‌های خودکار):
```bash
cd backend

# اجرای سرور API
go run ./cmd/api
```
سرور به‌صورت خودکار تمامی جداول ۸ گانه، ایندکس‌ها، کاربر تلگرام `@babasoroush` و ادمین پیش‌فرض (`admin` / `admin123`) را مقداردهی اولیه کرده و روی پورت `8080` در دسترس خواهد بود.

#### ۳. ابزار پاکسازی و ریست داده‌های تست (`cmd/fresh`):
در صورت نیاز به پاک کردن تراکنش‌های تستی و بازگشت به وضعیت تمیز بدون پاک شدن ساختار جداول:
```bash
cd backend
go run ./cmd/fresh
```

#### ۴. اجرای اپلیکیشن فرانت‌اند:
```bash
cd frontend

# نصب وابستگی‌ها
npm install

# اجرای محیط توسعه
npm run dev
```
داشبورد روی `http://localhost:5173` باز خواهد شد و مستقیماً با سرور بک‌اند ارتباط برقرار می‌کند.

#### ۵. بیلد نهایی برای پروداکشن:
```bash
cd frontend
npm run build
```
فایل‌های خروجی در پوشه `frontend/dist` تولید می‌شوند.

---

### مستندات بصری و شبیه‌ساز معماری:
برای دسترسی به دیاگرام تعاملی معماری، مستندات مهندسی بلاکچین و شبیه‌ساز زنده صدور فاکتور و تسویه می‌توانید فایل مجزای [architecture.html](file:///c:/Users/ahmad/Desktop/dev/crypto-service/architecture.html) را مستقیماً در مرورگر باز فرمایید.
