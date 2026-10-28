/**
 * Lokasi data runtime aplikasi + apakah aman dari deploy (git reset --hard).
 * Dipakai halaman Backup & Recovery supaya terlihat jelas di mana pengaturan/database disimpan.
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function git(args) {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 3000 });
}

// 'tracked' (ditimpa deploy) | 'ignored' | 'untracked' | 'outside' (di luar folder aplikasi) | 'no-git' | 'unknown'
function gitState(absPath) {
  try {
    const rel = path.relative(root, absPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return 'outside';
    const inside = git(['rev-parse', '--is-inside-work-tree']);
    if (inside.error || inside.status !== 0) return 'no-git';
    if (git(['ls-files', '--error-unmatch', '--', rel]).status === 0) return 'tracked';
    return git(['check-ignore', '-q', '--', rel]).status === 0 ? 'ignored' : 'untracked';
  } catch (e) {
    return 'unknown';
  }
}

function describe(label, absPath) {
  let exists = false;
  let mtime = null;
  let writable = false;
  try {
    const st = fs.statSync(absPath);
    exists = true;
    mtime = st.mtime.toISOString();
  } catch (e) {}
  try { fs.accessSync(exists ? absPath : path.dirname(absPath), fs.constants.W_OK); writable = true; } catch (e) {}
  const state = gitState(absPath);
  const safe = state === 'ignored' || state === 'untracked' || state === 'outside';
  return { label, path: absPath, exists, mtime, writable, state, safe };
}

function getDataLocations(extra = {}) {
  const { getSettingsPath, getSetting } = require('../config/settingsManager');
  const waFolder = String(getSetting('whatsapp_auth_folder', 'auth_info_baileys') || 'auth_info_baileys');
  return [
    describe('Pengaturan panel', getSettingsPath()),
    describe('Database', path.join(root, 'database', 'billing.db')),
    describe('Sesi WhatsApp', path.isAbsolute(waFolder) ? waFolder : path.join(root, waFolder)),
    describe('Unggahan (logo, bukti bayar)', path.join(root, 'public', 'uploads')),
    describe('Backup', path.join(root, 'backups')),
    ...(extra.more || [])
  ];
}

module.exports = { getDataLocations, gitState };
