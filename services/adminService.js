const db = require('../config/database');
const { hashPassword, verifyPassword, isHashed } = require('../utils/passwordHash');

// Password tidak pernah dikirim ke view; kosong saat update berarti tidak diubah.
function withoutPassword(rows) {
  return rows.map(({ password, ...rest }) => rest);
}

function nextPassword(table, id, plain) {
  if (plain !== undefined && plain !== null && String(plain) !== '') return hashPassword(plain);
  const row = db.prepare(`SELECT password FROM ${table} WHERE id = ?`).get(id);
  return row ? row.password : hashPassword(plain || '');
}

function authenticateFrom(table, username, password) {
  const row = db.prepare(`SELECT * FROM ${table} WHERE username = ? AND is_active = 1`).get(username);
  if (!row || !verifyPassword(password, row.password)) return undefined;
  if (!isHashed(row.password)) {
    db.prepare(`UPDATE ${table} SET password = ? WHERE id = ?`).run(hashPassword(password), row.id);
  }
  return row;
}

/**
 * TECHNICIANS
 */
function getAllTechnicians() {
  return withoutPassword(db.prepare('SELECT * FROM technicians ORDER BY created_at DESC').all());
}

function createTechnician(data) {
  const stmt = db.prepare('INSERT INTO technicians (username, password, name, phone, area) VALUES (?, ?, ?, ?, ?)');
  return stmt.run(data.username, hashPassword(data.password), data.name, data.phone || '', data.area || '');
}

function parseBoolInt(val, defaultVal = 0) {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (val === true || val === 1 || val === '1' || val === 'true' || val === 'on' || val === 'yes') return 1;
  if (val === false || val === 0 || val === '0' || val === 'false' || val === 'off' || val === 'no') return 0;
  return Boolean(val) ? 1 : 0;
}

function updateTechnician(id, data) {
  const stmt = db.prepare('UPDATE technicians SET username = ?, password = ?, name = ?, phone = ?, area = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, nextPassword('technicians', id, data.password), data.name, data.phone || '', data.area || '', parseBoolInt(data.is_active, 1), id);
}

function deleteTechnician(id) {
  return db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
}

/**
 * CASHIERS
 */
function getAllCashiers() {
  return withoutPassword(db.prepare('SELECT * FROM cashiers ORDER BY created_at DESC').all());
}

function createCashier(data) {
  const stmt = db.prepare('INSERT INTO cashiers (username, password, name, phone) VALUES (?, ?, ?, ?)');
  return stmt.run(data.username, hashPassword(data.password), data.name, data.phone || '');
}

function updateCashier(id, data) {
  const stmt = db.prepare('UPDATE cashiers SET username = ?, password = ?, name = ?, phone = ?, is_active = ? WHERE id = ?');
  return stmt.run(data.username, nextPassword('cashiers', id, data.password), data.name, data.phone || '', parseBoolInt(data.is_active, 1), id);
}

function deleteCashier(id) {
  return db.prepare('DELETE FROM cashiers WHERE id = ?').run(id);
}

function authenticateCashier(username, password) {
  return authenticateFrom('cashiers', username, password);
}

function getAllCollectors() {
  return withoutPassword(db.prepare('SELECT * FROM collectors ORDER BY created_at DESC').all());
}

function createCollector(data) {
  return db
    .prepare(
      'INSERT INTO collectors (username, password, name, phone, area, is_active, auto_approve) VALUES (?, ?, ?, ?, ?, 1, ?)'
    )
    .run(
      String(data.username || '').trim(),
      hashPassword(data.password || ''),
      String(data.name || '').trim(),
      String(data.phone || '').trim(),
      String(data.area || '').trim(),
      parseBoolInt(data.auto_approve, 0)
    );
}

function updateCollector(id, data) {
  const stmt = db.prepare('UPDATE collectors SET username = ?, password = ?, name = ?, phone = ?, area = ?, is_active = ?, auto_approve = ? WHERE id = ?');
  return stmt.run(
    String(data.username || '').trim(),
    nextPassword('collectors', id, data.password),
    String(data.name || '').trim(),
    String(data.phone || '').trim(),
    String(data.area || '').trim(),
    parseBoolInt(data.is_active, 1),
    parseBoolInt(data.auto_approve, 0),
    id
  );
}

function deleteCollector(id) {
  return db.prepare('DELETE FROM collectors WHERE id = ?').run(id);
}

function authenticateCollector(username, password) {
  return authenticateFrom('collectors', username, password);
}

module.exports = {
  authenticateFrom,
  getAllTechnicians,
  createTechnician,
  updateTechnician,
  deleteTechnician,
  getAllCashiers,
  createCashier,
  updateCashier,
  deleteCashier,
  authenticateCashier,
  getAllCollectors,
  createCollector,
  updateCollector,
  deleteCollector,
  authenticateCollector
};
