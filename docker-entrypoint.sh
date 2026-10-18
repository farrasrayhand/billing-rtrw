#!/bin/sh
# Entrypoint: arahkan semua data persisten aplikasi ke satu volume (/app/storage)
# agar aman saat redeploy di Easypanel / Docker.
set -e

STORAGE="${STORAGE_DIR:-/app/storage}"

mkdir -p "$STORAGE/database" "$STORAGE/logs" "$STORAGE/backups" \
         "$STORAGE/data" "$STORAGE/uploads" "$STORAGE/auth_info_baileys"

# settings.json: pakai bawaan image sebagai seed bila di volume belum ada
if [ ! -f "$STORAGE/settings.json" ] && [ -f /app/settings.json.default ]; then
  cp -f /app/settings.json.default "$STORAGE/settings.json"
fi

link_dir() {
  target="$1"     # path di dalam /app
  store="$2"      # folder di dalam STORAGE
  rm -rf "/app/$target"
  ln -sfn "$STORAGE/$store" "/app/$target"
}

link_dir database          database
link_dir logs              logs
link_dir backups           backups
link_dir data              data
link_dir auth_info_baileys auth_info_baileys

mkdir -p /app/public
rm -rf /app/public/uploads
ln -sfn "$STORAGE/uploads" /app/public/uploads

rm -f /app/settings.json
ln -sfn "$STORAGE/settings.json" /app/settings.json

echo "[entrypoint] storage dir: $STORAGE"
echo "[entrypoint] menjalankan: $*"
exec "$@"
