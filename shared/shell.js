/**
 * shared/shell.js
 * Render sidebar + topbar yang konsisten di semua modul (gaya Tailwind/M3).
 * Pemakaian:
 *   <div id="app-shell"></div>
 *   <script>renderShell({ activeId: 'peta-tower', pageTitle: 'Peta & Tower', rootPrefix: '../../' })</script>
 *
 * rootPrefix = jarak relatif dari halaman saat ini ke root proyek.
 *   - halaman di root (index.html)            → rootPrefix: ''
 *   - halaman di features/[modul]/index.html  → rootPrefix: '../../'
 */

const NAV_ITEMS = [
  { id: 'beranda', label: 'Dashboard', icon: 'dashboard', path: 'index.html', ready: true },
  { id: 'peta-tower', label: 'Peta & Tower', icon: 'map', path: 'features/peta-tower/index.html', ready: true },
  { id: 'profil-gi', label: 'Profil GI', icon: 'badge', path: 'features/profil-gi/index.html', ready: false },
  { id: 'file-manager', label: 'File WP/BA/Peralatan', icon: 'folder_open', path: '#', ready: false },
  { id: 'kondisi-peralatan', label: 'Kondisi Peralatan', icon: 'precision_manufacturing', path: '#', ready: false },
  { id: 'anomali', label: 'Anomali', icon: 'warning', path: '#', ready: false }
];

function renderShell({ activeId, pageTitle, rootPrefix = '', searchPlaceholder = 'Cari...' }) {
  const el = document.getElementById('app-shell');
  if (!el) return;

  const navLinks = NAV_ITEMS.map((item) => {
    const isActive = item.id === activeId;
    const disabled = !item.ready && !isActive;
    const href = disabled ? '#' : (rootPrefix + item.path);
    const activeClasses = isActive ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-high';
    const disabledAttr = disabled ? 'aria-disabled="true" title="Segera hadir" onclick="return false;"' : '';
    return `
      <a href="${href}" class="flex items-center gap-3 px-3 py-3 rounded transition-all ${activeClasses} ${disabled ? 'opacity-40 cursor-default' : ''}" ${disabledAttr}>
        <span class="material-symbols-outlined">${item.icon}</span>
        <span class="font-body text-sm font-medium">${item.label}</span>
      </a>`;
  }).join('');

  el.innerHTML = `
    <aside class="w-64 bg-surface-container-low flex flex-col border-r border-outline-variant/20 shrink-0">
      <div class="p-6 flex flex-col gap-1">
        <h1 class="text-primary font-headline font-extrabold text-xl tracking-tight">PLN GI Suite</h1>
        <p class="text-on-surface-variant font-body text-xs uppercase tracking-widest">GI Situbondo</p>
      </div>
      <nav class="mt-4 flex-grow px-3 space-y-1">${navLinks}</nav>
      <div class="p-4 border-t border-outline-variant/20 flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold">W</div>
        <div class="flex flex-col">
          <span class="text-sm font-bold text-on-surface">Wisnu</span>
          <span class="text-[10px] text-on-surface-variant">Teknisi GI</span>
        </div>
      </div>
    </aside>

    <div class="flex-grow flex flex-col overflow-hidden">
      <header class="h-16 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center justify-between px-8 z-10 shrink-0">
        <div class="flex items-center gap-8 flex-grow">
          <span class="font-headline font-bold text-lg text-primary">${pageTitle}</span>
          <div class="relative w-96">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
            <input class="w-full bg-surface-container-low border-none rounded py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary placeholder:text-outline/60" placeholder="${searchPlaceholder}" type="text">
          </div>
        </div>
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-4">
            <button class="relative p-1 text-on-surface-variant hover:text-primary transition-colors">
              <span class="material-symbols-outlined">notifications</span>
            </button>
            <button class="p-1 text-on-surface-variant hover:text-primary transition-colors" id="conn-indicator" title="Memeriksa koneksi...">
              <span class="material-symbols-outlined">cloud_sync</span>
            </button>
          </div>
          <div class="h-8 w-px bg-outline-variant/30"></div>
          <div class="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center text-xs font-bold text-on-surface-variant">W</div>
        </div>
      </header>
      <div id="page-content" class="flex-grow flex flex-col overflow-y-auto"></div>
    </div>
  `;

  checkShellConnection();
}

async function checkShellConnection() {
  const btn = document.getElementById('conn-indicator');
  if (!btn) return;
  const ok = typeof apiPing === 'function' ? await apiPing() : false;
  const icon = btn.querySelector('.material-symbols-outlined');
  if (ok) {
    icon.textContent = 'cloud_done';
    btn.classList.add('text-secondary');
    btn.title = 'Terhubung ke backend';
  } else {
    icon.textContent = 'cloud_off';
    btn.classList.add('text-error');
    btn.title = 'Backend belum terhubung';
  }
}
