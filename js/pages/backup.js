/* WOODLOOK — pages/backup.js */
window.Pages = window.Pages || {};

Pages.backup = {
  title: 'Backup / Restore',
  actions(container) { container.innerHTML = ''; },

  render(container) {
    const counts = Store.TABLES.map((t) => `${t}: ${Store.state[t].length}`).join(' · ');
    container.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>Backup</h3></div>
        <p>Download everything — products, BOM, wood/MDF/paint/polish rows, labour, raw materials and photos — as one JSON file.</p>
        <p class="hint">${counts}</p>
        <button class="btn btn-primary" id="btnExport">&#128190; Download Backup (.json)</button>
      </div>

      <div class="card">
        <div class="card-head"><h3>Restore</h3></div>
        <p>Restore from a previously downloaded backup file. This replaces the current local data (and, if a Google Sheet is connected, pushes everything back up to it).</p>
        <input type="file" id="restoreFile" accept="application/json" />
        <div style="margin-top:10px;"><button class="btn btn-danger" id="btnRestore" disabled>Restore from File</button></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Performance Test Data</h3></div>
        <p>Generate a large batch of sample products and materials to confirm the app stays responsive at 1000+ products (per the app's quality checklist). This data is clearly fake and easy to remove afterwards.</p>
        <div class="inline-fields" style="max-width:340px;">
          <div class="field"><label>How many sample products?</label><input id="sampleCount" type="number" value="1000" min="10" max="5000" /></div>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="btn btn-ghost" id="btnGenerate">Generate Sample Data</button>
          <button class="btn btn-danger" id="btnClearSample">Remove All Sample Data</button>
        </div>
        <div id="genStatus" class="hint" style="margin-top:8px;"></div>
      </div>

      <div class="card">
        <div class="card-head"><h3>Danger Zone</h3></div>
        <p>Wipe the local cache only (does not touch your Google Sheet). Useful if the local copy ever gets out of sync — the app will re-pull everything from the Sheet.</p>
        <button class="btn btn-danger" id="btnWipeLocal">Wipe Local Cache &amp; Re-sync</button>
      </div>
    `;

    container.querySelector('#btnExport').onclick = exportBackup;

    const fileInput = container.querySelector('#restoreFile');
    const restoreBtn = container.querySelector('#btnRestore');
    fileInput.onchange = () => { restoreBtn.disabled = !fileInput.files.length; };
    restoreBtn.onclick = () => restoreBackup(fileInput.files[0]);

    container.querySelector('#btnGenerate').onclick = () => {
      const n = Number(container.querySelector('#sampleCount').value) || 1000;
      generateSampleData(n, container.querySelector('#genStatus'));
    };
    container.querySelector('#btnClearSample').onclick = () => {
      if (!confirm('Remove all products/materials tagged as sample data?')) return;
      clearSampleData();
    };

    container.querySelector('#btnWipeLocal').onclick = async () => {
      if (!confirm('Wipe local cache and re-sync from the Google Sheet?')) return;
      for (const t of Store.TABLES) await LocalDB.clearTable(t);
      await Store.pullFromSheet();
      Utils.toast('Local cache wiped and re-synced', 'success');
      App.renderCurrentRoute();
    };
  },
};

function exportBackup() {
  const payload = { exportedAt: new Date().toISOString(), app: 'WOODLOOK PRODUCT COSTING', data: {} };
  Store.TABLES.forEach((t) => { payload.data[t] = Store.state[t]; });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `woodlook-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  Utils.toast('Backup downloaded', 'success');
}

async function restoreBackup(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const data = parsed.data || parsed; // tolerate a raw {Materials:[],...} file too
    if (!confirm('This will replace all current local data. Continue?')) return;

    Store.TABLES.forEach((t) => { Store.state[t] = data[t] || []; });
    await LocalDB.replaceAll(Store.state);
    Utils.toast('Backup restored locally', 'success');

    if (SheetsAPI.isConfigured()) {
      Utils.toast('Pushing restored data to your Google Sheet — this may take a minute for large backups...', 'info', 4000);
      for (const t of Store.TABLES) {
        if (Store.state[t].length) {
          try { await SheetsAPI.bulkUpsert(t, Store.state[t]); } catch (e) { console.warn('bulk push failed for', t, e); }
        }
      }
      Utils.toast('Backup pushed to Google Sheet', 'success');
    }
    App.renderCurrentRoute();
  } catch (err) {
    console.error(err);
    Utils.toast('Could not read that backup file', 'error');
  }
}

function generateSampleData(count, statusEl) {
  statusEl.textContent = 'Generating...';
  setTimeout(() => {
    const cats = ['Wood', 'MDF', 'Plywood', 'Hardware', 'Foam', 'Fabric', 'Paint', 'Polish', 'Other'];
    const units = { Wood: 'cft', MDF: 'sqft', Plywood: 'sqft', Hardware: 'nos', Foam: 'sqft', Fabric: 'meter', Paint: 'litre', Polish: 'litre', Other: 'nos' };

    // Ensure at least a handful of materials per category exist for realistic BOM/wood/mdf rows
    const matIds = {};
    cats.forEach((cat) => {
      matIds[cat] = [];
      for (let i = 1; i <= 5; i++) {
        const row = Store.upsertRow('Materials', {
          name: `SAMPLE ${cat} Type ${i}`,
          category: cat,
          unit: units[cat],
          rate: Math.round((Math.random() * 900 + 50) * 100) / 100,
          __sample: true,
        });
        matIds[cat].push(row.id);
      }
    });

    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const prodCats = PRODUCT_CATEGORIES;

    for (let i = 1; i <= count; i++) {
      const product = Store.upsertRow('Products', {
        code: `SMP-${String(i).padStart(5, '0')}`,
        name: `Sample ${pick(prodCats)} #${i}`,
        category: pick(prodCats),
        retailMargin: 30 + Math.floor(Math.random() * 30),
        wholesaleMargin: 10 + Math.floor(Math.random() * 20),
        photo: '',
        __sample: true,
      });
      Store.upsertRow('Wood', { productId: product.id, slot: 1, materialId: pick(matIds.Wood), length: 72, width: 6, breadth: 1, qtyMultiplier: 2, __sample: true });
      Store.upsertRow('MDF', { productId: product.id, slot: 1, materialId: pick(matIds.MDF), length: 96, width: 48, qtyMultiplier: 1, __sample: true });
      Store.upsertRow('Paint', { productId: product.id, materialId: pick(matIds.Paint), quantity: 1.5, unit: 'litre', __sample: true });
      Store.upsertRow('Polish', { productId: product.id, materialId: pick(matIds.Polish), quantity: 0.5, unit: 'litre', __sample: true });
      Store.upsertRow('BOM', { productId: product.id, category: 'Hardware', materialId: pick(matIds.Hardware), quantity: 4, unit: 'nos', wastePct: 2, __sample: true });
      Store.upsertRow('Labour', { productId: product.id, type: 'Carpenter', qty: 8, rate: 60, __sample: true });
      Store.upsertRow('Labour', { productId: product.id, type: 'Spray', qty: 2, rate: 80, __sample: true });
    }

    statusEl.textContent = `Generated ${count} sample products. Open Products to confirm the list stays fast to search and page through.`;
    Utils.toast(`${count} sample products generated`, 'success');
    App.renderCurrentRoute();
  }, 30);
}

function clearSampleData() {
  Store.TABLES.forEach((t) => {
    Store.state[t].filter((r) => r.__sample).forEach((r) => Store.deleteRow(t, r.id));
  });
  Utils.toast('Sample data removed', 'success');
  App.renderCurrentRoute();
}
