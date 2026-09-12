/* WOODLOOK — pages/settings.js */
window.Pages = window.Pages || {};

Pages.settings = {
  title: 'Settings',
  actions(container) { container.innerHTML = ''; },

  async render(container) {
    const url = SheetsAPI.getUrl();
    const queue = await LocalDB.getQueue();
    const lastSync = await LocalDB.getMeta('lastSync');

    container.innerHTML = `
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
