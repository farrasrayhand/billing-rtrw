/**
 * Service: Backup & Recovery System
 * Melakukan backup otomatis database dan settings
 */
const fs = require('fs');
const path = require('path');
const { logger } = require('../config/logger');
const { getSetting, getCurrentDateInTimezone, getNowLocalISO } = require('../config/settingsManager');

const projectRoot = path.join(__dirname, '..');
const backupDir = path.join(projectRoot, 'backups');
const dbPath = path.join(projectRoot, 'database', 'billing.db');
const settingsPath = require('../config/settingsManager').getSettingsPath();

const PENDING_RESTORE_FILE = path.join(projectRoot, 'database', 'pending_restore.db');
const REQUIRED_TABLES = ['customers', 'invoices', 'packages'];

/**
 * Nama file backup harus polos (tanpa path, tanpa traversal) dan berekstensi .db / .json.
 * Mengembalikan path absolut di dalam folder backup, atau null bila tidak valid.
 */
function resolveBackupPath(fileName) {
  const name = String(fileName || '');
  if (!name || name !== path.basename(name) || !/^[\w.\-]+\.(db|json)$/i.test(name) || name.includes('..')) return null;
  const full = path.join(backupDir, name);
  return path.dirname(full) === backupDir ? full : null;
}

// Pastikan file benar-benar database SQLite yang sehat dan berisi tabel inti billing.
function validateSqliteBackup(filePath) {
  const Database = require('better-sqlite3');
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(16);
  try { fs.readSync(fd, header, 0, 16, 0); } finally { fs.closeSync(fd); }
  if (header.toString('utf8', 0, 15) !== 'SQLite format 3') {
    throw new Error('File bukan database SQLite yang valid.');
  }
  let probe;
  try {
    probe = new Database(filePath, { readonly: true, fileMustExist: true });
    const check = probe.pragma('integrity_check', { simple: true });
    if (check !== 'ok') throw new Error(`Database backup rusak (integrity_check: ${check}).`);
    const tables = new Set(probe.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    const missing = REQUIRED_TABLES.filter((t) => !tables.has(t));
    if (missing.length) throw new Error(`Database backup tidak lengkap, tabel tidak ada: ${missing.join(', ')}.`);
  } finally {
    if (probe) probe.close();
  }
}

// Pastikan direktori backup ada
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
  logger.info('[Backup] Created backup directory');
}

/**
 * Generate timestamp untuk nama file backup
 */
function getBackupTimestamp() {
  const now = getCurrentDateInTimezone();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Backup database SQLite
 */
function backupDatabase() {
  try {
    const timestamp = getBackupTimestamp();
    const backupFileName = `billing_db_${timestamp}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Snapshot konsisten lewat SQLite (aman untuk mode WAL dan database yang sedang dipakai)
    const liveDb = require('../config/database');
    liveDb.exec(`VACUUM INTO '${backupFilePath.replace(/'/g, "''")}'`);

    // Compress backup (optional - bisa ditambahkan nanti)
    const stats = fs.statSync(backupFilePath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Database backup created: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO()
    };
  } catch (e) {
    logger.error(`[Backup] Failed to backup database: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Backup settings.json
 */
function backupSettings() {
  try {
    const timestamp = getBackupTimestamp();
    const backupFileName = `settings_${timestamp}.json`;
    const backupFilePath = path.join(backupDir, backupFileName);

    // Copy settings file
    fs.copyFileSync(settingsPath, backupFilePath);

    const stats = fs.statSync(backupFilePath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Settings backup created: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO()
    };
  } catch (e) {
    logger.error(`[Backup] Failed to backup settings: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Backup semua (database + settings)
 */
function backupAll() {
  const dbResult = backupDatabase();
  const settingsResult = backupSettings();

  return {
    database: dbResult,
    settings: settingsResult,
    timestamp: getNowLocalISO()
  };
}

/**
 * Restore database dari backup
 */
function restoreDatabase(backupFileName) {
  try {
    const backupFilePath = resolveBackupPath(backupFileName);
    if (!backupFilePath || !fs.existsSync(backupFilePath) || !/\.db$/i.test(backupFilePath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupFileName}`
      };
    }

    // Validasi isi file SEBELUM menyentuh apa pun
    validateSqliteBackup(backupFilePath);

    // Backup database saat ini sebelum restore
    const preRestoreBackup = backupDatabase();
    if (!preRestoreBackup.success) {
      logger.warn('[Backup] Failed to create pre-restore backup');
    }

    // Database yang sedang berjalan tidak aman ditimpa (mode WAL + koneksi terbuka).
    // Restore dijadwalkan dan diterapkan secara atomik saat aplikasi dijalankan ulang.
    const tmp = `${PENDING_RESTORE_FILE}.tmp`;
    fs.copyFileSync(backupFilePath, tmp);
    fs.renameSync(tmp, PENDING_RESTORE_FILE);

    logger.info(`[Backup] Restore database dijadwalkan dari: ${backupFileName}. Diterapkan saat aplikasi restart.`);

    return {
      success: true,
      pending: true,
      fileName: backupFileName,
      size: fs.statSync(PENDING_RESTORE_FILE).size,
      timestamp: getNowLocalISO(),
      preRestoreBackup: preRestoreBackup.fileName
    };
  } catch (e) {
    logger.error(`[Backup] Failed to restore database: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Restore settings dari backup
 */
function restoreSettings(backupFileName) {
  try {
    const backupFilePath = resolveBackupPath(backupFileName);
    if (!backupFilePath || !fs.existsSync(backupFilePath) || !/\.json$/i.test(backupFilePath)) {
      return {
        success: false,
        error: `Backup file not found: ${backupFileName}`
      };
    }

    // Harus JSON objek yang valid
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
    } catch (jsonErr) {
      return { success: false, error: `File settings bukan JSON yang valid: ${jsonErr.message}` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { success: false, error: 'File settings harus berupa objek JSON.' };
    }

    // Backup settings saat ini sebelum restore
    const preRestoreBackup = backupSettings();
    if (!preRestoreBackup.success) {
      logger.warn('[Backup] Failed to create pre-restore backup');
    }

    // Tulis atomik: file sementara lalu rename
    const tmp = `${settingsPath}.restore.tmp`;
    fs.copyFileSync(backupFilePath, tmp);
    fs.renameSync(tmp, settingsPath);

    const stats = fs.statSync(settingsPath);
    const sizeKB = Math.round(stats.size / 1024);

    logger.info(`[Backup] Settings restored from: ${backupFileName} (${sizeKB} KB)`);
    
    return {
      success: true,
      fileName: backupFileName,
      size: stats.size,
      timestamp: getNowLocalISO(),
      preRestoreBackup: preRestoreBackup.fileName
    };
  } catch (e) {
    logger.error(`[Backup] Failed to restore settings: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Daftar semua backup yang tersedia
 */
function listBackups() {
  try {
    const files = fs.readdirSync(backupDir);
    const backups = [];

    for (const file of files) {
      const filePath = path.join(backupDir, file);
      const stats = fs.statSync(filePath);
      
      // Parse filename untuk mendapatkan tanggal
      let backupDate = null;
      let backupType = null;
      
      if (file.startsWith('billing_db_') && file.endsWith('.db')) {
        backupType = 'database';
        const timestamp = file.replace('billing_db_', '').replace('.db', '');
        backupDate = parseBackupTimestamp(timestamp);
      } else if (file.startsWith('settings_') && file.endsWith('.json')) {
        backupType = 'settings';
        const timestamp = file.replace('settings_', '').replace('.json', '');
        backupDate = parseBackupTimestamp(timestamp);
      }

      backups.push({
        fileName: file,
        type: backupType,
        size: stats.size,
        sizeKB: Math.round(stats.size / 1024),
        created: stats.birthtime,
        createdDate: backupDate,
        modified: stats.mtime
      });
    }

    // Sort by created date (terbaru dulu)
    backups.sort((a, b) => b.created - a.created);

    return {
      success: true,
      backups: backups,
      total: backups.length
    };
  } catch (e) {
    logger.error(`[Backup] Failed to list backups: ${e.message}`);
    return {
      success: false,
      error: e.message,
      backups: []
    };
  }
}

/**
 * Parse timestamp dari nama file backup
 */
function parseBackupTimestamp(timestamp) {
  try {
    // Format: YYYYMMDD_HHMMSS
    const [datePart, timePart] = timestamp.split('_');
    const year = datePart.substring(0, 4);
    const month = datePart.substring(4, 6);
    const day = datePart.substring(6, 8);
    const hours = timePart.substring(0, 2);
    const minutes = timePart.substring(2, 4);
    const seconds = timePart.substring(4, 6);

    return new Date(year, month - 1, day, hours, minutes, seconds);
  } catch (e) {
    return null;
  }
}

/**
 * Hapus backup lama berdasarkan retention policy
 */
function cleanupOldBackups(retentionDays = 30) {
  try {
    const result = listBackups();
    if (!result.success) {
      return result;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    let deletedCount = 0;
    const deletedFiles = [];

    for (const backup of result.backups) {
      if (backup.created < cutoffDate) {
        const filePath = path.join(backupDir, backup.fileName);
        fs.unlinkSync(filePath);
        deletedCount++;
        deletedFiles.push(backup.fileName);
        logger.info(`[Backup] Deleted old backup: ${backup.fileName}`);
      }
    }

    return {
      success: true,
      deletedCount,
      deletedFiles,
      retentionDays
    };
  } catch (e) {
    logger.error(`[Backup] Failed to cleanup old backups: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Cek kapasitas backup dan hapus jika perlu
 */
function checkBackupCapacity(maxSizeMB = 500) {
  try {
    const result = listBackups();
    if (!result.success) {
      return result;
    }

    const totalSize = result.backups.reduce((sum, backup) => sum + backup.size, 0);
    let totalSizeMB = totalSize / (1024 * 1024);

    if (totalSizeMB > maxSizeMB) {
      logger.warn(`[Backup] Backup size (${totalSizeMB.toFixed(2)} MB) exceeds limit (${maxSizeMB} MB)`);
      
      // Hapus backup paling lama sampai kapasitas aman
      const sortedBackups = [...result.backups].sort((a, b) => a.created - b.created);
      let deletedCount = 0;
      
      for (const backup of sortedBackups) {
        if (totalSizeMB <= maxSizeMB * 0.8) { // Hapus sampai 80% dari limit
          break;
        }
        
        const filePath = path.join(backupDir, backup.fileName);
        fs.unlinkSync(filePath);
        totalSizeMB -= backup.size / (1024 * 1024);
        deletedCount++;
        logger.info(`[Backup] Deleted backup for capacity: ${backup.fileName}`);
      }

      return {
        success: true,
        action: 'cleanup',
        deletedCount,
        totalSizeMB: totalSizeMB.toFixed(2),
        maxSizeMB
      };
    }

    return {
      success: true,
      action: 'none',
      totalSizeMB: totalSizeMB.toFixed(2),
      maxSizeMB
    };
  } catch (e) {
    logger.error(`[Backup] Failed to check backup capacity: ${e.message}`);
    return {
      success: false,
      error: e.message
    };
  }
}

/**
 * Jadwal backup otomatis
 */
function scheduleAutoBackup() {
  const nodeCron = require('node-cron');
  const enabled = getSetting('auto_backup_enabled', true);
  const schedule = getSetting('auto_backup_schedule', '0 2 * * *'); // Default jam 2 pagi setiap hari

  if (!enabled) {
    logger.info('[Backup] Auto backup disabled');
    return;
  }

  nodeCron.schedule(schedule, () => {
    logger.info('[Backup] Starting scheduled backup...');
    const result = backupAll();
    
    if (result.database.success && result.settings.success) {
      logger.info('[Backup] Scheduled backup completed successfully');
    } else {
      logger.error('[Backup] Scheduled backup failed');
    }
  });

  logger.info(`[Backup] Auto backup scheduled: ${schedule}`);
}

module.exports = {
  resolveBackupPath,
  backupDatabase,
  backupSettings,
  backupAll,
  restoreDatabase,
  restoreSettings,
  listBackups,
  cleanupOldBackups,
  checkBackupCapacity,
  scheduleAutoBackup
};
