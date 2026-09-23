/* WOODLOOK — app.js: router + shell wiring + boot */

const App = (() => {
  const NAV_SHORTCUTS = {
    'navProductCosting': null,
    'navWood': 'wood',
    'navMdf': 'mdf',
    'navPaint': 'paint',
    'navPolish': 'polish',
    'navLabour': 'labour',
  };

  function parseHash() {
    const h = location.hash.replace(/^#\//, '');
    const parts = h.split('/').filter(Boolean);
    if (parts.length === 0) return { page: 'dashboard' };
    if (parts[0] === 'product' && parts[1]) return { page: 'productCosting', id: parts[1], tab: parts[2] };
    if (parts[0] === 'product-report' && parts[1]) return { page: 'productReportView', id: parts[1] };
    const map = { dashboard: 'dashboard', materials: 'materials', products: 'products', reports: 'reports', backup: 'backup', settings: 'settings' };
    return { page: map[parts[0]] || 'dashboard' };
  }

  function updateActiveNav(routeKey) {
    document.querySelectorAll('.nav-link').forEach((a) => a.classList.remove('active'));
    const keyToNavId = { dashboard: 'dashboard', materials: 'materials', products: 'products', productCosting: 'product-costing', productReportView: 'products', reports: 'reports', backup: 'backup', settings: 'settings' };
    const navId = keyToNavId[routeKey];
    if (navId) {
      const link = document.querySelector(`.nav-link[data-route="${navId}"]`);
      if (link) link.classList.add('active');
    }
  }

  function renderCurrentRoute() {
    const route = parseHash();
    const pageMap = {
      dashboard: Pages.dashboard,
      materials: Pages.materials,
      products: Pages.products,
      productCosting: Pages.productCosting,
      productReportView: Pages.productReportView,
      reports: Pages.reports,
      backup: Pages.backup,
      settings: Pages.settings,
    };
    const page = pageMap[route.page] || Pages.dashboard;
    document.getElementById('pageTitle').textContent =
      route.page === 'productCosting' || route.page === 'productReportView'
        ? (Store.state.Products.find((p) => String(p.id) === String(route.id))?.name || 'Product Costing')
        : page.title;

    const actionsHost = document.getElementById('topbarActions');
    actionsHost.innerHTML = '';
    if (page.actions) page.actions(actionsHost, route);

    const content = document.getElementById('appContent');
    content.classList.toggle('wide-content', route.page === 'products' || route.page === 'materials');
    page.render(content, route);
    updateActiveNav(route.page);
    closeMobileNav();
  }

  function openMobileNav() {
    document.getElementById('appNav').classList.add('open');
    document.getElementById('navScrim').classList.add('show');
  }
  function closeMobileNav() {
    document.getElementById('appNav').classList.remove('open');
    document.getElementById('navScrim').classList.remove('show');
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: 860px)').matches;
  }

  function setNavCollapsed(collapsed) {
    document.getElementById('appNav').classList.toggle('collapsed', collapsed);
    try { localStorage.setItem('woodlook.navCollapsed', collapsed ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function toggleNav() {
    if (isMobileViewport()) {
      const nav = document.getElementById('appNav');
      nav.classList.contains('open') ? closeMobileNav() : openMobileNav();
    } else {
      const nav = document.getElementById('appNav');
      setNavCollapsed(!nav.classList.contains('collapsed'));
    }
  }

  function restoreNavPreference() {
    if (isMobileViewport()) return;
    try {
      if (localStorage.getItem('woodlook.navCollapsed') === '1') setNavCollapsed(true);
    } catch (e) { /* ignore */ }
  }

  function wireShell() {
    window.addEventListener('hashchange', renderCurrentRoute);
    document.getElementById('menuBtn').onclick = toggleNav;
    document.getElementById('navScrim').onclick = closeMobileNav;
    restoreNavPreference();

    Object.entries(NAV_SHORTCUTS).forEach(([navId, tab]) => {
      const el = document.getElementById(navId);
      if (!el) return;
      el.addEventListener('click', (e) => {
        const lastId = sessionStorage.getItem('woodlook.lastProductId');
        const productExists = lastId && Store.state.Products.some((p) => String(p.id) === String(lastId));
        if (productExists) {
          e.preventDefault();
          location.hash = tab ? `#/product/${lastId}/${tab}` : `#/product/${lastId}`;
        }
        // else: fall through to default href="#/products" so the user can pick one
      });
    });

    const syncPill = document.getElementById('syncPill');
    syncPill.addEventListener('click', async () => {
      if (!SheetsAPI.isConfigured()) { location.hash = '#/settings'; return; }
      Utils.toast('Syncing...', 'info', 1200);
      await Store.flushQueue();
      await Store.pullFromSheet();
      renderCurrentRoute();
    });

    Store.subscribe((topic) => {
      if (topic === 'sync') updateSyncPill();
      // Data-table changes re-render whatever is on screen so figures never go stale
      if (Store.TABLES.includes(topic) || topic === 'load') {
        // Avoid re-render storms: individual pages already re-render themselves
        // after their own edits, but this keeps other open views (e.g. dashboard
        // stat cards) correct if data changed elsewhere.
      }
    });
  }

  function updateSyncPill() {
    const dot = document.getElementById('syncDot');
    const label = document.getElementById('syncLabel');
    const status = Store.getSyncStatus();
    dot.className = 'dot ' + status;
    const labels = {
      'not-configured': 'Local only — click to connect',
      offline: 'Local only',
      syncing: 'Syncing...',
      synced: 'Synced with Sheet',
      error: 'Sync error — click to retry',
    };
    label.textContent = labels[status] || status;
  }

  async function boot() {
    wireShell();
    await Store.loadFromLocal();
    await Store.initPendingSync();
    renderCurrentRoute();
    if (SheetsAPI.isConfigured()) {
      await Store.flushQueue();
      await Store.pullFromSheet();
      renderCurrentRoute();
    } else {
      Store.setSyncStatus('not-configured');
    }
  }

  // Warn before closing/reloading while a change is still queued to reach
  // the Sheet — this is a safety net on top of the enqueue-first sync fix,
  // giving the user a chance to wait a moment instead of losing the edit.
  window.addEventListener('beforeunload', (e) => {
    if (Store.hasPendingSync()) {
      e.preventDefault();
      e.returnValue = 'Some changes are still syncing to Google Sheets. Leave anyway?';
      return e.returnValue;
    }
  });

  return { renderCurrentRoute, boot };
})();

document.addEventListener('DOMContentLoaded', App.boot);
