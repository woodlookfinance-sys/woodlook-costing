/* WOODLOOK — pages/productCosting.js
   The core costing workspace for a single product. Everything here reads
   Store.state live and re-renders on every edit, so cost figures are
   always current — including when a raw-material rate changes elsewhere. */
window.Pages = window.Pages || {};

const LABOUR_TYPES = ['Carpenter', 'Spray', 'Polish', 'Other'];
const BOM_UNITS = ['nos', 'kg', 'g', 'litre', 'ml', 'sqft', 'cft', 'meter', 'set', 'roll'];

Pages.productCosting = {
  title: 'Product Costing',
  _tab: 'details',

  actions(container, params) {
    const id = params.id;
    container.innerHTML = `
      <button class="btn btn-ghost" id="printSumBtn">Print Summary</button>
      <button class="btn btn-ghost" id="printDetBtn">Print Detailed</button>
      <button class="btn btn-ghost" id="excelSumBtn">Excel Summary</button>
      <button class="btn btn-ghost" id="excelDetBtn">Excel Detailed</button>
      <a class="btn btn-ghost" href="#/products">&larr; All Products</a>
    `;
    container.querySelector('#printSumBtn').onclick = () => Reports.printSummary(id);
    container.querySelector('#printDetBtn').onclick = () => Reports.printDetailed(id);
    container.querySelector('#excelSumBtn').onclick = () => ReportsExcel.exportReport(id, false);
    container.querySelector('#excelDetBtn').onclick = () => ReportsExcel.exportReport(id, true);
  },

  render(container, params) {
    const id = params.id;
    const product = Store.state.Products.find((p) => String(p.id) === String(id));
    if (!product) {
      container.innerHTML = `<div class="empty-state"><div class="big">&#10060;</div><p>Product not found. It may have been deleted.</p><a class="btn btn-primary" href="#/products">Back to Products</a></div>`;
      return;
    }
    sessionStorage.setItem('woodlook.lastProductId', id);
    if (params.tab) this._tab = params.tab;

    const computed = Calc.computeProductCost(id);
    const s = computed.summary;

    container.innerHTML = `
      <div class="cost-header card">
        <div class="photo-box" id="headerPhotoBox">${product.photo ? `<img src="${product.photo}"/>` : 'No photo'}</div>
        <div class="meta">
          <div class="code">${Utils.escapeHtml(product.code || 'NO CODE')}${product.category ? ' &middot; ' + Utils.escapeHtml(product.category) : ''}</div>
          <h1>${Utils.escapeHtml(product.name || 'Untitled Product')}</h1>
          <div style="display:flex;gap:22px;flex-wrap:wrap;margin-top:8px;">
            <div><div class="hint">Total Production Cost</div><strong style="font-size:18px;">${Utils.money(s.totalProductionCost)}</strong></div>
            <div><div class="hint">Wholesale Price</div><strong style="font-size:18px;color:var(--walnut);">${Utils.money(s.wholesalePrice)} <span style="font-size:13px;font-weight:600;color:var(--ink-soft);">(${s.wholesaleMargin}%)</span></strong></div>
            <div><div class="hint">Retail Price</div><strong style="font-size:18px;color:var(--walnut);">${Utils.money(s.retailPrice)} <span style="font-size:13px;font-weight:600;color:var(--ink-soft);">(${s.retailMargin}%)</span></strong></div>
          </div>
        </div>
      </div>

      <div class="tabs" id="costTabs">
        ${['details','wood','mdf','paint','polish','labour','bom','summary'].map((t) => `
          <button class="tab-btn ${this._tab === t ? 'active' : ''}" data-tab="${t}">${tabLabel(t)}</button>
        `).join('')}
      </div>
      <div id="tabBody"></div>
    `;

    container.querySelectorAll('#costTabs .tab-btn').forEach((b) => {
      b.onclick = () => {
        this._tab = b.dataset.tab;
        location.hash = `#/product/${id}/${this._tab}`;
      };
    });

    const body = container.querySelector('#tabBody');
    const rerender = () => this.render(container, { id, tab: this._tab });
    switch (this._tab) {
      case 'details': renderDetailsTab(body, product, computed, rerender); break;
      case 'bom': renderBomTab(body, product, computed, rerender); break;
      case 'wood': renderWoodTab(body, product, computed, rerender); break;
      case 'mdf': renderMdfTab(body, product, computed, rerender); break;
      case 'paint': renderPaintPolishTab(body, product, computed, rerender, 'Paint'); break;
      case 'polish': renderPaintPolishTab(body, product, computed, rerender, 'Polish'); break;
      case 'labour': renderLabourTab(body, product, computed, rerender); break;
      case 'summary': renderSummaryTab(body, product, computed); break;
    }
  },
};

function tabLabel(t) {
  return { details: 'Details', bom: 'BOM (Other)', wood: 'Wood Calculator', mdf: 'MDF Calculator',
    paint: 'Paint', polish: 'Polish', labour: 'Labour', summary: 'Cost Summary' }[t];
}

function materialsByCategory(cat) {
  return Store.state.Materials.filter((m) => m.category === cat).sort((a, b) => a.name.localeCompare(b.name));
}

/* ============================= DETAILS TAB ============================= */
function renderDetailsTab(body, product, computed, rerender) {
  const s = computed.summary;
  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Product Details &amp; Photo</h3></div>
      <div class="photo-upload-row">
        <div class="photo-box" id="detPhotoBox">${product.photo ? `<img src="${product.photo}"/>` : 'No photo yet'}</div>
        <div style="flex:1;min-width:220px;">
          <div class="field"><label>Product Photo</label><input type="file" accept="image/*" id="photoInput" /></div>
          <p class="hint">The preview box above is exactly 6cm × 6cm — the same size used on both the Summary and Detailed print reports.</p>
        </div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Product Code</label><input id="fCode" type="text" value="${Utils.escapeHtml(product.code || '')}" /></div>
        <div class="field"><label>Product Name</label><input id="fName" type="text" value="${Utils.escapeHtml(product.name || '')}" /></div>
      </div>
      <div class="grid grid-2">
        <div class="field"><label>Category</label>
          <select id="fCat"><option value="">— None —</option>${PRODUCT_CATEGORIES.map((c) => `<option value="${c}" ${product.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Notes</label><input id="fNotes" type="text" value="${Utils.escapeHtml(product.notes || '')}" placeholder="optional" /></div>
      </div>
      <div class="grid grid-2">
        <div class="field">
          <label>Wholesale Margin %</label>
          <input id="fWMargin" type="number" step="0.1" value="${product.wholesaleMargin ?? 0}" />
          <div class="hint">= ${Utils.money(s.wholesaleMarginAmount)} margin &middot; Price ${Utils.money(s.wholesalePrice)}</div>
        </div>
        <div class="field">
          <label>Retail Margin %</label>
          <input id="fRMargin" type="number" step="0.1" value="${product.retailMargin ?? 0}" />
          <div class="hint">= ${Utils.money(s.retailMarginAmount)} margin &middot; Price ${Utils.money(s.retailPrice)}</div>
        </div>
      </div>
      <button class="btn btn-primary" id="saveDetails">Save Details</button>
    </div>
  `;

  body.querySelector('#photoInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const b64 = await Utils.fileToCompressedBase64(file);
      Store.upsertRow('Products', { id: product.id, photo: b64 });
      Utils.toast('Photo updated', 'success');
      rerender();
    } catch (err) {
      Utils.toast('Could not read that image', 'error');
    }
  };

  body.querySelector('#saveDetails').onclick = () => {
    Store.upsertRow('Products', {
      id: product.id,
      code: body.querySelector('#fCode').value.trim(),
      name: body.querySelector('#fName').value.trim(),
      category: body.querySelector('#fCat').value,
      notes: body.querySelector('#fNotes').value.trim(),
      wholesaleMargin: Number(body.querySelector('#fWMargin').value) || 0,
      retailMargin: Number(body.querySelector('#fRMargin').value) || 0,
    });
    Utils.toast('Product details saved', 'success');
    rerender();
  };

  // Live preview of margin amount + price as the % is typed, before saving.
  const wIn = body.querySelector('#fWMargin');
  const rIn = body.querySelector('#fRMargin');
  wIn.oninput = () => {
    const price = Calc.priceFromMargin(s.totalProductionCost, Number(wIn.value) || 0);
    const amount = Utils.num(price - s.totalProductionCost, 2);
    wIn.nextElementSibling.textContent = `= ${Utils.money(amount)} margin · Price ${Utils.money(price)}`;
  };
  rIn.oninput = () => {
    const price = Calc.priceFromMargin(s.totalProductionCost, Number(rIn.value) || 0);
    const amount = Utils.num(price - s.totalProductionCost, 2);
    rIn.nextElementSibling.textContent = `= ${Utils.money(amount)} margin · Price ${Utils.money(price)}`;
  };
}

/* ============================= BOM TAB ============================= */
function renderBomTab(body, product, computed, rerender) {
  const rows = computed.bom;
  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Bill of Materials</h3><button class="btn btn-sm btn-primary" id="addBomRow">+ Add Row</button></div>
      <div class="help-note">Wastage is a % of that row's material cost, not a fixed amount. Rates always come live from Raw Materials.</div>
      <div id="bomRows">
        ${rows.length ? rows.map(bomRowHtml).join('') : '<p class="hint">No BOM rows yet. Add hardware, foam, fabric, plywood or other materials here.</p>'}
      </div>
    </div>
  `;
  wireBomRows(body, product, rerender);
  body.querySelector('#addBomRow').onclick = () => {
    Store.upsertRow('BOM', { productId: product.id, category: 'Hardware', materialId: '', quantity: 0, unit: 'nos', wastePct: 0 });
    rerender();
  };
}

function bomRowHtml(r) {
  const mats = materialsByCategory(r.category || 'Hardware');
  return `
    <div class="bom-row-grid" style="margin-bottom:8px;" data-row="${r.id}">
      <select class="bRowCat">${MATERIAL_CATEGORIES.map((c) => `<option value="${c}" ${r.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <select class="bRowMat">
        <option value="">— Select material —</option>
        ${mats.map((m) => `<option value="${m.id}" ${String(r.materialId) === String(m.id) ? 'selected' : ''}>${Utils.escapeHtml(m.name)}</option>`).join('')}
      </select>
      <input class="bRowQty" type="number" step="0.001" value="${r.quantity || 0}" placeholder="Qty" />
      <select class="bRowUnit">${BOM_UNITS.map((u) => `<option value="${u}" ${r.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <div style="font-size:13px;color:var(--ink-soft);">@ ${Utils.money(r.rate)}</div>
      <input class="bRowWaste" type="number" step="0.1" value="${r.wastePct || 0}" placeholder="Waste %" />
      <div style="font-weight:700;">${Utils.money(r.total)}</div>
      <button class="iconbtn bRowDel" title="Remove row">&#10005;</button>
    </div>`;
}

function wireBomRows(body, product, rerender) {
  body.querySelectorAll('[data-row]').forEach((rowEl) => {
    const id = rowEl.dataset.row;
    const commit = (patch) => Store.upsertRow('BOM', { id, productId: product.id, ...patch });
    rowEl.querySelector('.bRowCat').onchange = (e) => { commit({ category: e.target.value, materialId: '' }); rerender(); };
    rowEl.querySelector('.bRowMat').onchange = (e) => { commit({ materialId: e.target.value }); rerender(); };
    rowEl.querySelector('.bRowQty').oninput = Utils.debounce((e) => { commit({ quantity: Number(e.target.value) || 0 }); rerender(); }, 300);
    rowEl.querySelector('.bRowUnit').onchange = (e) => { commit({ unit: e.target.value }); rerender(); };
    rowEl.querySelector('.bRowWaste').oninput = Utils.debounce((e) => { commit({ wastePct: Number(e.target.value) || 0 }); rerender(); }, 300);
    rowEl.querySelector('.bRowDel').onclick = () => { Store.deleteRow('BOM', id); rerender(); };
  });
}

/* ============================= WOOD TAB (dynamic table, unlimited rows) ============================= */
function renderWoodTab(body, product, computed, rerender) {
  const woodMaterials = materialsByCategory('Wood');
  const rows = computed.wood.slice().sort((a, b) => (a.slot || 0) - (b.slot || 0));
  const totalCbft = rows.reduce((a, r) => a + (Number(r.calcQty) || 0), 0);
  const totalCost = rows.reduce((a, r) => a + (Number(r.cost) || 0), 0);

  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3 style="text-transform:uppercase;letter-spacing:0.02em;">Wood Material Calculator</h3><button class="btn btn-sm btn-primary" id="addWoodRow">+ Add Wood</button></div>
      <div class="help-note">CBFT formula: Length &times; Width &times; Breadth &times; Quantity &divide; 144</div>
      ${woodMaterials.length ? '' : `<div class="help-note" style="background:#eef3fa;">No materials with category "Wood" yet. Add some on the <a href="#/materials">Raw Materials</a> page first.</div>`}
      <div class="table-wrap">
        <table class="data dark-head wood-calc-table">
          <thead>
            <tr>
              <th>Wood Type</th><th class="dim-col">Length</th><th class="dim-col">Width</th><th class="dim-col">Breadth</th><th>Qty</th>
              <th class="num">CBFT</th><th class="num">Rate / CBFT</th><th class="num">Total</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="woodRows">
            ${rows.length ? rows.map((r) => woodRowHtml(r, woodMaterials)).join('') :
              `<tr><td colspan="9" class="hint" style="text-align:center;padding:24px;">No wood rows yet — click &ldquo;+ Add Wood&rdquo; to add one.</td></tr>`}
          </tbody>
          ${rows.length ? `<tfoot><tr class="wood-total-row">
            <td colspan="5"><strong>TOTAL WOOD</strong></td>
            <td class="num"><strong>${Utils.num(totalCbft, 3)}</strong></td>
            <td></td>
            <td class="num"><strong>${Utils.money(totalCost)}</strong></td>
            <td></td>
          </tr></tfoot>` : ''}
        </table>
      </div>
    </div>
  `;

  wireWoodRows(body, product, rerender, rows);
  body.querySelector('#addWoodRow').onclick = () => {
    const nextSlot = (Math.max(0, ...rows.map((r) => r.slot || 0)) || 0) + 1;
    Store.upsertRow('Wood', { productId: product.id, slot: nextSlot, materialId: '', length: '', width: '', breadth: '', qtyMultiplier: 1 });
    rerender();
  };
}

function woodRowHtml(r, materials) {
  return `
    <tr data-wood="${r.id}">
      <td><select class="wMaterial">
        <option value="">— Select —</option>
        ${materials.map((m) => `<option value="${m.id}" ${String(r.materialId) === String(m.id) ? 'selected' : ''}>${Utils.escapeHtml(m.name)}</option>`).join('')}
      </select></td>
      <td class="dim-col"><input class="wField" data-f="length" type="number" step="0.01" value="${r.length || ''}" /></td>
      <td class="dim-col"><input class="wField" data-f="width" type="number" step="0.01" value="${r.width || ''}" /></td>
      <td class="dim-col"><input class="wField" data-f="breadth" type="number" step="0.01" value="${r.breadth || ''}" /></td>
      <td><input class="wField" data-f="qtyMultiplier" type="number" step="1" value="${r.qtyMultiplier ?? 1}" /></td>
      <td class="num">${r.calcQty || 0}</td>
      <td class="num"><input type="text" value="${r.rate ? Utils.money(r.rate) : '—'}" disabled style="text-align:right;" /></td>
      <td class="num"><strong>${Utils.money(r.cost || 0)}</strong></td>
      <td><button class="btn-remove wDel" type="button">Remove</button></td>
    </tr>`;
}

function wireWoodRows(body, product, rerender, rows) {
  rows.forEach((r) => {
    const rowEl = body.querySelector(`[data-wood="${r.id}"]`);
    if (!rowEl) return;
    const commit = (patch) => Store.upsertRow('Wood', { id: r.id, productId: product.id, slot: r.slot, ...patch });
    rowEl.querySelector('.wMaterial').onchange = (e) => { commit({ materialId: e.target.value }); rerender(); };
    rowEl.querySelectorAll('.wField').forEach((inp) => {
      inp.oninput = Utils.debounce((e) => { commit({ [e.target.dataset.f]: Number(e.target.value) || 0 }); rerender(); }, 300);
    });
    rowEl.querySelector('.wDel').onclick = () => { Store.deleteRow('Wood', r.id); rerender(); };
  });
}

/* ============================= MDF TAB (dynamic table, same model as Wood) ============================= */
function renderMdfTab(body, product, computed, rerender) {
  const mdfMaterials = materialsByCategory('MDF');
  const rows = computed.mdf.slice().sort((a, b) => (a.slot || 0) - (b.slot || 0));
  const totalSqft = rows.reduce((a, r) => a + (Number(r.calcQty) || 0), 0);
  const totalCost = rows.reduce((a, r) => a + (Number(r.cost) || 0), 0);

  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3 style="text-transform:uppercase;letter-spacing:0.02em;">MDF Size Calculator</h3><button class="btn btn-sm btn-primary" id="addMdfRow">+ Add MDF</button></div>
      <div class="help-note">Formula: Length &times; Width &times; Sheets = Quantity</div>
      ${mdfMaterials.length ? '' : `<div class="help-note" style="background:#eef3fa;">No materials with category "MDF" yet. Add some on the <a href="#/materials">Raw Materials</a> page first.</div>`}
      <div class="table-wrap">
        <table class="data dark-head calc-table">
          <thead>
            <tr>
              <th>MDF Type</th><th class="dim-col">Length</th><th class="dim-col">Width</th><th>Sheets</th>
              <th class="num">Qty</th><th class="num">Rate / Unit</th><th class="num">Total</th><th>Action</th>
            </tr>
          </thead>
          <tbody id="mdfRows">
            ${rows.length ? rows.map((r) => mdfRowHtml(r, mdfMaterials)).join('') :
              `<tr><td colspan="8" class="hint" style="text-align:center;padding:24px;">No MDF rows yet — click &ldquo;+ Add MDF&rdquo; to add one.</td></tr>`}
          </tbody>
          ${rows.length ? `<tfoot><tr class="wood-total-row">
            <td colspan="4"><strong>TOTAL MDF</strong></td>
            <td class="num"><strong>${Utils.num(totalSqft, 3)}</strong></td>
            <td></td>
            <td class="num"><strong>${Utils.money(totalCost)}</strong></td>
            <td></td>
          </tr></tfoot>` : ''}
        </table>
      </div>
    </div>
  `;

  wireMdfRows(body, product, rerender, rows);
  body.querySelector('#addMdfRow').onclick = () => {
    const nextSlot = (Math.max(0, ...rows.map((r) => r.slot || 0)) || 0) + 1;
    Store.upsertRow('MDF', { productId: product.id, slot: nextSlot, materialId: '', length: '', width: '', qtyMultiplier: 1 });
    rerender();
  };
}

function mdfRowHtml(r, materials) {
  return `
    <tr data-mdfrow="${r.id}">
      <td><select class="mMaterial">
        <option value="">— Select —</option>
        ${materials.map((m) => `<option value="${m.id}" ${String(r.materialId) === String(m.id) ? 'selected' : ''}>${Utils.escapeHtml(m.name)}</option>`).join('')}
      </select></td>
      <td class="dim-col"><input class="mField" data-f="length" type="number" step="0.01" value="${r.length || ''}" /></td>
      <td class="dim-col"><input class="mField" data-f="width" type="number" step="0.01" value="${r.width || ''}" /></td>
      <td><input class="mField" data-f="qtyMultiplier" type="number" step="1" value="${r.qtyMultiplier ?? 1}" /></td>
      <td class="num">${r.calcQty || 0}</td>
      <td class="num"><input type="text" value="${r.rate ? Utils.money(r.rate) : '—'}" disabled style="text-align:right;" /></td>
      <td class="num"><strong>${Utils.money(r.cost || 0)}</strong></td>
      <td><button class="btn-remove mDel" type="button">Remove</button></td>
    </tr>`;
}

function wireMdfRows(body, product, rerender, rows) {
  rows.forEach((r) => {
    const rowEl = body.querySelector(`[data-mdfrow="${r.id}"]`);
    if (!rowEl) return;
    const commit = (patch) => Store.upsertRow('MDF', { id: r.id, productId: product.id, slot: r.slot, ...patch });
    rowEl.querySelector('.mMaterial').onchange = (e) => { commit({ materialId: e.target.value }); rerender(); };
    rowEl.querySelectorAll('.mField').forEach((inp) => {
      inp.oninput = Utils.debounce((e) => { commit({ [e.target.dataset.f]: Number(e.target.value) || 0 }); rerender(); }, 300);
    });
    rowEl.querySelector('.mDel').onclick = () => { Store.deleteRow('MDF', r.id); rerender(); };
  });
}

/* ============================= PAINT / POLISH TAB (dynamic rows) ============================= */
function renderPaintPolishTab(body, product, computed, rerender, kind) {
  const table = kind; // 'Paint' or 'Polish'
  const rows = kind === 'Paint' ? computed.paint : computed.polish;
  const materials = materialsByCategory(kind);
  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>${kind} Calculation</h3><button class="btn btn-sm btn-primary" id="addRow">+ Add ${kind}</button></div>
      ${materials.length ? '' : `<div class="help-note" style="background:#fbe6e0;">No materials with category "${kind}" yet. Add some on the <a href="#/materials">Raw Materials</a> page first.</div>`}
      <div id="rows">
        ${rows.length ? rows.map((r) => paintPolishRowHtml(r, materials)).join('') : `<p class="hint">No ${kind.toLowerCase()} recorded yet.</p>`}
      </div>
    </div>
  `;
  rows.forEach((r) => {
    const rowEl = body.querySelector(`[data-simple="${r.id}"]`);
    if (!rowEl) return;
    const commit = (patch) => Store.upsertRow(table, { id: r.id, productId: product.id, ...patch });
    rowEl.querySelector('.sMaterial').onchange = (e) => { commit({ materialId: e.target.value }); rerender(); };
    rowEl.querySelector('.sQty').oninput = Utils.debounce((e) => { commit({ quantity: Number(e.target.value) || 0 }); rerender(); }, 300);
    rowEl.querySelector('.sUnit').onchange = (e) => { commit({ unit: e.target.value }); rerender(); };
    rowEl.querySelector('.sDel').onclick = () => { Store.deleteRow(table, r.id); rerender(); };
  });
  body.querySelector('#addRow').onclick = () => {
    Store.upsertRow(table, { productId: product.id, materialId: '', quantity: 0, unit: kind === 'Paint' ? 'litre' : 'litre' });
    rerender();
  };
}

function paintPolishRowHtml(r, materials) {
  return `
    <div class="bom-row-grid" style="grid-template-columns:2fr 1fr 1fr 1fr 1fr 36px;margin-bottom:8px;" data-simple="${r.id}">
      <select class="sMaterial"><option value="">— Select —</option>${materials.map((m) => `<option value="${m.id}" ${String(r.materialId) === String(m.id) ? 'selected' : ''}>${Utils.escapeHtml(m.name)}</option>`).join('')}</select>
      <input class="sQty" type="number" step="0.01" value="${r.quantity || 0}" placeholder="Qty" />
      <select class="sUnit">${MATERIAL_UNITS.map((u) => `<option value="${u}" ${r.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <div style="font-size:13px;color:var(--ink-soft);">@ ${Utils.money(r.rate)}</div>
      <div style="font-weight:700;">${Utils.money(r.cost)}</div>
      <button class="iconbtn sDel" title="Remove">&#10005;</button>
    </div>`;
}

/* ============================= LABOUR TAB (4 fixed types) ============================= */
function renderLabourTab(body, product, computed, rerender) {
  const rowsByType = {};
  computed.labour.forEach((r) => { rowsByType[r.type] = r; });

  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Labour</h3></div>
      <div class="help-note">Each labour type is tracked separately — they are never combined into a single field.</div>
      <div class="table-wrap"><table class="data">
        <thead><tr><th>Labour Type</th><th>Hours / Qty</th><th>Rate</th><th>Total</th></tr></thead>
        <tbody>
          ${LABOUR_TYPES.map((type) => {
            const r = rowsByType[type] || { type, qty: '', rate: '' };
            return `<tr data-type="${type}">
              <td><strong>${type} Wage</strong></td>
              <td><input class="lQty" type="number" step="0.01" value="${r.qty || ''}" /></td>
              <td><input class="lRate" type="number" step="0.01" value="${r.rate || ''}" /></td>
              <td><strong>${Utils.money(r.total || 0)}</strong></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table></div>
    </div>
  `;

  body.querySelectorAll('tr[data-type]').forEach((tr) => {
    const type = tr.dataset.type;
    const existing = computed.labour.find((r) => r.type === type);
    const commit = (patch) => Store.upsertRow('Labour', { id: existing?.id, productId: product.id, type, ...patch });
    tr.querySelector('.lQty').oninput = Utils.debounce((e) => { commit({ qty: Number(e.target.value) || 0 }); rerender(); }, 300);
    tr.querySelector('.lRate').oninput = Utils.debounce((e) => { commit({ rate: Number(e.target.value) || 0 }); rerender(); }, 300);
  });
}

/* ============================= SUMMARY TAB ============================= */
function renderSummaryTab(body, product, computed) {
  const s = computed.summary;
  const row = (label, val, cls = '') => `<tr class="${cls}"><td>${label}</td><td>${Utils.money(val)}</td></tr>`;
  body.innerHTML = `
    <div class="card">
      <div class="card-head"><h3>Cost Summary</h3></div>
      <table class="summary-table">
        ${row('Wood', s.woodCost)}
        ${row('MDF', s.mdfCost)}
        ${row('Paint', s.paintCost)}
        ${row('Polish', s.polishCost)}
        ${row('Labour', s.labourCost)}
        ${row('Carpenter Wage', s.carpenterWage, 'sub')}
        ${row('Spray Wage', s.sprayWage, 'sub')}
        ${row('Polish Wage', s.polishWage, 'sub')}
        ${row('Other Labour', s.otherLabour, 'sub')}
        ${row('Material Cost (BOM)', s.materialCost)}
        ${row('Hardware Cost', s.hardwareCost, 'sub')}
        ${row('Wastage', s.wastage)}
        <tr class="total"><td>Total Production Cost</td><td>${Utils.money(s.totalProductionCost)}</td></tr>
        <tr class="price"><td>Wholesale Margin</td><td>${Utils.money(s.wholesaleMarginAmount)} <span style="font-weight:400;color:var(--ink-soft);font-size:12.5px;">(${s.wholesaleMargin}%)</span></td></tr>
        <tr class="price"><td>Wholesale Price</td><td>${Utils.money(s.wholesalePrice)} <span style="font-weight:400;color:var(--ink-soft);font-size:12.5px;">(${s.wholesaleMargin}% margin)</span></td></tr>
        <tr class="price"><td>Retail Margin</td><td>${Utils.money(s.retailMarginAmount)} <span style="font-weight:400;color:var(--ink-soft);font-size:12.5px;">(${s.retailMargin}%)</span></td></tr>
        <tr class="price"><td>Retail Price</td><td>${Utils.money(s.retailPrice)} <span style="font-weight:400;color:var(--ink-soft);font-size:12.5px;">(${s.retailMargin}% margin)</span></td></tr>
      </table>
      <div style="display:flex;gap:10px;margin-top:18px;">
        <button class="btn btn-primary" id="pS">Print Summary Report</button>
        <button class="btn btn-ghost" id="eS">Export Summary to Excel</button>
        <button class="btn btn-ghost" id="pD">Print Detailed Report</button>
        <button class="btn btn-ghost" id="eD">Export Detailed to Excel</button>
      </div>
    </div>
  `;
  body.querySelector('#pS').onclick = () => Reports.printSummary(product.id);
  body.querySelector('#eS').onclick = () => ReportsExcel.exportReport(product.id, false);
  body.querySelector('#pD').onclick = () => Reports.printDetailed(product.id);
  body.querySelector('#eD').onclick = () => ReportsExcel.exportReport(product.id, true);
}
