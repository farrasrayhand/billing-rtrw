const session = require('express-session');

// Session store berbasis SQLite (better-sqlite3): sesi bertahan saat restart dan
// tidak menumpuk di memori seperti MemoryStore bawaan express-session.
class SqliteSessionStore extends session.Store {
  constructor(db, { ttlMs = 24 * 60 * 60 * 1000, cleanupMs = 15 * 60 * 1000 } = {}) {
    super();
    this.db = db;
    this.ttlMs = ttlMs;
    db.exec(`CREATE TABLE IF NOT EXISTS http_sessions (
      sid TEXT PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    )`);
    db.exec('CREATE INDEX IF NOT EXISTS idx_http_sessions_expire ON http_sessions(expire)');
    this.stmtGet = db.prepare('SELECT sess FROM http_sessions WHERE sid = ? AND expire > ?');
    this.stmtSet = db.prepare('INSERT INTO http_sessions (sid, sess, expire) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expire = excluded.expire');
    this.stmtDel = db.prepare('DELETE FROM http_sessions WHERE sid = ?');
    this.stmtTouch = db.prepare('UPDATE http_sessions SET expire = ? WHERE sid = ?');
    this.stmtClean = db.prepare('DELETE FROM http_sessions WHERE expire <= ?');
    this.cleanup();
    this.timer = setInterval(() => this.cleanup(), cleanupMs);
    if (this.timer.unref) this.timer.unref();
  }

  expireAt(sess) {
    const exp = sess && sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : NaN;
    return Number.isFinite(exp) ? exp : Date.now() + this.ttlMs;
  }

  cleanup() {
    try { this.stmtClean.run(Date.now()); } catch (e) { /* abaikan */ }
  }

  get(sid, cb) {
    try {
      const row = this.stmtGet.get(sid, Date.now());
      cb(null, row ? JSON.parse(row.sess) : null);
    } catch (e) { cb(e); }
  }

  set(sid, sess, cb) {
    try {
      this.stmtSet.run(sid, JSON.stringify(sess), this.expireAt(sess));
      if (cb) cb(null);
    } catch (e) { if (cb) cb(e); }
  }

  destroy(sid, cb) {
    try {
      this.stmtDel.run(sid);
      if (cb) cb(null);
    } catch (e) { if (cb) cb(e); }
  }

  touch(sid, sess, cb) {
    try {
      this.stmtTouch.run(this.expireAt(sess), sid);
      if (cb) cb(null);
    } catch (e) { if (cb) cb(e); }
  }
}

module.exports = SqliteSessionStore;
