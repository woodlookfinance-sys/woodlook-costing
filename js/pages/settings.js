/* WOODLOOK — pages/settings.js */
window.Pages = window.Pages || {};

const THEMES = [
  { id: 'blue', name: 'Ocean Blue', colors: ['#0b2545', '#2f6fae', '#7ec1ea'] },
  { id: 'walnut', name: 'Walnut', colors: ['#3b2417', '#8a5a34', '#e0a860'] },
  { id: 'forest', name: 'Forest', colors: ['#0f2f22', '#2f7d55', '#8fd6ae'] },
  { id: 'burgundy', name: 'Burgundy', colors: ['#3a0d17', '#9c2c3a', '#e28b96'] },
  { id: 'slate', name: 'Slate', colors: ['#1c1f26', '#4f5a6e', '#9fb0c9'] },
  { id: 'terracotta', name: 'Terracotta', colors: ['#3d2210', '#b0602a', '#f0ab6a'] },
];

const Theme = {
  get() { try { return localStorage.getItem('woodlook-theme') || 'blue'; } catch (e) { return 'blue'; } },
  set(id) {
    try { localStorage.setItem('woodlook-theme', id); } catch (e) {}
    document.documentElement.setAttribute('data-theme', id);
  },
};

Pages.settings = {
  title: 'Settings',
  actions(container) { container.innerHTML = ''; },

  async render(container) {
    const url = SheetsAPI.getUrl();
    const queue = await LocalDB.getQueue();
    const lastSync = await LocalDB.getMeta('lastSync');
    const activeTheme = Theme.get();

    container.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>Appearance</h3></div>
        <p>Pick a colour theme for the app. This is saved on this device only.</p>
        <div class="theme-grid" id="themeGrid">
          ${THEMES.map((t) => `
            <button type="button" class="theme-swatch ${t.id === activeTheme ? 'active' : ''}" data-theme-id="${t.id}">
              <div class="swatch-bar">${t.colors.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
              <div class="swatch-name">${t.name}</div>
            </button>
          `).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Google Sheet Connection</h3></div>
        <p>Paste the Web App URL from your deployed Google Apps Script (see <code>gas/Code.gs</code> and the README for setup steps). The Google Sheet is the database — this app reads and writes to it through that URL.</p>
        <div class="field"><label>Apps Script Web App URL</label><input id="apiUrl" type="text" placeholder="https://script.google.com/macros/s/XXXXX/exec" value="${Utils.escapeHtml(url)}" /></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="btnSaveUrl">Save &amp; Test Connection</button>
          <button class="btn btn-ghost" id="btnPullNow">Pull Latest from Sheet</button>
        </div>
        <div id="connStatus" class="hint" style="margin-top:10px;"></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Sync Status</h3></div>
        <table class="summary-table">
          <tr><td>Status</td><td>${Store.getSyncStatus()}</td></tr>
          <tr><td>Last successful pull</td><td>${lastSync ? new Date(lastSync).toLocaleString() : 'Never'}</td></tr>
          <tr><td>Changes waiting to sync</td><td>${queue.length}</td></tr>
        </table>
        ${queue.length ? '<button class="btn btn-ghost" id="btnFlush" style="margin-top:10px;">Retry Sync Now</button>' : ''}
      </div>

      <div class="card">
        <div class="card-head"><h3>About this deployment</h3></div>
        <p>WOODLOOK PRODUCT COSTING runs entirely in your browser as static files (no server required) and uses a Google Sheet as its database via Google Apps Script. All edits are cached locally in IndexedDB first, so the app stays instant even with 1000+ products, and syncs to the Sheet in the background.</p>
      </div>
    `;

    container.querySelectorAll('#themeGrid [data-theme-id]').forEach((btn) => {
      btn.onclick = () => {
        Theme.set(btn.dataset.themeId);
        container.querySelectorAll('#themeGrid .theme-swatch').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        Utils.toast('Theme updated', 'success');
      };
    });

    container.querySelector('#btnSaveUrl').onclick = async () => {
      const val = container.querySelector('#apiUrl').value.trim();
      SheetsAPI.setUrl(val);
      const statusEl = container.querySelector('#connStatus');
      statusEl.textContent = 'Testing connection...';
      try {
        const ok = await SheetsAPI.ping(val);
        if (ok) {
          statusEl.textContent = '✓ Connected. Pulling data...';
          await Store.pullFromSheet();
          statusEl.textContent = '✓ Connected and synced.';
          Utils.toast('Connected to Google Sheet', 'success');
          App.renderCurrentRoute();
        } else {
          statusEl.textContent = 'Could not verify the connection — check the URL and deployment settings.';
        }
      } catch (err) {
        statusEl.textContent = 'Connection failed: ' + err.message + '. Check the URL and that the deployment access is set to "Anyone".';
      }
    };

    container.querySelector('#btnPullNow').onclick = async () => {
      const ok = await Store.pullFromSheet();
      Utils.toast(ok ? 'Synced from Google Sheet' : 'Sync failed — check Settings', ok ? 'success' : 'error');
      App.renderCurrentRoute();
    };

    const flushBtn = container.querySelector('#btnFlush');
    if (flushBtn) flushBtn.onclick = async () => {
      await Store.flushQueue();
      Utils.toast('Sync retried', 'info');
      App.renderCurrentRoute();
    };
  },
};
