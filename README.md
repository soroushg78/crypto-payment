# ⚡ مستندات جامع درگاه پرداخت غیرحضانتی کریپتو و مدیریت خزانه‌داری
## (Enterprise In-House Crypto Payment Gateway & Wallex Multi-Vault Treasury Rebalancer)

> **نسخه:** ۳.۰.۰ | **تاریخ به‌روزرسانی:** اکتبر ۲۰۲۶  
> **پشته فناوری:** Go 1.22+ (Clean Architecture & SOLID) | PostgreSQL 16+ (pgxpool) | React 19 + Vite (Dark Glassmorphism) | BSC (EVM), Ethereum (EVM) & TON (The Open Network)  
> **وضعیت عملیاتی:** ۱۰۰٪ واقعی (Zero Mock) با اتصال مستقیم به نودهای بلاکچین و پایگاه داده سازمانی

---

## فهرست مطالب (Table of Contents)
1. [چشم‌انداز و هدف سامانه (Vision & Architecture Principles)](#۱-چشم‌انداز-و-هدف-سامانه-vision--architecture-principles)
2. [استراتژی سه‌گانه شبکه‌ها و مدیریت والت‌ها (Tri-Network Strategy: BSC, ETH, TON)](#۲-استراتژی-سه‌گانه-شبکه‌ها-و-مدیریت-والت‌ها-tri-network-strategy-bsc-eth-ton)
3. [معماری امنیت کلیدها و الگوی Pure XPUB (Zero Private Key Storage & RAM-Only Derivation)](#۳-معماری-امنیت-کلیدها-و-الگوی-pure-xpub-zero-private-key-storage--ram-only-derivation)
4. [موتور ریبالانسینگ چندمقصدی خزانه‌داری (Many-to-Many Multi-Vault Sweeper Engine)](#۴-موتور-ریبالانسینگ-چندمقصدی-خزانه‌داری-many-to-many-multi-vault-sweeper-engine)
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
- **ریسک صفر تحریم و مسدودی:** کنترل کامل کلیدهای عمومی و خزانه‌داری در سرورهای امن سازمانی بوده و دارایی‌ها بدون ریسک بلاک‌شدن یا بلوکه‌سازی توسط نهادهای خارجی پردازش می‌شوند.
- **تسویه آنی و اطلاع‌رسانی وب‌هوک:** فاکتورها بلافاصله پس از نشستن در نود اعتبارسنج و بدون معطلی برای ریبالانس، وضعیت `PAID` گرفته و کال‌بک ارسال می‌گردد.
- **انتزاع کامل برای هسته کسب‌وکار:** سرویس‌های خارجی (ربات تلگرام، اپلیکیشن فروشگاهی، بک‌اند صرافی) نیاز به درگیری با مفاهیم فنی بلاکچین ندارند؛ با ارسال یک درخواست استاندارد `POST /api/v1/invoices` فاکتور کریپتو صادر می‌شود.

---

## ۲. استراتژی سه‌گانه شبکه‌ها و مدیریت والت‌ها (Tri-Network Strategy: BSC, ETH, TON)

به دلیل تفاوت‌های ساختاری شبکه‌های EVM و TON، معماری تخصیص والت به دو شیوه بهینه پیاده‌سازی شده است:

| مؤلفه | بایننس اسمارت چین (BSC / BEP-20) | اتریوم (ETH / ERC-20) | شبکه تون (TON / W5) |
| :--- | :--- | :--- | :--- |
| **رمزارزهای تحت پوشش** | **USDT** (توکن BEP-20)<br>**BNB** (کوین بومی شبکه) | **USDT** (توکن ERC-20)<br>**ETH** (کوین بومی شبکه) | **GRAM** (کوین بومی شبکه TON) |
| **استراتژی والت** | **تولید پویای آدرس اختصاصی (`0x...`)** | **تولید پویای آدرس اختصاصی (`0x...`)** | **تک‌والت خزانه‌داری متمرکز (Master Vault)** |
| **کلید عمومی ارشد** | اشتراک از طریق `BSC_XPUB` | اشتراک از طریق `BSC_XPUB` | آدرس ثابت W5 خزانه‌داری |
| **مسیر اشتقاق BIP-44** | `m/44'/60'/0'/0/{index}` | `m/44'/60'/0'/0/{index}` | استاندارد SLIP-0010 (`m/44'/607'/0'`) |
| **الگوی تفکیک واریز** | از طریق آدرس منحصر‌به‌فرد مقصد (`To Address`) | از طریق آدرس منحصر‌به‌فرد مقصد (`To Address`) | از طریق مموی تصادفی یکتا (`Memo / Comment`) |
| **نیاز به وارد کردن ممو** | ❌ بدون ممو (عدم سردرگمی کاربر) | ❌ بدون ممو (عدم سردرگمی کاربر) | ✔️ ممو الزامی (مثال: `ORD-9a4f21`) |
| **قرارداد هوشمند تتر** | تتر رسمی: `0x55d398326f99059fF775485246999027B3197955` | تتر رسمی: `0xdAC17F958D2ee523a2206206994597C13D831ec7` | — |
| **تعداد اعشار تتر** | ۱۸ رقم اعشار (BEP-20) | ۶ رقم اعشار (ERC-20) | — |
| **فرآیند ریبالانسینگ** | ✔️ الزامی (سوئیپ Many-to-Many با اشتقاق RAM-Only) | ✔️ الزامی (سوئیپ Many-to-Many با اشتقاق RAM-Only) | ❌ بدون نیاز به ریبالانسینگ (واریز مستقیم به خزانه) |
| **هزینه پردازش داخلی** | نیاز به گس استیشن تنخواه (Index 0) جهت سوئیپ تتر | نیاز به گس تنخواه ETH جهت سوئیپ تتر | صفر مطلق (Zero Gas Overhead) |

---

## ۳. معماری امنیت کلیدها و الگوی Pure XPUB (Zero Private Key Storage)

یکی از شاخص‌ترین مزیت‌های معماری سازمانی این پروژه، تضمین نشت‌ناپذیری کلیدهای خزانه‌داری و کاربران است:
1. **معماری Pure XPUB بدون کلید خصوصی روی سرور:**
   - سرور بک‌اند تنها کلید عمومی گسترش‌یافته `BSC_XPUB` را ذخیره دارد (`xpub6EeK4...`).
   - سرور قادر است میلیاردها آدرس واریز منحصربه‌فرد بر اساس استاندارد BIP-44 تولید کند بدون آنکه هرگز به کلید خصوصی دسترسی داشته باشد. حتی در صورت نفوذ کامل به سرور، هیچ دارایی به سرقت نخواهد رفت.
2. **عدم ذخیره کلید در جدول آدرس‌ها:** در دیتابیس، جدول `deposit_addresses` فقط شامل `address` (آدرس عمومی) و `derivation_index` (شمارنده عددی `1`, `2`, `3`, ...) است. هیچ ستونی به نام `private_key` در دیتابیس وجود ندارد.
3. **اشتقاق موقت در حافظه RAM در زمان ریبالانسینگ (Ephemeral RAM-Only Derivation):**
   - مسیر اشتقاق استاندارد BIP-44 برای BSC و Ethereum:  
     $$\text{Path} = m / 44' / 60' / 0' / 0 / \text{index}$$
   - در لحظه انجام ریبالانسینگ (Sweeping)، اپراتور مجاز کلید یا ریکاوری فریز را وارد می‌کند. کلید خصوصی صرفاً درون حافظه موقت (RAM) پردازشگر Go مشتق شده، تراکنش به صورت محلی با استاندارد EIP-155 و الگوریتم `secp256k1` امضا گردیده و بایت‌های خام تراکنش به نود ارسال می‌شود.
   - بلافاصله پس از امضا، اشاره‌گر کلید از حافظه پاک می‌شود (Zero Memory Footprint).
4. **تخصیص اختصاصی اندیس ۰ برای ایستگاه سوخت‌رسانی:**
   - اندیس `0` در شبکه BSC و Ethereum منحصراً متعلق به کیف پول تنخواه گس (Master Gas Station) است و هرگز به فاکتورهای کاربران تخصیص نمی‌یابد. فاکتورهای کاربران از اندیس ۱ به بعد شروع می‌شوند.

---

## ۴. موتور ریبالانسینگ چندمقصدی خزانه‌داری (Many-to-Many Multi-Vault Sweeper Engine)

در معماری سازمانی جدید، ریبالانسینگ از مدل تک‌مقصدی (Many-to-One) به مدل پیشرفته **Many-to-Many Multi-Vault Split Rebalancing** ارتقا یافته است.

### توجیه عملیاتی و مدیریت ریسک خزانه‌داری (Treasury Architecture):
در یک صرافی یا سازمان مالی معتبر، دارایی‌های ورودی نباید در یک کیف پول متمرکز شوند:
1. **خزانه سرد (Cold Storage Vault - مثلاً ۷۰٪):** والت‌های امن چندامضایی (Multi-Sig) سخت‌افزاری آفلاین جهت حفاظت بلندمدت از سرمایه.
2. **استخر تسویه و برداشت داغ (Hot Withdrawal Pool - مثلاً ۲۰٪):** والت‌های آنلاین با امضای خودکار جهت تسویه سریع درخواست‌های برداشت کاربران بدون نیاز به دخالت دستی.
3. **مخزن سوخت گس (Gas Tank Buffer - مثلاً ۱۰٪):** والت پشتیبان تنخواه جهت تأمین کارمزد نودها و شارژ مستمر ایستگاه سوخت‌رسانی گس.

```
[والت‌های واریز کاربران] (Index 1..N)
        │
        ▼  (تحلیل گس و اشتقاق RAM-Only)
 ┌─────────────────────────────────────────────────────────┐
 │       موتور تقسیم خزانه‌داری (Multi-Vault Split Engine)    │
 └─────────────────────────────────────────────────────────┘
        │                  │                  │
        ▼ (۷۰٪)            ▼ (۲۰٪)            ▼ (۱۰٪)
[خزانه سرد آفلاین]  [استخر برداشت داغ]  [مخزن تنخواه گس]
  (Cold Vault)       (Hot Pool)         (Gas Tank)
```

### الگوریتم اجرای تراکنش‌ها در EVM:
از آنجا که در شبکه‌های سازگار با اتریوم، حساب‌های EOA نمی‌توانند با یک تراکنش نیتیو به چند مقصد انتقال دهند، موتور بک‌اند:
- درصد و موجودی هر والت را بر اساس اعشار شبکه (۱۸ برای BSC/ETH، ۶ برای USDT اتریوم) محاسبه می‌کند.
- زنجیره‌ای از تراکنش‌های متوالی با مدیریت شماره ترتیبی تراکنش (`nonce`, `nonce+1`, `nonce+2`) را ایجاد و به ترتیب امضا و برادکست می‌نماید.
- هش‌های تراکنش هر مقصد به صورت مجزا ردگیری و در سوابق ذخیره می‌گردند.

---

## ۵. موتور رصد خودکار بلاکچین در پس‌زمینه (Background On-Chain Payment Observer)

در زمان شروع به کار سرور، یک Goroutine پایدار در پس‌زمینه آغاز به کار می‌کند:
```go
// هر ۱۰ ثانیه وضعیت فاکتورهای در انتظار را بررسی می‌کند
invoiceUC.StartBackgroundObserver(ctx, 10*time.Second)
```

### نحوه عملکرد رصدگر:
1. **شبکه BSC و Ethereum:**
   - موجودی زنده ارز بومی یا USDT والت فاکتور از نود استعلام می‌شود.
   - چنانچه واریزی به اندازه آستانه مجاز (۹۸٪ فاکتور) باشد، وضعیت فاکتور فوراً به `PAID` تغییر کرده، زمان پرداخت ثبت شده و رکورد تراکنش در `observed_transactions` درج می‌گردد.
   - همچنین اگر والت قبلاً ریبالانس شده باشد (`Nonce > 0`)، رصدگر هوشمند این موضوع را متوجه شده و وضعیت فاکتور را تسویه‌شده اعلام می‌کند.
2. **شبکه TON:**
   - تراکنش‌های ورودی والت خزانه‌داری از طریق کلاینت Toncenter بررسی می‌شود.
   - پیام متنی ممو دیکود شده و در صورت تطابق دقیق `pay_memo` با مقدار واریزی، فاکتور تسویه و هش تراکنش ثبت می‌شود.
3. **مدیریت انقضا (Auto Expiry):** فاکتورهایی که پس از ۳۰ دقیقه واریز نداشته باشند، خودکار به وضعیت `EXPIRED` تغییر می‌یابند.

---

## ۶. ساختار پایگاه داده و دیاگرام جداول ۸ گانه (PostgreSQL Schema & ER Diagram)

پایگاه داده به‌صورت کاملاً نرمال، امن و با قیدهای جامع کلید خارجی طراحی شده است:

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
    
    networks {
        varchar id PK "bsc, eth, ton"
        varchar name
        varchar native_currency "BNB, ETH, GRAM"
        text rpc_endpoint
        boolean is_testnet
        boolean is_active
    }

    currencies {
        uuid id PK
        varchar symbol "USDT, BNB, ETH, GRAM"
        varchar network_id FK
        varchar contract_address
        int decimals "18 for BSC/ETH, 6 for ETH-USDT, 9 for GRAM"
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
        varchar network_id "bsc, eth"
        int derivation_index
        text from_address
        text to_address
        varchar asset "USDT, BNB, ETH"
        numeric amount
        numeric gas_fee_bnb
        text tx_hash
        varchar status "CONFIRMED, SIMULATED, FAILED"
        boolean is_simulated
        text error_message
        timestamptz created_at
    }
```

---

## ۷. معماری بک‌اند (Go Clean Architecture & Modular Layout)

سرویس بک‌اند با ساختار ماژولار انترپرایز در زبان Go پیاده‌سازی شده و از اصول Clean Architecture پیروی می‌کند:

```text
backend/
├── cmd/
│   ├── api/main.go                 # نقطه ورود سرور API و راه‌اندازی کلاینت‌های BSC, ETH, TON
│   └── fresh/main.go               # ابزار پاکسازی کامل داده‌های تست و اجرای مجدد مایگریشن‌ها
├── internal/
│   ├── config/config.go            # بارگذاری تنظیمات محیطی از فایل .env
│   ├── domain/                     # مدل‌های دامنه، VaultSplit و اینترفیس‌های مخازن داده
│   │   ├── admin.go
│   │   ├── catalog.go
│   │   ├── payment.go              # مدل فاکتور، تراکنش و آدرس
│   │   ├── rebalance.go            # مدل‌های VaultSplit، SplitTransferResult و RebalanceRecord
│   │   └── repository.go
│   ├── repository/                 # مخازن داده با پشتیبانی شبکه‌های BSC, ETH, TON
│   │   ├── address_repo.go         # اشتقاق آدرس‌های BIP-44 با مدیریت اندیس
│   │   ├── admin_repo.go           # احراز هویت و مدیریت ادمین‌ها
│   │   ├── currency_repo.go        # استعلام و مدیریت رمزارزها
│   │   ├── invoice_repo.go         # مدیریت صدور و تسویه فاکتورها
│   │   ├── network_repo.go         # مدیریت و تنظیمات نودهای شبکه
│   │   ├── postgres.go             # اتصال دیتابیس و AutoMigrate خودکار
│   │   ├── rebalance_repo.go       # ثبت و استعلام تاریخچه ریبالانسینگ
│   │   ├── transaction_repo.go     # ثبت تراکنش‌ها جهت جلوگیری از Double-Spend
│   │   └── user_repo.go            # مدیریت کاربران تلگرام و سیستم
│   ├── usecase/                    # لایه منطق تجاری
│   │   ├── invoice_usecase.go      # صدور فاکتور و رصد خودکار زنجیره‌ای BSC, ETH, TON
│   │   ├── rebalance_usecase.go    # موتور ریبالانسینگ چندمقصدی Many-to-Many
│   │   └── settlement_usecase.go
│   └── delivery/http/              # هندلرهای RESTful API
│       ├── invoice_handler.go
│       ├── rebalance_handler.go    # مدیریت سوئیپ تکی و دسته‌ای با پارامتر network
│       ├── middleware.go
│       └── router.go
├── pkg/
│   ├── bscrpc/                     # کلاینت عمومی EVM برای شبکه بایننس و اتریوم با موتور Multi-Vault
│   ├── hdwallet/                   # اشتقاق حساب‌های سازگار با BIP-44 و Pure XPUB
│   └── tonrpc/                     # کلاینت ارتباط با نود شبکه TON و قرارداد W5
```

---

## ۸. معماری فرانت‌اند و صفحات اپلیکیشن (React SPA & UI Flow)

فرانت‌اند با فریم‌ورک React 19، ابزار Vite و استایل سفارشی Dark Glassmorphism بر اساس الگوهای مدرن طراحی رابط کاربری ساخته شده است:

### صفحات و امکانات پیاده‌سازی شده:
1. **💳 درگاه پرداخت و صدور فاکتور (`CheckoutPage.jsx`):**
   - انتخاب شبکه (BSC / ETH / TON) و رمزارز (USDT / BNB / ETH / GRAM)
   - محاسبه نرخ لحظه‌ای دلاری و کریپتو با استعلام مستقیم
   - تولید QR کد استاندارد با نمایش آدرس و مموی اختصاصی
   - مانیتورینگ وضعیت فاکتور به صورت زنده با وب‌هوک و تسویه خودکار
2. **🏦 خزانه‌داری و ریبالانسینگ چندمقصدی (`RebalancePage.jsx`):**
   - تب‌بندی تفکیک‌شده برای شبکه‌های **BSC (BEP-20)**، **Ethereum (ERC-20)** و **TON (The Open Network)**.
   - استعلام زنده موجودی ارزهای بومی (BNB / ETH) و توکن تتر از نودهای بلاکچین.
   - پنل تخصیص مقاصد چندگانه (Multi-Vault Split Allocation):
     - تعیین آدرس و درصد خزانه سرد (Cold Storage - پیش‌فرض ۷۰٪).
     - تعیین آدرس و درصد استخر برداشت (Hot Withdrawal - پیش‌فرض ۲۰٪).
     - تعیین آدرس و درصد مخزن گس (Gas Tank - پیش‌فرض ۱۰٪).
   - اجرای عملیات سوئیپ تکی یا دسته‌جمعی (Batch Sweep) در دو حالت Live آنچین و شبیه‌سازی پیش‌پرواز.
   - نمایش کارت‌های رهگیری و ترکینگ مجزای تراکنش برای هر والت مقصد.
3. **📊 سوابق و تاریخچه ریبالانسینگ (`RebalanceHistoryPage.jsx`):**
   - کارت‌های KPI تحلیلی زنده از کل سوئیپ‌ها، مجموع تتر و کارمزدهای مصرفی.
   - فیلتر هوشمند بر اساس دارایی و نوع شبکه.
   - باکس جستجو بر اساس هش تراکنش و آدرس.

---

## ۹. مرجع کامل و جامع اندپوینت‌های API (Comprehensive REST API Reference)

- **آدرس پایه سرور:** `http://localhost:8080`
- **فرمت تبادل داده:** `application/json; charset=UTF-8`

### ۹.۱. عملیات خزانه‌داری و ریبالانسینگ (Multi-Vault Sweeper & Ops)

#### ۱. دریافت وضعیت والت‌های مشتق‌شده (با فیلتر شبکه):
- **مسیر:** `GET /api/v1/rebalance/wallets?network=bsc` یا `GET /api/v1/rebalance/wallets?network=eth`
- **خروجی:** لیست والت‌های تولیدشده، اندیس BIP-44، موجودی لحظه‌ای ارز بومی (BNB یا ETH) و USDT، و وضعیت آمادگی برای سوئیپ.

#### ۲. اجرای عملیات سوئیپ یک والت با تقسیم چندگانه (Multi-Vault Sweep):
- **مسیر:** `POST /api/v1/rebalance/sweep`
- **بدنه درخواست:**
```json
{
  "network": "eth",
  "derivation_index": 1,
  "asset": "USDT",
  "vault_splits": [
    { "name": "Cold Storage (70%)", "address": "0x1111111111111111111111111111111111111111", "percentage": 70 },
    { "name": "Hot Withdrawal (20%)", "address": "0x2222222222222222222222222222222222222222", "percentage": 20 },
    { "name": "Gas Tank (10%)", "address": "0x3333333333333333333333333333333333333333", "percentage": 10 }
  ],
  "real_broadcast": true
}
```

#### ۳. سوئیپ دسته‌جمعی چندمقصدی (Many-to-Many Batch Sweep):
- **مسیر:** `POST /api/v1/rebalance/sweep-batch`
- **بدنه درخواست:**
```json
{
  "network": "bsc",
  "derivation_indexes": [1, 2, 3],
  "asset": "USDT",
  "vault_splits": [
    { "name": "Cold Storage (70%)", "address": "0x1111111111111111111111111111111111111111", "percentage": 70 },
    { "name": "Hot Withdrawal (20%)", "address": "0x2222222222222222222222222222222222222222", "percentage": 20 },
    { "name": "Gas Tank (10%)", "address": "0x3333333333333333333333333333333333333333", "percentage": 10 }
  ],
  "real_broadcast": false
}
```

#### ۴. تخمین زنده گس‌فی:
- **مسیر:** `GET /api/v1/rebalance/estimate?network=eth&index=1&asset=USDT`

#### ۵. دریافت اطلاعات خزانه‌داری متمرکز TON:
- **مسیر:** `GET /api/v1/rebalance/ton`

---

## ۱۰. راهنمای متغیرهای محیطی و راه‌اندازی (Configuration & Setup)

تنظیمات در فایل `crypto.env` (و کپی آن در `backend/crypto.env`) ذخیره می‌شوند:

```env
# وضعیت شبکه تستی یا اصلی (true برای Sepolia / BSC Testnet / TON Testnet)
IS_TESTNET=false

# پورت و محیط
PORT=8080
HOST=0.0.0.0
APP_ENV=production
LOG_LEVEL=info

# پایگاه داده PostgreSQL
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/wallet_ledger?sslmode=disable
DB_MAX_CONNS=25
DB_MIN_CONNS=5

# کلید امنیتی JWT
JWT_SECRET=super_secret_jwt_key_wallex_ops_2026

# کلید عمومی گسترش‌یافته (Pure XPUB - بدون نیاز به ذخیره Mnemonic روی سرور)
BSC_XPUB=xpub6EeK4uWj8y3n73cR92vLgB1iLqTj1P5mYp5W2...

# آدرس‌های خزانه‌داری
BSC_TREASURY_ADDRESS=0x96538b76085aF8Fea9aF07aF5C8a49c66Ec90fe8
ETH_TREASURY_ADDRESS=0x96538b76085aF8Fea9aF07aF5C8a49c66Ec90fe8
TON_TREASURY_WALLET=UQDRW1hBJ7uPVffzd_AGaB4DS0LNNp0WfVGO0k03DqQmUHWX
```

---

### دستورات راه‌اندازی:

#### ۱. اجرای سرور بک‌اند:
```powershell
cd c:\crypto\backend
go run ./cmd/api
```

#### ۲. اجرای فرانت‌اند:
```powershell
cd c:\crypto\frontend
npm run dev
```

#### ۳. بیلد نهایی فرانت‌اند:
```powershell
cd c:\crypto\frontend
npm run build
```
