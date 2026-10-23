let loginRateLimiter = (req, res, next) => next();

try {
  const rateLimit = require('express-rate-limit');
  loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    handler: (req, res) => {
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
        return res.status(429).json({
          ok: false,
          error: 'Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit.'
        });
      }
      return res.status(429).send(`
        <!DOCTYPE html>
        <html lang="id">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Akses Dibatasi | Keamanan Portal</title>
          <style>
            body { display:flex; align-items:center; justify-content:center; min-height:100vh; background:#0f172a; color:#f8fafc; font-family:system-ui, -apple-system, sans-serif; margin:0; }
            .card-limit { background:#1e293b; padding:32px; border-radius:12px; border:1px solid #334155; text-align:center; max-width:420px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
            .card-limit h3 { color:#ef4444; margin-top:0; margin-bottom:12px; font-size:20px; }
            .card-limit p { color:#94a3b8; font-size:14px; line-height:1.5; margin-bottom:24px; }
            .btn-back { display:inline-block; padding:10px 20px; background:#3b82f6; color:#fff; text-decoration:none; border-radius:8px; font-size:14px; font-weight:600; }
            .btn-back:hover { background:#2563eb; }
          </style>
        </head>
        <body>
          <div class="card-limit">
            <h3>🚫 Terlalu Banyak Percobaan Login</h3>
            <p>Sistem keamanan mendeteksi terlalu banyak percobaan login dari IP/perangkat Anda. Untuk mencegah akses tanpa izin, login dibatasi sementara selama 15 menit.</p>
            <a href="javascript:history.back()" class="btn-back">Kembali ke Halaman Login</a>
          </div>
        </body>
        </html>
      `);
    }
  });
} catch (e) {
  // express-rate-limit missing fallback
  loginRateLimiter = (req, res, next) => next();
}

// Batasi pencarian pelanggan publik di /isolated (?q=) agar nomor/ID tidak bisa ditebak massal.
let lookupLimiter = null;
try {
  const rateLimit = require('express-rate-limit');
  lookupLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    handler: (req, res) => res.status(429).json({ success: false, status: 'error', message: 'Terlalu banyak pencarian. Coba lagi beberapa menit lagi.' })
  });
} catch (e) {
  lookupLimiter = null;
}

// Hanya request yang membawa kata kunci pencarian yang dihitung.
function lookupRateLimiter(req, res, next) {
  const hasQuery = !!String(req.query.q || req.query.lookup || req.query.cid || req.query.phone || '').trim();
  if (!hasQuery || !lookupLimiter) return next();
  return lookupLimiter(req, res, next);
}

module.exports = {
  loginRateLimiter,
  lookupRateLimiter
};
