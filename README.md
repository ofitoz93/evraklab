<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/Supabase-Backend-3FCF8E?logo=supabase&logoColor=white&style=for-the-badge" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-06B6D4?logo=tailwindcss&logoColor=white&style=for-the-badge" />
</p>

# 📄 EvrakLab — Akıllı Evrak Takip Sistemi

**EvrakLab**, bireysel ve kurumsal kullanıcılar için tasarlanmış, bulut tabanlı bir **evrak & belge yönetim platformudur**. Belgelerinizi dijital ortamda güvenle saklayın, süre takibini otomatikleştirin, ekibinizle gerçek zamanlı iletişim kurun ve tüm evrak süreçlerinizi tek bir yerden yönetin.

---

## 🚀 Öne Çıkan Özellikler

### 📊 Dashboard (Kontrol Paneli)
- Toplam belge, yaklaşan son tarih ve süresi dolan evrakların özet istatistikleri
- Depolama alanı kullanım göstergesi (MB/GB)
- Son yüklenen belgelere hızlı erişim
- Bireysel & kurumsal belge ayrımı

### 📁 Belge Yönetimi
- **Yükleme:** PDF, Word, JPG/PNG formatlarında dosya yükleme
- **Düzenleme & Detay:** Belge bilgilerini güncelleme, detay sayfasında tam görüntüleme
- **Arşivleme:** Süresi dolan belgeleri arşive taşıma
- **Yenileme:** Belge süresini uzatma (renew)
- **İletme:** Belgeleri diğer kullanıcılara yönlendirme (forward)
- **Silme:** Yumuşak ve kalıcı silme seçenekleri
- **Gelişmiş Filtreleme:** Tür, lokasyon, durum ve tarih bazlı filtreleme
- **Önizleme:** Dosyayı indirmeden doğrudan önizleme
- **Özel Tanımlar:** Kullanıcıya özel belge türü ve lokasyon tanımlama
- **Süresiz Belge Desteği:** Belirli bir sona erme tarihi olmayan belgeler
- **Otomatik Hatırlatma:** Son tarihe kaç gün kala e-posta bildirimi *(Premium)*

### 👥 Şirket & Ekip Yönetimi
- **Şirket Paneli:** Organizasyonu yönetme, üye listesi ve rol atamaları
- **Davet Sistemi:** E-posta ile davet veya davet kodu üretme
- **Rol Yönetimi:** Sahip, Yönetici, Personel rolleri ve izin atamaları
- **Kurumsal Belgeler:** Şirket çapında ortak belge havuzu

### 💬 Ekip Sohbeti (Team Chat)
- Gerçek zamanlı mesajlaşma (Supabase Realtime)
- Okundu / iletildi bilgisi
- Bildirim açma/kapama (sessize alma)
- Belge bağlantılarını sohbette paylaşma

### 🔔 Bildirimler
- Yaklaşan son tarih uyarıları
- Şirket katılım talepleri (onay/red akışı)
- Admin duyuruları
- Okundu olarak işaretleme ve toplu yönetim

### 🛡️ Admin Paneli
- Tüm kullanıcıları arama, düzenleme ve rol atama
- Şirket oluşturma, düzenleme ve silme
- Destek taleplerini (ticket) görüntüleme, yanıtlama ve kapatma
- Tüm kullanıcılara veya belirli gruplara bildirim gönderme
- Abonelik süresi yönetimi

### ⚙️ Ayarlar
- Profil bilgileri güncelleme (ad, telefon, e-posta)
- Şifre değiştirme
- Profil fotoğrafı yükleme
- Şirkete katılma / şirketten ayrılma
- Abonelik durumu ve süre bilgisi

### 💳 Fiyatlandırma & Abonelik
- **Bireysel Planlar:** Aylık, 3 aylık, 6 aylık ve yıllık seçenekler
- **Kurumsal Planlar:** Çoklu kullanıcı için özel fiyatlandırma
- **Depolama Paketleri:** Ekstra 500 MB veya 1 GB alan satın alma
- Mevcut abonelik süresine ekleme mantığı

### 🧰 Pratik PDF Araçları
| Araç | Açıklama |
|------|----------|
| ✂️ PDF Böl | Sayfaları tek tek ayırma |
| 📎 PDF Birleştir | Birden fazla PDF'i birleştirme |
| 📦 PDF Sıkıştır | Dosya boyutunu optimize etme |
| 🖼️ Resimden PDF | JPG/PNG → PDF dönüştürme |
| 🔒 PDF Şifrele | Dosyalara parola ekleme |
| 🔓 Şifre Kaldır | PDF parolasını kaldırma |

> Ücretsiz kullanıcılar günlük 2 işlem hakkına sahiptir. Premium üyeler sınırsız erişim alır.

### 🎫 Destek Sistemi
- Konu bazlı destek talebi oluşturma
- Canlı sohbet formatında admin ile iletişim
- Talep geçmişi ve durum takibi (açık/kapalı)

### 🌗 Tema Desteği
- Açık ve koyu tema arasında geçiş
- Tüm bileşenlerde tutarlı tema uygulaması

---

## 🏗️ Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React 19, TypeScript 5.9 |
| **Build Aracı** | Vite 7 |
| **Stil** | TailwindCSS 3.4, PostCSS, Autoprefixer |
| **Backend & Veritabanı** | Supabase (PostgreSQL, Auth, Storage, Realtime) |
| **Yönlendirme** | React Router DOM 7 |
| **İkonlar** | Lucide React |
| **Linting** | ESLint 9 + TypeScript ESLint |

---

## 📂 Proje Yapısı

```
evraklab/
├── public/                  # Statik dosyalar
├── src/
│   ├── App.tsx              # Ana uygulama, yönlendirme ve tema
│   ├── main.tsx             # Uygulama giriş noktası
│   ├── supabaseClient.ts    # Supabase bağlantı yapılandırması
│   ├── utils.ts             # Yardımcı fonksiyonlar
│   ├── ThemeContext.tsx      # Tema context provider
│   │
│   ├── Login.tsx            # Giriş sayfası
│   ├── Register.tsx         # Kayıt sayfası
│   ├── Dashboard.tsx        # Ana kontrol paneli
│   ├── Documents.tsx        # Belge listesi ve yönetimi
│   ├── AddDocument.tsx      # Yeni belge ekleme
│   ├── EditDocument.tsx     # Belge düzenleme
│   ├── DocumentDetail.tsx   # Belge detay görüntüleme
│   │
│   ├── AdminPanel.tsx       # Admin yönetim paneli
│   ├── CompanyPanel.tsx     # Şirket yönetim paneli
│   ├── TeamChat.tsx         # Ekip sohbeti
│   ├── Notifications.tsx    # Bildirim merkezi
│   ├── Settings.tsx         # Kullanıcı ayarları
│   ├── Pricing.tsx          # Abonelik ve fiyatlandırma
│   ├── Tools.tsx            # PDF araçları
│   ├── Support.tsx          # Destek talepleri
│   ├── HelpPage.tsx         # Yardım ve SSS
│   │
│   ├── index.css            # Global stiller
│   └── App.css              # Uygulama stilleri
│
├── index.html               # HTML şablonu
├── vite.config.ts           # Vite yapılandırması
├── tailwind.config.cjs      # TailwindCSS yapılandırması
├── tsconfig.json            # TypeScript yapılandırması
└── package.json             # Bağımlılıklar ve scriptler
```

---

## ⚡ Kurulum & Çalıştırma

### Gereksinimler
- [Node.js](https://nodejs.org/) (v18+)
- [npm](https://www.npmjs.com/) veya [yarn](https://yarnpkg.com/)
- [Supabase](https://supabase.com/) hesabı ve projesi

### 1. Projeyi Klonlayın
```bash
git clone https://github.com/<kullanıcı-adı>/evraklab.git
cd evraklab
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Supabase Yapılandırması
`src/supabaseClient.ts` dosyasındaki URL ve API anahtarını kendi Supabase projenize göre güncelleyin:

```typescript
const supabaseUrl = 'https://<PROJE_ID>.supabase.co';
const supabaseKey = '<ANON_PUBLIC_KEY>';
```

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```

Uygulama varsayılan olarak `http://localhost:5173` adresinde çalışacaktır.

### 5. Üretim Derlemesi
```bash
npm run build
```

---

## 📜 Mevcut Scriptler

| Script | Açıklama |
|--------|----------|
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run build` | TypeScript derler ve üretim paketi oluşturur |
| `npm run preview` | Üretim paketini yerel olarak önizler |
| `npm run lint` | ESLint ile kod kalitesi kontrolü yapar |

---

## 🔐 Kullanıcı Rolleri

| Rol | Açıklama |
|-----|----------|
| `normal` | Ücretsiz bireysel kullanıcı (5 belge limiti) |
| `premium_individual` | Premium bireysel kullanıcı |
| `premium_corporate` | Premium kurumsal kullanıcı |
| `corporate_chief` | Kurumsal yönetici |
| `corporate_staff` | Kurumsal personel |
| `admin` | Sistem yöneticisi (tam erişim) |

---

## 🗄️ Veritabanı Tabloları (Supabase)

| Tablo | Açıklama |
|-------|----------|
| `profiles` | Kullanıcı profilleri ve abonelik bilgileri |
| `organizations` | Şirket / organizasyon kayıtları |
| `documents` | Belge kayıtları ve metadata |
| `user_definitions` | Kullanıcıya özel tür ve lokasyon tanımları |
| `notifications` | Bildirim kayıtları |
| `team_messages` | Ekip sohbet mesajları |
| `support_tickets` | Destek talepleri |
| `ticket_messages` | Destek talebi mesajları |
| `org_invites` | Organizasyon davet kodları |
| `tool_usages` | PDF araç kullanım logları |

---

## 📸 Ekran Görüntüleri

> Ekran görüntüleri için `/screenshots` klasörüne görseller ekleyebilirsiniz.

---

## 🤝 Katkıda Bulunma

1. Bu depoyu fork edin
2. Yeni bir branch oluşturun (`git checkout -b ozellik/yeni-ozellik`)
3. Değişikliklerinizi commit edin (`git commit -m 'Yeni özellik eklendi'`)
4. Branch'inizi push edin (`git push origin ozellik/yeni-ozellik`)
5. Pull Request oluşturun

---

## 📄 Lisans

Bu proje özel kullanım amaçlıdır. Dağıtım ve kullanım koşulları proje sahibi tarafından belirlenir.

---

<p align="center">
  <b>EvrakLab</b> ile belgeleriniz güvende, süreçleriniz kontrol altında. 🚀
</p>
