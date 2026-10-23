const crypto = require('crypto');
const db = require('../config/database');
const { logger } = require('../config/logger');
const { getSetting, saveSettings } = require('../config/settingsManager');
const { hashPassword, isHashed } = require('../utils/passwordHash');

const PLACEHOLDER_SESSION_SECRETS = new Set([
  '', 'rahasia-portal-pelanggan-default-ganti-ini', 'change-this-to-random-secret-key'
]);

// Hash password plaintext lama milik staf (teknisi, kasir, kolektor, agent).
function migratePlaintextPasswords() {
  for (const table of ['technicians', 'cashiers', 'collectors', 'agents']) {
    try {
      const rows = db.prepare(`SELECT id, password FROM ${table}`).all().filter((r) => r.password && !isHashed(r.password));
      if (!rows.length) continue;
      const upd = db.prepare(`UPDATE ${table} SET password = ? WHERE id = ?`);
      db.transaction(() => rows.forEach((r) => upd.run(hashPassword(r.password), r.id)))();
      logger.info(`[SECURITY] ${rows.length} password di tabel ${table} dimigrasi ke hash.`);
    } catch (e) {
      logger.error(`[SECURITY] Gagal migrasi password ${table}: ${e.message}`);
    }
  }
}

function hardenSettings() {
  const updates = {};
  if (PLACEHOLDER_SESSION_SECRETS.has(String(getSetting('session_secret', '')))) {
    updates.session_secret = crypto.randomBytes(32).toString('hex');
    logger.info('[SECURITY] session_secret default diganti dengan nilai acak.');
  }
  const adminPass = getSetting('admin_password', '');
  if (adminPass && !isHashed(adminPass)) {
    if (adminPass === 'admin123') logger.warn('[SECURITY] Password admin masih "admin123". Segera ganti lewat menu Pengaturan.');
    updates.admin_password = hashPassword(adminPass);
    logger.info('[SECURITY] admin_password di settings.json di-hash.');
  }
  if (Object.keys(updates).length) saveSettings(updates);
}

function run() {
  migratePlaintextPasswords();
  hardenSettings();
}

module.exports = { run, migratePlaintextPasswords, hardenSettings };
