const db = require('../config/database');
const { logger } = require('../config/logger');

function normalizeIp(raw) {
  return String(raw || '').replace(/^::ffff:/, '').trim();
}

function isPrivateIp(ip) {
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

/**
 * Cari pelanggan dari IP klien. Hanya memakai IP yang sudah divalidasi Express (req.ip dengan
 * trust proxy), bukan header X-Forwarded-For mentah dari klien.
 * Urutan: kolom static/remote address di DB -> akunting RADIUS aktif -> sesi PPPoE aktif di router.
 */
async function findCustomerByClientIp(rawIp, customerSvc) {
  const ip = normalizeIp(rawIp);
  if (!ip) return null;

  const direct = db.prepare(
    'SELECT * FROM customers WHERE static_ip = ? OR pppoe_remote_address = ? LIMIT 1'
  ).get(ip, ip);
  if (direct) return customerSvc.getCustomerById(direct.id) || direct;

  try {
    const acct = db.prepare(
      'SELECT username FROM radius_accounting WHERE framed_ip = ? AND status_type IN (1, 3) ORDER BY id DESC LIMIT 1'
    ).get(ip);
    if (acct && acct.username) {
      const c = customerSvc.findCustomerByAny(acct.username);
      if (c) return c;
    }
  } catch (e) {
    logger.warn(`[ISOLATED] Lookup akunting RADIUS gagal: ${e.message}`);
  }

  // IP publik berarti trafik sudah di-NAT (server tidak bisa tahu pelanggan aslinya): jangan buang waktu ke router.
  if (!isPrivateIp(ip)) return null;

  try {
    const mikrotikService = require('./mikrotikService');
    const routers = (mikrotikService.getAllRouters() || []).filter((r) => r.is_active !== 0);
    const ids = routers.length ? routers.map((r) => r.id) : [null];
    const results = await Promise.all(
      ids.map((rid) => withTimeout(mikrotikService.getPppoeActive(rid).catch(() => []), 2500))
    );
    for (const list of results) {
      const match = Array.isArray(list) ? list.find((u) => u && u.address === ip) : null;
      if (match && match.name) {
        const c = customerSvc.findCustomerByAny(match.name);
        if (c) return c;
      }
    }
  } catch (e) {
    logger.warn(`[ISOLATED] Lookup sesi aktif gagal: ${e.message}`);
  }
  return null;
}

function maskPhone(v) {
  const s = String(v || '').replace(/\s+/g, '');
  if (s.length <= 6) return s ? s.slice(0, 1) + '***' : '';
  return `${s.slice(0, 4)}****${s.slice(-3)}`;
}

function maskName(v) {
  return String(v || '').split(/\s+/).filter(Boolean)
    .map((w) => (w.length <= 1 ? w : `${w.slice(0, 1)}${'*'.repeat(Math.min(w.length - 1, 4))}`))
    .join(' ');
}

function maskId(v) {
  const s = String(v || '');
  if (s.length <= 3) return s ? s.slice(0, 1) + '**' : '';
  return `${s.slice(0, 2)}${'*'.repeat(Math.min(s.length - 3, 5))}${s.slice(-1)}`;
}

// Dipakai bila pelanggan ditemukan hanya dari kolom pencarian (siapa pun bisa mengetik nomor orang lain).
function maskCustomerForPublic(c) {
  if (!c) return c;
  return {
    ...c,
    name: maskName(c.name),
    phone: maskPhone(c.phone),
    pppoe_username: c.pppoe_username ? maskId(c.pppoe_username) : c.pppoe_username,
    address: undefined,
    email: undefined
  };
}

module.exports = { findCustomerByClientIp, maskCustomerForPublic, normalizeIp, isPrivateIp };
