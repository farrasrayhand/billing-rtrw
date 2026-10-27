const { getSetting } = require('./settingsManager');

// Fitur voucher/hotspot bisa dimatikan untuk RT/RW yang tidak memakai hotspot. Default: aktif.
function isHotspotEnabled() {
  const v = getSetting('hotspot_enabled', true);
  if (typeof v === 'string') return !['false', '0', 'off', 'no', 'nonaktif'].includes(v.trim().toLowerCase());
  return v !== false && v !== 0 && v !== null;
}

// Middleware: tolak akses ke fitur hotspot/voucher saat dinonaktifkan.
function requireHotspotEnabled(req, res, next) {
  if (isHotspotEnabled()) return next();
  const wantsJson = req.originalUrl.split('?')[0].includes('/api/') || req.xhr || /json/.test(req.get('accept') || '') || req.method !== 'GET';
  if (wantsJson) {
    return res.status(404).json({ success: false, ok: false, disabled: true, error: 'Fitur voucher/hotspot sedang dinonaktifkan.' });
  }
  if (req.session) req.session._msg = { type: 'error', text: 'Fitur voucher/hotspot sedang dinonaktifkan.' };
  if (req.originalUrl.startsWith('/admin')) return res.redirect('/admin');
  if (req.originalUrl.startsWith('/agent')) return res.redirect('/agent');
  return res.redirect('/customer/login');
}

// Digiflazz (pulsa/PPOB) dimatikan secara default. Data lama tidak dihapus; semua pintu masuknya
// (menu admin, portal agen/pelanggan, bot, webhook) ditutup selama saklar `digiflazz_enabled` tidak aktif.
function isDigiflazzEnabled() {
  const v = getSetting('digiflazz_enabled', false);
  if (typeof v === 'string') return ['true', '1', 'on', 'yes', 'aktif'].includes(v.trim().toLowerCase());
  return v === true || v === 1;
}

function requireDigiflazzEnabled(req, res, next) {
  if (isDigiflazzEnabled()) return next();
  const wantsJson = req.originalUrl.split('?')[0].includes('/api/') || req.xhr || /json/.test(req.get('accept') || '') || req.method !== 'GET';
  if (wantsJson) {
    return res.status(404).json({ success: false, ok: false, disabled: true, error: 'Fitur pulsa/PPOB tidak tersedia.' });
  }
  if (req.session) req.session._msg = { type: 'error', text: 'Fitur pulsa/PPOB tidak tersedia.' };
  if (req.originalUrl.startsWith('/admin')) return res.redirect('/admin');
  if (req.originalUrl.startsWith('/agent')) return res.redirect('/agent');
  return res.redirect('/customer');
}

module.exports = { isHotspotEnabled, requireHotspotEnabled, isDigiflazzEnabled, requireDigiflazzEnabled };
