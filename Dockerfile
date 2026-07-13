# Node.js geliştirme image'ı
FROM node:18-alpine

# Çalışma dizinini ayarla
WORKDIR /app

# Tüm dosyaları önce kopyala
COPY . .

# Bağımlılıkları yükle (Puppeteer Chromium indirmesini atla)
RUN PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install

# Port bilgisini environment variable olarak ayarla
ENV PORT=8875

# Portu expose et (8875/HTTPS)
EXPOSE 8875

# Uygulamayı başlat
CMD ["npm", "run", "start"]
