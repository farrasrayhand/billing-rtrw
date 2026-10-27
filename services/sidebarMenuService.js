const { getSetting } = require('../config/settingsManager');
const { getAppSetting, saveAppSetting } = require('../config/database');

const SETTINGS_KEY = 'sidebar_menu_states';
const STATE_VISIBLE = 'visible';
const STATE_HIDDEN = 'hidden';
const VALID_STATES = new Set([STATE_VISIBLE, STATE_HIDDEN]);

// Urutan array = urutan tampil di dalam section. Section ditampilkan mengikuti
// urutan SECTION_DEFINITIONS. Satu halaman ber-tab tidak boleh punya menu sendiri;
// cukup satu menu (hub) per area, sub-halaman diakses lewat tab.
const MENU_DEFINITIONS = [
  // ── UTAMA ──
  { key: 'dashboard', section: 'main', href: '/admin', icon: 'bi bi-speedometer2', labelKey: 'admin.nav.dashboard', labelDefault: 'Dashboard', roles: ['admin', 'cashier'], bottomNav: true, activePages: ['dashboard'] },
  { key: 'mikrotik', section: 'network', href: '/admin/mikrotik', icon: 'bi bi-router', labelKey: 'admin.nav.mikrotik', labelDefault: 'MikroTik', roles: ['admin'], bottomNav: true, activePages: ['mikrotik'] },
  { key: 'radius_server', section: 'network', href: '/admin/radius-settings', icon: 'bi bi-broadcast', labelKey: 'admin.nav.radius_server', labelDefault: 'RADIUS Server', roles: ['admin'], activePages: ['radius_settings'] },
  { key: 'map', section: 'main', href: '/admin/map', icon: 'bi bi-map', labelKey: 'admin.nav.network_map', labelDefault: 'Peta Jaringan', roles: ['admin'], activePages: ['map'] },
  { key: 'acs_pro', section: 'network', href: '/admin/acs', icon: 'bi bi-hdd-network', labelKey: 'admin.nav.acs_pro', labelDefault: 'GenieACS Pro', roles: ['admin'], activePages: ['acs_pro'] },
  { key: 'onu_provision', section: 'network', href: '/admin/onu-provision', icon: 'bi bi-diagram-3', labelKey: 'admin.nav.onu_provision', labelDefault: 'ONU Provision', roles: ['admin'], activePages: ['onu_provision'] },
  { key: 'olts', section: 'network', href: '/admin/olts', icon: 'bi bi-hdd-rack', labelKey: 'admin.nav.olt_management', labelDefault: 'Manajemen OLT', roles: ['admin'], activePages: ['olts'] },
  { key: 'whatsapp', section: 'comm', href: '/admin/whatsapp', icon: 'bi bi-whatsapp', labelKey: 'admin.nav.whatsapp', labelDefault: 'WhatsApp', cashierHref: '/admin/whatsapp/broadcast', roles: ['admin', 'cashier'], activePages: ['whatsapp'] },
  { key: 'telegram', section: 'comm', href: '/admin/telegram', icon: 'bi bi-telegram', labelKey: 'admin.nav.telegram', labelDefault: 'Telegram', roles: ['admin'], activePages: ['telegram'] },
  { key: 'ai', section: 'comm', href: '/admin/ai', icon: 'bi bi-robot', labelKey: 'admin.nav.ai', labelDefault: 'Asisten AI', roles: ['admin'], activePages: ['ai'] },

  // ── BILLING ──
  { key: 'customers', section: 'billing', href: '/admin/customers', icon: 'bi bi-people', labelKey: 'admin.nav.customers', labelDefault: 'Pelanggan', roles: ['admin', 'cashier'], bottomNav: true, activePages: ['customers'] },
  { key: 'packages', section: 'billing', href: '/admin/packages', icon: 'bi bi-box-seam', labelKey: 'admin.nav.internet_packages', labelDefault: 'Paket Internet', roles: ['admin'], activePages: ['packages'] },
  { key: 'billing', section: 'billing', href: '/admin/billing', icon: 'bi bi-receipt', labelKey: 'admin.nav.invoices', labelDefault: 'Tagihan', roles: ['admin', 'cashier'], bottomNav: true, activePages: ['billing'] },
  { key: 'digiflazz', section: 'billing', href: '/admin/digiflazz', icon: 'bi bi-phone', labelKey: 'admin.nav.digiflazz', labelDefault: 'Digiflazz', roles: ['admin'], activePages: ['digiflazz'] },
  { key: 'collector_payments', section: 'billing', href: '/admin/collector-payments', icon: 'bi bi-check2-square', labelKey: 'admin.nav.collector_payments', labelDefault: 'Approval Kolektor', roles: ['admin'], activePages: ['collector_payments'] },
  { key: 'promo_slides', section: 'billing', href: '/admin/promo-slides', icon: 'bi bi-image', labelKey: 'admin.nav.promo_slides', labelDefault: 'Promo Slides', roles: ['admin'], activePages: ['promo_slides'] },

  // ── KEUANGAN ── (hub: Laporan Keuangan → tab: Kas Masuk, Pengeluaran, Kategori, Laporan Kasir)
  { key: 'reports', section: 'finance', href: '/admin/reports', icon: 'bi bi-bar-chart-line', labelKey: 'admin.nav.finance_report', labelDefault: 'Laporan Keuangan', roles: ['admin'], activePages: ['reports'] },
  { key: 'payroll', section: 'finance', href: '/admin/payroll', icon: 'bi bi-cash-coin', labelKey: 'admin.nav.payroll', labelDefault: 'Gaji & Payroll', roles: ['admin'], activePages: ['payroll'] },

  // ── LAYANAN ──
  { key: 'tickets', section: 'service', href: '/admin/tickets', icon: 'bi bi-headset', labelKey: 'admin.nav.customer_tickets', labelDefault: 'Keluhan Pelanggan', roles: ['admin'], activePages: ['tickets'] },
  { key: 'inventory', section: 'service', href: '/admin/inventory', icon: 'bi bi-boxes', labelKey: 'admin.nav.inventory', labelDefault: 'Inventaris (Stok)', roles: ['admin'], activePages: ['inventory'] },
  { key: 'attendance', section: 'service', href: '/admin/attendance', icon: 'bi bi-calendar-check', labelKey: 'admin.nav.attendance', labelDefault: 'Absensi Karyawan', roles: ['admin'], activePages: ['attendance'] },

  // ── KASIR ──
  { key: 'cashier_attendance', section: 'cashier', href: '/admin/cashiers/attendance', icon: 'bi bi-person-check', labelKey: 'admin.nav.cashier_attendance', labelDefault: 'Absensi Saya', roles: ['cashier'], activePages: ['cashier_attendance'] },
  { key: 'cashier_reports', section: 'cashier', href: '/admin/cashiers/reports', icon: 'bi bi-receipt', labelKey: 'admin.nav.cashier_reports', labelDefault: 'Laporan Saya', roles: ['cashier'], activePages: ['cashier_reports'] },

  // ── MANAJEMEN USER ──
  { key: 'areas', section: 'user_management', href: '/admin/areas', icon: 'bi bi-geo-alt', labelKey: 'admin.nav.areas', labelDefault: 'Manajemen Area', roles: ['admin'], activePages: ['areas'] },
  // Hub Staf: Teknisi → tab Kasir, Kolektor (cashiers & collectors tidak tampil sebagai menu sendiri)
  { key: 'technicians', section: 'user_management', href: '/admin/technicians', icon: 'bi bi-people-fill', labelKey: 'admin.nav.staff', labelDefault: 'Staf & Tim', roles: ['admin'], activePages: ['technicians', 'cashiers', 'collectors'] },
  { key: 'cashiers', section: 'user_management', href: '/admin/cashiers', icon: 'bi bi-person-vcard', labelKey: 'admin.nav.cashiers', labelDefault: 'Kasir', roles: ['admin'], activePages: ['cashiers'], navHidden: true },
  { key: 'collectors', section: 'user_management', href: '/admin/collectors', icon: 'bi bi-person-badge', labelKey: 'admin.nav.collectors', labelDefault: 'Kolektor', roles: ['admin'], activePages: ['collectors'], navHidden: true },
  // Hub Agent: Agent → tab Laporan Agent
  { key: 'agents', section: 'user_management', href: '/admin/agents', icon: 'bi bi-shop', labelKey: 'admin.nav.agents', labelDefault: 'Agent', roles: ['admin'], activePages: ['agents', 'agents_reports'] },
  { key: 'agents_reports', section: 'user_management', href: '/admin/agents/reports', icon: 'bi bi-journal-text', labelKey: 'admin.nav.agent_reports', labelDefault: 'Laporan Agent', roles: ['admin'], activePages: ['agents_reports'], navHidden: true },

  // ── SISTEM ──
  { key: 'update', section: 'system', href: '/admin/update', icon: 'bi bi-cloud-arrow-down', labelKey: 'admin.nav.update', labelDefault: 'Update GitHub', roles: ['admin'], activePages: ['update'] },
  { key: 'settings', section: 'system', href: '/admin/settings', icon: 'bi bi-gear', labelKey: 'admin.nav.settings', labelDefault: 'Pengaturan', roles: ['admin'], activePages: ['settings'] },
  { key: 'ewallet_logs', section: 'system', href: '/admin/ewallet-logs', icon: 'bi bi-receipt-cutoff', labelKey: 'admin.settings.ewallet_logs.title', labelDefault: 'Log Notifikasi E-Wallet', roles: ['admin'], activePages: ['ewallet_logs'] },
  { key: 'backup', section: 'system', href: '/admin/backup', icon: 'bi bi-hdd-stack', labelKey: 'admin.nav.backup', labelDefault: 'Backup & Recovery', roles: ['admin'], activePages: ['backup'] },
  { key: 'monitoring', section: 'system', href: '/admin/monitoring', icon: 'bi bi-activity', labelKey: 'admin.nav.monitoring', labelDefault: 'Monitoring Sistem', roles: ['admin'], activePages: ['monitoring'] },
  { key: 'audit_logs', section: 'system', href: '/admin/audit-logs', icon: 'bi bi-shield-lock', labelKey: 'admin.nav.audit_logs', labelDefault: 'Log Aktivitas', roles: ['admin'], activePages: ['audit_logs'] }
];

const DEFAULT_MENU_STATES = {
  dashboard: STATE_VISIBLE,
  mikrotik: STATE_VISIBLE,
  radius_server: STATE_VISIBLE,
  map: STATE_VISIBLE,
  acs_pro: STATE_VISIBLE,
  onu_provision: STATE_VISIBLE,
  olts: STATE_HIDDEN,
  whatsapp: STATE_VISIBLE,
  telegram: STATE_VISIBLE,
  ai: STATE_VISIBLE,
  customers: STATE_VISIBLE,
  packages: STATE_VISIBLE,
  billing: STATE_VISIBLE,
  digiflazz: STATE_VISIBLE,
  collector_payments: STATE_VISIBLE,
  promo_slides: STATE_VISIBLE,
  reports: STATE_VISIBLE,
  payroll: STATE_VISIBLE,
  tickets: STATE_VISIBLE,
  inventory: STATE_VISIBLE,
  attendance: STATE_VISIBLE,
  cashier_attendance: STATE_VISIBLE,
  cashier_reports: STATE_VISIBLE,
  technicians: STATE_VISIBLE,
  cashiers: STATE_VISIBLE,
  collectors: STATE_VISIBLE,
  areas: STATE_VISIBLE,
  agents: STATE_VISIBLE,
  agents_reports: STATE_VISIBLE,
  update: STATE_VISIBLE,
  settings: STATE_VISIBLE,
  ewallet_logs: STATE_VISIBLE,
  backup: STATE_VISIBLE,
  monitoring: STATE_VISIBLE,
  audit_logs: STATE_VISIBLE
};

const SECTION_DEFINITIONS = [
  { key: 'main', labelKey: 'admin.section.main', labelDefault: 'UTAMA' },
  { key: 'network', labelKey: 'admin.section.network', labelDefault: 'JARINGAN' },
  { key: 'comm', labelKey: 'admin.section.comm', labelDefault: 'KOMUNIKASI' },
  { key: 'billing', labelKey: 'admin.section.billing', labelDefault: 'BILLING' },
  { key: 'finance', labelKey: 'admin.section.finance', labelDefault: 'KEUANGAN' },
  { key: 'service', labelKey: 'admin.section.service', labelDefault: 'LAYANAN' },
  { key: 'cashier', labelKey: 'admin.section.cashier', labelDefault: 'KASIR' },
  { key: 'user_management', labelKey: 'admin.section.user_management', labelDefault: 'MANAJEMEN USER' },
  { key: 'system', labelKey: 'admin.section.system', labelDefault: 'SISTEM' }
];

function normalizeState(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return VALID_STATES.has(normalized) ? normalized : STATE_VISIBLE;
}

function getStoredMenuStates() {
  // Coba ambil dari Database dulu (Lebih Aman)
  let raw = getAppSetting(SETTINGS_KEY, null);

  // Fallback ke settings.json jika di DB masih kosong (Migration)
  if (raw === null) {
    raw = getSetting(SETTINGS_KEY, {});
    // Langsung migrasi ke DB agar kedepannya pakai DB
    if (Object.keys(raw).length > 0) {
      saveAppSetting(SETTINGS_KEY, raw);
    }
  }

  const stateMap = {};

  for (const menu of MENU_DEFINITIONS) {
    const defaultState = DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
    const storedState = raw && raw[menu.key] ? raw[menu.key] : defaultState;
    stateMap[menu.key] = normalizeState(storedState);
  }
  return stateMap;
}

function saveMenuStates(stateMap) {
  // Simpan ke Database (Utama)
  saveAppSetting(SETTINGS_KEY, sanitizeMenuStates(stateMap));

  // Hanya gunakan database, tidak perlu backup ke settings.json
  return true;
}

function sanitizeMenuStates(input) {
  const clean = {};
  for (const menu of MENU_DEFINITIONS) {
    const defaultState = DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
    let state = input && input[menu.key] ? input[menu.key] : defaultState;
    
    clean[menu.key] = normalizeState(state);
  }
  return clean;
}

function isMenuAllowedForSession(menu, session) {
  const roles = Array.isArray(menu.roles) ? menu.roles : ['admin'];
  if (roles.includes('admin') && session && session.isAdmin) return true;
  if (roles.includes('cashier') && session && session.isCashier) return true;
  return false;
}

function enrichMenu(menu, states, session) {
  const state = states[menu.key] || DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
  const hidden = state === STATE_HIDDEN;
  const asCashier = Boolean(session && session.isCashier && !session.isAdmin);
  return {
    ...menu,
    state,
    hidden,
    hrefResolved: (asCashier && menu.cashierHref) ? menu.cashierHref : menu.href
  };
}

function getSidebarSections(session) {
  const states = getStoredMenuStates();
  return SECTION_DEFINITIONS.map((section) => {
    const items = MENU_DEFINITIONS
      .filter((menu) => menu.section === section.key)
      .filter((menu) => !menu.navHidden)
      .filter((menu) => isMenuAllowedForSession(menu, session))
      .map((menu) => enrichMenu(menu, states, session))
      .filter((menu) => !menu.hidden);

    return {
      ...section,
      items
    };
  }).filter((section) => section.items.length > 0);
}

function getBottomNavItems(session) {
  const states = getStoredMenuStates();
  return MENU_DEFINITIONS
    .filter((menu) => menu.bottomNav)
    .filter((menu) => isMenuAllowedForSession(menu, session))
    .map((menu) => enrichMenu(menu, states, session))
    .filter((menu) => !menu.hidden);
}

function getConfigMenus() {
  const states = getStoredMenuStates();
  return MENU_DEFINITIONS.filter((menu) => !menu.navHidden).map((menu) => {
    const section = SECTION_DEFINITIONS.find((s) => s.key === menu.section);
    return {
      ...menu,
      state: states[menu.key] || DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE,
      roleLabel: menu.roles.includes('admin') && menu.roles.includes('cashier')
        ? 'Admin & Kasir'
        : menu.roles.includes('cashier')
          ? 'Kasir'
          : 'Admin',
      sectionLabel: section?.labelDefault || menu.section,
      sectionLabelKey: section?.labelKey || ''
    };
  });
}

function getMenuDefinition(key) {
  return MENU_DEFINITIONS.find((menu) => menu.key === key) || null;
}

function evaluateMenuAccess(menuKey, session) {
  const menu = getMenuDefinition(menuKey);
  if (!menu) {
    return { allowed: true, state: STATE_VISIBLE, menu: null };
  }

  if (!isMenuAllowedForSession(menu, session)) {
    return { allowed: false, state: 'forbidden', menu, reason: 'forbidden' };
  }

  const states = getStoredMenuStates();
  const state = states[menu.key] || DEFAULT_MENU_STATES[menu.key] || STATE_VISIBLE;
  if (state === STATE_HIDDEN) {
    return { allowed: false, state, menu, reason: 'hidden' };
  }
  return { allowed: true, state, menu, reason: null };
}

module.exports = {
  STATE_VISIBLE,
  STATE_HIDDEN,
  MENU_DEFINITIONS,
  getSidebarSections,
  getBottomNavItems,
  getConfigMenus,
  getMenuDefinition,
  getStoredMenuStates,
  sanitizeMenuStates,
  saveMenuStates,
  evaluateMenuAccess,
};
