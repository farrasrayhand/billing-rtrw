# Panduan Deploy Billing RTRW ke Easypanel

Panduan langkah-demi-langkah men-deploy aplikasi ini (Node.js + SQLite + RADIUS) di [Easypanel](https://easypanel.io) memakai Dockerfile yang sudah disiapkan di repo ini.

---

## 1. Ringkasan & prasyarat

| Hal | Nilai |
|---|---|
| Runtime | Node.js **≥ 20** |
| Start command | `node app-customer.js` (port dari `settings.json` → `server_port`, default **3001**) |
| Database | **SQLite** (file, tidak butuh service DB eksternal) |
| Data persisten | `database/`, `settings.json`, `public/uploads/`, `auth_info_baileys/`, `logs/`, `backups/`, `data/` |
| Port | HTTP/TCP **3001**; RADIUS (opsional) UDP **1812** & **1813** |
| Proxy | App sudah `app.set('trust proxy', 1)` — cocok di belakang Traefik/Easypanel |

Yang perlu kamu miliki: server dengan Easypanel terpasang, domain (untuk HTTPS), dan akses repo Git app ini.

---

## 2. File yang sudah disiapkan

- **`Dockerfile`** — multi-stage build (Node 20, toolchain untuk `better-sqlite3`).
- **`docker-entrypoint.sh`** — memetakan semua data persisten ke satu volume `/app/storage`.
- **`.dockerignore`** — mengecualikan `node_modules`, DB lokal, uploads, android-app, dsb.

> Kenapa perlu entrypoint? Aplikasi menyimpan data di **path tetap** (`/app/database`, `/app/settings.json`, dst). Supaya cukup **satu volume** dan tidak ada data hilang saat redeploy, entrypoint membuat symlink dari path-path itu ke `/app/storage`.

---

## 3. Langkah deploy di Easypanel

### 3.1 Buat App
1. **Create Project** (mis. `billing`).
2. **+ Service → App**.
3. **Source**: pilih **GitHub** → repo ini → branch yang dipakai (mis. `main`).
4. **Build**: pilih **Dockerfile** (Build Path `/`, Dockerfile Path `Dockerfile`).

### 3.2 Port
- Set **Port = 3001** (samakan dengan `server_port` di `settings.json`).
- Jangan ubah `server_port` lewat UI tanpa mengubah Port di Easypanel juga — kalau bentrok, app otomatis pindah ke `port + 1000` (3001 → 4001) dan proxy jadi salah arah.

### 3.3 Domain + HTTPS
- Tab **Domains** → tambah domain, arahkan ke Port `3001`, aktifkan **HTTPS (Let's Encrypt)**.

### 3.4 Volume (WAJIB)
- Tab **Mounts → Add Mount → Volume**.
- **Name**: `billing-data` (bebas)
- **Mount Path**: `/app/storage`

Satu volume ini menampung: DB SQLite, `settings.json`, uploads, session WhatsApp, logs, backups.

### 3.5 Environment Variables
| Key | Value | Keterangan |
|---|---|---|
| `NODE_ENV` | `production` | mode produksi |
| `TZ` | `Asia/Jakarta` | zona waktu log/scheduler |
| `SETTINGS_MASTER_KEY` | `<string acak 32+ char>` | kunci masking field sensitif di API settings |
| `STORAGE_DIR` | `/app/storage` | opsional (default sudah ini) |

Buat string acak, mis.: `openssl rand -hex 32`.

### 3.6 Deploy
- Klik **Deploy**. Pantau **Logs** sampai muncul:
  - `[entrypoint] storage dir: /app/storage`
  - `Server berhasil berjalan pada port 3001`
- Cek **Healthcheck**: `GET /admin/login` harus `200`.

---

## 4. Setelah deploy — checklist wajib

Masuk ke `https://<domain-kamu>/admin` (login default `admin` / `admin123`), lalu:

1. **Ganti password admin** — Pengaturan → `admin_password`.
2. **Ganti `session_secret`** — Pengaturan → `session_secret` (acak, panjang). Kalau kosong, app memakai secret acak per-proses → **sesi login putus tiap restart**.
3. **Set `app_url`** — isi `https://<domain-kamu>`. Dipakai untuk link QRIS, webhook, dan QR stiker.
4. **Timezone** — pastikan `Asia/Jakarta`.
5. **`cookie_secure`** — biarkan **true** (karena HTTPS). Kalau kamu akses via HTTP biasa, set `false`, kalau tidak login/session bisa gagal.
6. **GenieACS / MikroTik / OLT** — isi sesuai jaringanmu (menu Pengaturan → API Eksternal, MikroTik → Pengaturan, dst).
7. **WhatsApp** — buka menu **WhatsApp → Status Bot**, scan QR sekali. Session tersimpan di `auth_info_baileys/` (di volume) sehingga tidak perlu scan ulang tiap deploy.
8. **Ganti default sensitif** yang ikut ter-commit: `admin_password`, `radius_secret` (bukan `secret123`), API key pembayaran (Tripay/Midtrans/Digiflazz, dll).

---

## 5. RADIUS (opsional, UDP)

- Aplikasi punya **server RADIUS bawaan** (port **UDP 1812/1813**). Traefik/Easypanel **tidak** mem-forward UDP otomatis — port ini harus **dipublish langsung**.
- Di Easypanel: tab **Ports/Advanced** → tambahkan publish `1812/udp` dan `1813/udp` (kalau versi Easypanel-mu mendukung UDP; kalau tidak, jalankan RADIUS di host/router terpisah atau lewat `--network host` di server).
- Keamanan: daftarkan **NAS** (IP + secret) di RADIUS Server → tab **Daftar NAS Router**, dan **ganti Global Shared Secret**. Kalau daftar NAS kosong, server memakai secret global untuk semua pengirim.
- Aktifkan mode RADIUS di **MikroTik → Pengaturan** atau **RADIUS Server → Pengaturan RADIUS**.

---

## 6. Backup, migrasi data & restore

### Backup rutin
Cukup backup **isi volume** `/app/storage` (DB + settings + uploads + session WA). Aplikasi juga punya fitur **Backup & Recovery** di menu Sistem.

### Migrasi dari server lama (data sudah ada)
1. **Stop** aplikasi lama (agar DB tidak berubah saat disalin).
2. Salin isi data lama ke volume Easypanel:
   - `database/billing.db` (+ `-wal`, `-shm` bila ada)
   - `settings.json`
   - `auth_info_baileys/`
   - `public/uploads/`
3. Cara termudah: sementara mount/pakai file manager Easypanel, atau:
   ```bash
   # di host Easypanel (cek path volume project-mu)
   docker cp ./database/billing.db <container>:/app/storage/database/billing.db
   docker cp ./settings.json       <container>:/app/storage/settings.json
   ```
4. Restart app, cek login & data.

> Jika deploy dari repo Git **tanpa** memindahkan data: DB akan dibuat **baru/kosong** dan `settings.json` memakai `settings.json.default` bawaan image. Jadi migrasi data = pindahkan isi volume seperti di atas.

---

## 7. Update & rollback

- **Update**: push ke branch yang dipakai → di Easypanel klik **Deploy/Redeploy**. Data aman karena ada di volume.
- **Rollback**: Easypanel menyimpan riwayat deploy → pilih deployment sebelumnya → **Rollback**.

---

## 8. Troubleshooting

| Gejala | Sebab & solusi |
|---|---|
| Data hilang tiap redeploy | Volume belum dipasang di `/app/storage`. Pasang lalu redeploy. |
| Sesi login putus tiap restart | `session_secret` kosong/default → set nilai acak tetap di Pengaturan. |
| Login tidak jalan di HTTP | `cookie_secure` true. Set `false` bila tanpa HTTPS. |
| App jalan tapi domain tak bisa dibuka | Port Easypanel ≠ `server_port`. Samakan ke `3001`. |
| Log: port 3001 dipakai, pindah ke 4001 | Ada proses lain di container/`server_port` beda. Pastikan hanya 1 instance. |
| WhatsApp minta scan QR tiap deploy | `auth_info_baileys/` tidak ikut volume. |
| Halaman OLT/Monitoring lama saat perangkat offline | Sudah ada timeout cepat (~2s OLT, ~5s GenieACS). Kalau tetap lama, cek `snmp_community`/IP. |
| `better-sqlite3` gagal build | Pakai Dockerfile repo ini (sudah menyertakan `python3 make g++` di stage build). |

---

## 9. Catatan penting

- **Jalankan hanya 1 replika.** SQLite + `node-cron` + session WhatsApp berjalan dalam satu proses — jangan scale ke >1 replika (bisa korup DB / dobel cron / WA bentrok).
- **Jangan commit data sensitif**: `settings.json` di repo berisi password/kunci — anggap bocor dan ganti semua kredensialnya setelah deploy.
- **HTTPS wajib** untuk produksi (Easypanel menyediakan Let's Encrypt).
- **Resource**: beri RAM minimal ± 512 MB–1 GB (Baileys + Jimp + PDF cukup berat saat proses).

---

## 10. Uji cepat setelah deploy

1. `https://<domain>/admin/login` → login.
2. Dashboard muncul tanpa error.
3. Menu **MikroTik → Pengaturan** & **RADIUS Server** bisa dibuka.
4. **WhatsApp → Status Bot** = terhubung.
5. Restart/redeploy app → data (pelanggan, settings) tetap ada.
