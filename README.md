# Widget Base - Platform Widget Development

Vue.js ve Vuetify kullanılarak geliştirilen platform widget uygulaması. Docker container içinde hot reload desteği ile geliştirme yapılabilir.

## 📋 İçindekiler

- [Gereksinimler](#gereksinimler)
- [Projeyi Klonlama ve Kurulum](#projeyi-klonlama-ve-kurulum)
- [Development Ortamı](#development-ortamı)
  - [Docker ile Çalıştırma (Önerilen)](#docker-ile-çalıştırma-önerilen)
  - [Yerel Ortamda Çalıştırma](#yerel-ortamda-çalıştırma)
- [Proje Yapısı](#proje-yapısı)
- [Hot Reload](#hot-reload)
- [Build ve Deploy](#build-ve-deploy)
- [Widget Konfigürasyonu](#widget-konfigürasyonu)
- [Troubleshooting](#troubleshooting)
- [Önemli Notlar](#önemli-notlar)

---

## Gereksinimler

### Zorunlu

- **Docker** (20.10 veya üzeri)
- **Docker Compose** (2.0 veya üzeri)
- **Git**

### Opsiyonel (Yerel Geliştirme)

- **Node.js** 18.0.0 veya üzeri
- **npm** 9.0.0 veya üzeri

---

## 🚀 Yeni Widget Oluşturma (Template Kullanımı)

Bu repository bir **template repository** olarak kullanılabilir. Yeni bir widget projesi oluştururken:

### Yöntem 1: GitHub Template'dan Oluşturma (Önerilen)

1. GitHub'da bu repository'nin ana sayfasında **"Use this template"** butonuna tıklayın
2. Yeni repository adını girin (örn: `my-widget`)
3. Repository'yi oluşturun
4. Yerel makinenize clone edin:

```bash
git clone https://github.com/<kullanici-adi>/<yeni-widget-adi>.git
cd <yeni-widget-adi>
```

### Yöntem 2: Git Clone ile

```bash
# Base repository'yi clone et
git clone https://github.com/metaplm/basewidget.git my-widget
cd my-widget

# Yeni bir remote ekle
git remote remove origin
git remote add origin https://github.com/<kullanici-adi>/my-widget.git

# İlk commit
git add .
git commit -m "Initial commit from widget-base template"
git push -u origin main
```

### Yeni Projeyi Özelleştirme

1. **Proje Adını Değiştir**:
   - `README.md` - Proje ismini güncelleyin
   - `package.json` - `name` ve `description` alanlarını güncelleyin
   - `widget-config.js` - URL'leri yeni projenize göre güncelleyin

2. **Container Adını Değiştir**:
   - `docker-compose.yml` içindeki `container_name` ve `image` alanlarını değiştirin
   - Örn: `widget-base` → `my-widget`

3. **Port Numarasını Değiştir** (opsiyonel):
   - `docker-compose.yml` ve `widget-config.js` dosyalarında port numarasını değiştirin
   - Örn: `8884` → `8885`

4. **Gereksiz Dosyaları Temizle**:
   - `src/components/test.vue` - Test component'ini kaldırın veya özelleştirin
   - `README.md` - Projenize özel dokümantasyon oluşturun

---

## Projeyi Klonlama ve Kurulum

### 1. Repository'yi Klonlayın

```bash
git clone <repository-url>
cd <proje-adi>
```

### 2. Docker Image'ı Build Edin

```bash
docker compose build
```

Bu komut:
- Node.js 18 Alpine image'ını indirir
- npm bağımlılıklarını yükler
- Image'ı oluşturur

---

## Development Ortamı

### Docker ile Çalıştırma (Önerilen)

#### 1. Container'ı Başlatın

```bash
docker compose up -d
```

#### 2. Durumu Kontrol Edin

```bash
# Container durumunu kontrol et
docker ps

# Logları izle
docker logs -f widget-base
```

#### 3. Uygulamaya Erişin

- **Development URL**: `https://dev.metaplm.com:8884/basewidget/`
- **Localhost**: `https://localhost:8884/`
- **Container IP**: Container'ın network IP'si

#### 4. Container'ı Durdurun

```bash
# Container'ı durdur
docker compose down

# Container ve volume'ları sil
docker compose down -v
```

### Container Komutları

```bash
# Container içine gir
docker exec -it widget-base sh

# Container'ı yeniden başlat
docker compose restart

# Container'ı yeniden build et ve başlat
docker compose up -d --build

# Container'daki npm komutlarını çalıştır
docker exec widget-base npm run build
docker exec widget-base npm install <package-name>

# Container loglarını görüntüle
docker logs widget-base
docker logs -f widget-base  # Canlı takip
```

### Volume Mounts

Development ortamında aşağıdaki klasörler container ile senkronize edilir:

| Host Path | Container Path | Açıklama |
|-----------|---------------|----------|
| `./src` | `/app/src` | Kaynak kodlar (Vue components, JS) |
| `./webpack` | `/app/webpack` | Webpack konfigürasyonları |
| `./public` | `/app/public` | Public static dosyalar |
| `./widget-config.js` | `/app/widget-config.js` | Widget yapılandırma dosyası |
| `./package.json` | `/app/package.json` | NPM paket tanımları |
| `./package-lock.json` | `/app/package-lock.json` | NPM lock dosyası |

**Not**: `node_modules` klasörü mount edilmemiştir (performance için).

### Yerel Ortamda Çalıştırma

Docker olmadan çalıştırmak için:

```bash
# Bağımlılıkları yükle
npm install

# Development server'ı başlat
npm run start

# Production build oluştur
npm run build
```

---

## Hot Reload

Hot reload özelliği etkindir! Aşağıdaki klasörlerdeki değişiklikler webpack tarafından otomatik olarak algılanır ve sayfa yenilemeden uygulanır:

- ✅ `src/` - Tüm Vue component'leri, JavaScript dosyaları
- ✅ `webpack/` - Webpack konfigürasyon dosyaları
- ✅ `public/` - Static dosyalar (images, fonts, etc.)
- ✅ `widget-config.js` - Widget yapılandırması
- ✅ `package.json` - Package tanımları

**Test:** `src/components/test.vue` dosyasında küçük bir değişiklik yapın (örneğin bir yorum ekleyin) ve logları izleyin:

```bash
docker logs -f widget-base
```

Değişiklik otomatik olarak algılanacak ve webpack yeniden derlenecektir.

---

## Proje Yapısı

```
widget-base/
├── src/
│   ├── components/        # Vue components
│   │   ├── app.vue       # Ana uygulama component'i
│   │   └── test.vue      # Test component'i
│   ├── js/               # JavaScript modüller
│   │   ├── Platform3DSpace.js
│   │   └── PlatformInterface.js
│   ├── lib/              # Kütüphaneler
│   ├── i18n/            # Çoklu dil desteği
│   ├── assets/          # Asset dosyaları
│   ├── main.js          # Uygulama giriş noktası
│   └── index.html       # HTML template
├── webpack/             # Webpack konfigürasyonları
│   ├── webpack.config.dev.js
│   ├── webpack.config.prod.js
│   └── ...
├── public/              # Public static dosyalar
│   ├── static/
│   │   ├── images/
│   │   ├── fonts/
│   │   └── lib/
├── dist/                # Build output (gitignore)
├── node_modules/        # NPM paketleri (gitignore)
├── widget-config.js     # Widget konfigürasyonu
├── package.json         # NPM paket tanımları
├── Dockerfile           # Docker image tanımı
├── docker-compose.yml   # Docker Compose konfigürasyonu
└── README.md           # Bu dosya
```

---

## Build ve Deploy

### Development Build

```bash
# Docker içinde
docker exec widget-base npm run start

# Yerel ortamda
npm run start
```

Development build:
- Source maps etkin
- Hot reload etkin
- HTTP/HTTPS üzerinden çalışır (port 8884)

### Production Build

```bash
# Docker içinde
docker exec widget-base npm run build

# Yerel ortamda
npm run build
```

Production build:
- Minified ve obfuscated
- Optimized bundle size
- `dist/` klasörüne output
- Kaynak kod gizlenir

### Deploy

Production build oluşturduktan sonra:

1. `dist/` klasöründeki dosyaları widget deployment dizinine kopyalayın
2. Platform Management --> Create Additional App sayfasına gidin
3. "Type" olarak "widget" seçin
4. URL olarak `index.html` dosyasının tam yolunu girin

---

## Widget Konfigürasyonu

`widget-config.js` dosyası widget'ın yapılandırmasını içerir:

```javascript
const cfg = {
    urls: {
        local: "https://dev.metaplm.com:8884/basewidget/",
        public: "https://dev.metaplm.com:8884/basewidget/"
    },
    backend: {
        executeQueryService: "https://3dsearch25x.metaplm.com/federated/search"
    },
    dev: {
        devServer: {
            server: {
                type: "https",
                options: {
                    key: "/path/to/serverkey.key",
                    cert: "/path/to/servercert.pem"
                }
            },
            host: "0.0.0.0",
            port: 8884
        }
    }
};
```

### Konfigürasyon Parametreleri

- `urls.local`: Webpack dev server'ın çalıştığı adres
- `urls.public`: Dışarıdan erişilebilir public adres
- `backend.executeQueryService`: Backend servis endpoint'i
- `dev.devServer.server`: SSL sertifika konfigürasyonu
- `dev.devServer.host`: Server host adresi
- `dev.devServer.port`: Server port numarası

---

## Troubleshooting

### Port 8884 Zaten Kullanımda

```bash
# Port'u kullanan process'i bul
lsof -i :8884
# veya
netstat -tulpn | grep :8884

# Process'i durdur
kill <PID>
```

### Container Başlamıyor

```bash
# Logları kontrol et
docker logs widget-base

# Container'ı yeniden build et
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Hot Reload Çalışmıyor

```bash
# Volume mount'ların doğru olduğundan emin olun
docker inspect widget-base | grep -A 20 Mounts

# Container'ı yeniden başlatın
docker compose restart
```

### node_modules Sorunları

```bash
# Container içinde node_modules'i temizle ve yeniden yükle
docker exec widget-base rm -rf node_modules
docker exec widget-base npm install

# veya container'ı yeniden build et
docker compose down
docker compose build --no-cache
docker compose up -d
```

### SSL Sertifika Hataları

SSL sertifikaları `dev.devServer.server.options` yolunda olmalıdır. Sertifikaların container içinde erişilebilir olduğundan emin olun:

```bash
# Container içinde sertifika dosyalarını kontrol edin
docker exec widget-base ls -la /home/mirac/work/certificates
```

---

## Önemli Notlar

### Docker Image Detayları

- **Container Name**: `widget-base`
- **Image**: `widget-base:latest`
- **Base Image**: `node:18-alpine`
- **Port**: `8884`
- **Environment**: `NODE_ENV=development`

### Performance Optimizasyonları

- `node_modules` host ile mount edilmemiştir
- Volume mounts sadece source code için kullanılır
- Webpack dev server HMR (Hot Module Replacement) kullanır

### Güvenlik

- SSL sertifikaları read-only modda mount edilir
- Container network izolasyonu etkin
- Puppeteer Chromium indirmesi atlanır (`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`)

### Docker Compose Ağ Yapısı

```yaml
services:
  widget-base:
    networks:
      - widget-network

networks:
  widget-network:
    driver: bridge
```

### Proje Bağımlılıkları

Ana bağımlılıklar:
- **Vue.js** 3.4.0
- **Vuetify** 3.5.0
- **Webpack** 5.90.0
- **Vue-i18n** 9.9.0
- **Chart.js** 4.4.0

---

## Geliştirme İpuçları

1. **Hot Reload**: Değişiklikleri yaptıktan sonra browser'ı yenilemeye gerek yok
2. **Console Logs**: Browser console ve Docker logs'u birlikte takip edin
3. **Component Testing**: Test component'i ile Platform Interface'i test edebilirsiniz
4. **Source Maps**: Development modunda source maps etkin, debug kolaylaşır

---

## Katkıda Bulunma

1. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
2. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
3. Branch'inizi push edin (`git push origin feature/amazing-feature`)
4. Pull Request oluşturun

---

## Lisans

MIT License

---

## İletişim

Sorularınız için issue açabilir veya proje maintainer'ları ile iletişime geçebilirsiniz.

---

**Son Güncelleme**: 2024-10-25


