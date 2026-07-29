/**
 * shared/header.js
 * Render header/navigasi yang konsisten di semua modul.
 * Pemakaian: <div id="app-header"></div> lalu panggil renderHeader('id-modul-aktif').
 */

const NAV_ITEMS = [
  { id: 'beranda', label: 'Beranda', href: 'index.html', ready: true },
  { id: 'profil-gi', label: 'Profil GI', href: 'features/profil-gi/index.html', ready: false },
  { id: 'file-manager', label: 'File WP/BA/Peralatan', href: '#', ready: false },
  { id: 'kondisi-peralatan', label: 'Kondisi Peralatan', href: '#', ready: false },
  { id: 'tower-asset', label: 'Asset Tower', href: '#', ready: false },
  { id: 'counter', label: 'Counter Peralatan', href: '#', ready: false },
  { id: 'anomali', label: 'Anomali', href: '#', ready: false }
];

// Signature mark: motif single-line diagram (busbar + breaker) gardu induk
const SLD_MARK = `
<svg class="sld-mark" viewBox="0 0 64 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <line x1="2" y1="10" x2="62" y2="10" stroke="var(--accent-copper)" stroke-width="1.5"/>
  <circle cx="14" cy="10" r="4" fill="none" stroke="var(--accent-copper)" stroke-width="1.5"/>
  <circle cx="32" cy="10" r="4" fill="var(--accent-copper)"/>
  <circle cx="50" cy="10" r="4" fill="none" stroke="var(--accent-copper)" stroke-width="1.5"/>
  <line x1="14" y1="2" x2="14" y2="6" stroke="var(--accent-copper)" stroke-width="1.5"/>
  <line x1="50" y1="14" x2="50" y2="18" stroke="var(--accent-copper)" stroke-width="1.5"/>
</svg>`;

function renderHeader(activeId) {
  const el = document.getElementById('app-header');
  if (!el) return;

  const links = NAV_ITEMS.map((item) => {
    const isActive = item.id === activeId;
    const disabled = !item.ready && !isActive;
    return `<a href="${disabled ? '#' : item.href}"
      class="nav-link ${isActive ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}"
      ${disabled ? 'aria-disabled="true" title="Segera hadir"' : ''}>
      ${item.label}${!item.ready ? '<span class="nav-soon">segera</span>' : ''}
    </a>`;
  }).join('');

  el.innerHTML = `
    <header class="app-header">
      <div class="brand">
        ${SLD_MARK}
        <span class="brand-name">PLN GI Suite</span>
      </div>
      <nav class="app-nav">${links}</nav>
      <div class="header-status">
        <span id="conn-dot" class="conn-dot"></span>
        <span id="conn-label" class="conn-label">memeriksa…</span>
      </div>
    </header>
  `;

  checkConnection();
}

async function checkConnection() {
  const dot = document.getElementById('conn-dot');
  const label = document.getElementById('conn-label');
  if (!dot || !label) return;
  const ok = typeof apiPing === 'function' ? await apiPing() : false;
  dot.classList.toggle('is-online', ok);
  dot.classList.toggle('is-offline', !ok);
  label.textContent = ok ? 'Terhubung' : 'Backend belum terhubung';
}
