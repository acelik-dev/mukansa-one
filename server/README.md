# Mukansa One — Backend

Node 24 + TypeScript (build adımı yok, `node src/index.ts`), Fastify, yerleşik `node:sqlite`.

**Tek kaynak doğruluk:** hesaplama motoru `../mobile/src/lib/calc.ts`. Sunucu bu dosyayı doğrudan import eder
(`computeMetrics` dahil); kopya yok. Sunucuya deploy ederken `mobile/src/lib/calc.ts` dosyası aynı göreli
yolda bulunmalı.

## Model

- **Cihaz = hesap.** Kutudaki 12 haneli aktivasyon kodu kimlik bilgisidir. `POST /v1/activate` kodu doğrular,
  oturum token'ı verir. Aynı kodla ikinci telefon / yeniden bağlanma aynı cihaz verisini geri getirir.
- Token yalnızca sha256 hash'i ile saklanır. Cihaz başına en fazla 10 oturum.
- Aktivasyon zamanı ve ilk kartuş zamanı ilk aktivasyonda **sunucuda** belirlenir.

## API (hepsi `Authorization: Bearer <token>`, `/v1/activate` ve `/health` hariç)

| | |
|---|---|
| `GET /health` | canlılık |
| `POST /v1/activate` `{code, platform?}` | → `{token, state}` · 404 `invalid_code` · 429 (10/dk/IP) |
| `GET /v1/me` | → `state` (cihaz, household, notif, sunucuda hesaplanan `metrics`) |
| `POST /v1/onboarding` `{household, notif}` | onboarding'i tamamlar |
| `PUT /v1/profile` `{household?, notif?}` | verilen parça tümüyle değişir (alan yoksa temizlenir) |
| `POST /v1/filter/replace` `{replacedAt?}` | idempotent; eski/tekrarlı istek yok sayılır, gelecek tarih now'a çekilir |
| `PUT/DELETE /v1/push-token` | Expo push token (oturuma bağlı) |
| `DELETE /v1/session` | oturumu kapatır |

## Bildirimler (`src/scheduler.ts`)

Cihazda sensör yok; sunucu, `calc.ts` ile takvime göre hesaplar. `SCHEDULER_INTERVAL_MIN` (varsayılan 15 dk)
aralıkla çalışır, 09:00–21:00 (TR) arası gönderir, her bildirim `notification_log` ile bir kez gider.

- Filtre: %25 (uyarı), %10 (kritik), %0 (doldu) — kartuş başına bir kez
- Haftalık özet: pazar ≥10:00
- Kilometre taşı: tasarruf (500/1000/2500/5000/10000/25000 TL), şişe (100…2500) — geçildikten sonra ≤3 gün içindeyse

Gönderim Expo Push API ile. `PUSH_DRY_RUN=1` sadece loglar. Elle tetikleme:
`npm run tick -- --at 2027-03-07T11:00:00+03:00`.

## Çalıştırma

```bash
cd server
npm install
cp .env.example .env         # PORT=3035 vb.
npm run provision -- generate --model pro --count 5   # aktivasyon kodları
npm start                    # geliştirme: npm run dev
npm test                     # 38 test (API + zamanlayıcı + panel)
npm run typecheck
```

Fabrikadan gelen kod listesi: `npm run provision -- import kodlar.csv` (satır: `KOD,model`). `list` durumları gösterir.

## Yönetim paneli

`https://aritma.mukansa.tr` — ayrı uygulama/port (`ADMIN_PORT=3036`), API alan adında admin uçları **yoktur**.
Bağımlılıksız istemci: `admin/public/` (build yok, fontlar yerel). Tüm metinler DOM API ile eklenir (innerHTML yok).

- **Sayfalar:** Genel bakış (filo etkisi, filtre sağlığı, aktivasyon grafiği), Cihazlar (arama/filtre/sıralama),
  Cihaz detayı (filtre göstergesi, profil, tahminler, oturumlar, bildirim geçmişi), Aktivasyon kodları
  (üret / içe aktar / CSV), Bildirimler, Denetim günlüğü, Sistem (zamanlayıcı, yöneticiler, parametreler).
- **Cihaz eylemleri:** test bildirimi, filtre değişimi kaydet, oturumları kapat, engelle/engeli kaldır
  (engelli cihaz uygulamada 403 alır ve çıkış yapar), aktivasyonu sıfırla, model değiştir, not, sil (seri no onayı).
- **Güvenlik:** scrypt parola; HttpOnly + Secure + SameSite=Strict çerez (12 sa); CSRF (`X-Panel` başlığı + Origin);
  giriş hız sınırı + 5 hatada 15 dk kilit; CSP/X-Frame-Options; her işlem `audit_log`'a yazılır
  (aktivasyon kodu görüntüleme ve CSV dışa aktarma dahil).
- **Hesaplar:** `npm run admin -- create <kullanici>` (rastgele parola üretir), `reset`, `list`; panelden de eklenebilir.

```bash
ADMIN_PORT=3036 npm start        # yerel: http://localhost:3036
```

## Deploy (sv.onixmedya)

`/home/onixmedya/mukansa-one-api.onixmedya.com.tr/` altında `server/` + `mobile/src/lib/calc.ts` +
`ecosystem.config.cjs` + `data/` (SQLite, 700). pm2 süreci `mukansa-one-api` (fork, tek instance — zamanlayıcı
çift çalışmasın), API 127.0.0.1:3035 + panel 127.0.0.1:3036; nginx vhost'ları aaPanel'de
(`mukansa-one-api.onixmedya.com.tr`, `aritma.mukansa.tr`), Let's Encrypt (webroot, yenilemede nginx reload kancası). Güncelleme:
`npm ci --omit=dev` + `pm2 restart mukansa-one-api`.
