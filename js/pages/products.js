/* WOODLOOK — pages/products.js */
window.Pages = window.Pages || {};

const PRODUCT_CATEGORIES = ['Sofa', 'Chair', 'Bed', 'Table', 'Wardrobe', 'Storage Unit', 'TV Unit', 'Dining Set', 'Office Furniture', 'Other'];
const PAGE_SIZE = 50;

Pages.products = {
  title: 'Products',
  _filter: { q: '', cat: '' },
  _page: 1,

  actions(container) {
    container.innerHTML = `<button class="btn btn-primary" id="btnAddProduct">+ New Product</button>`;
    container.querySelector('#btnAddProduct').onclick = () => openProductQuickCreate();
  },

  render(container) {
    const self = this;
    container.innerHTML = `
      <div class="search-bar">
        <input type="text" id="prodSearch" placeholder="Search by product code or name..." value="${Utils.escapeHtml(self._filter.q)}" />
        <select id="prodCatFilter">
          <option value="">All categories</option>
          ${PRODUCT_CATEGORIES.map((c) => `<option value="${c}" ${self._filter.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data" id="prodTable">
        <thead><tr><th></th><th>Code</th><th>Name</th><th>Category</th><th>Total Cost</th><th>Wholesale</th><th>Retail</th><th></th></tr></thead>
        <tbody></tbody>
      </table></div>
      <div id="prodEmpty"></div>
      <div class="pagination" id="prodPagination"></div>
    `;

    container.querySelector('#prodSearch').oninput = Utils.debounce((e) => {
      self._filter.q = e.target.value;
      self._page = 1;
      self.renderTable(container);
    }, 200);
    container.querySelector('#prodCatFilter').onchange = (e) => {
      self._filter.cat = e.target.value;
      self._page = 1;
      self.renderTable(container);
    };

    this.renderTable(container);
  },

  filteredProducts() {
    const q = this._filter.q.trim().toLowerCase();
    const cat = this._filter.cat;
    return Store.state.Products.filter((p) => {
      if (cat && p.category !== cat) return false;
      if (q && !(`${p.code} ${p.name}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  },

  renderTable(container) {
    const all = this.filteredProducts();
    const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
    this._page = Math.min(this._page, totalPages);
    const pageRows = all.slice((this._page - 1) * PAGE_SIZE, this._page * PAGE_SIZE);

    const tbody = container.querySelector('#prodTable tbody');
    const empty = container.querySelector('#prodEmpty');
    if (!all.length) {
      tbody.innerHTML = '';
      empty.innerHTML = `<div class="empty-state"><div class="big">&#128230;</div><p>No products yet. Click "+ New Product" to add your first one.</p></div>`;
      container.querySelector('#prodPagination').innerHTML = '';
      return;
    }
    empty.innerHTML = '';

    tbody.innerHTML = pageRows.map((p) => {
      const c = Calc.computeProductCost(p.id).summary;
      return `
      <tr data-id="${p.id}">
        <td>${p.photo ? `<img class="thumb" src="${p.photo}" />` : `<div class="thumb"></div>`}</td>
        <td><strong>${Utils.escapeHtml(p.code || '')}</strong></td>
        <td><a class="product-report-link" href="#/product-report/${p.id}">${Utils.escapeHtml(p.name || '')}</a></td>
        <td>${p.category ? `<span class="pill">${Utils.escapeHtml(p.category)}</span>` : ''}</td>
        <td>${Utils.money(c.totalProductionCost)}</td>
        <td>${Utils.money(c.wholesalePrice)}</td>
        <td>${Utils.money(c.retailPrice)}</td>
        <td class="row-actions">
          <a class="btn btn-sm btn-primary" href="#/product-report/${p.id}">View Report</a>
        </td>
      </tr>`;
    }).join('');

    const pager = container.querySelector('#prodPagination');
    pager.innerHTML = `
      <button class="btn btn-sm btn-ghost" id="pgPrev" ${this._page <= 1 ? 'disabled' : ''}>&larr; Prev</button>
      <span>Page ${this._page} of ${totalPages} &middot; ${all.length} product(s)</span>
      <button class="btn btn-sm btn-ghost" id="pgNext" ${this._page >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
    `;
    const prevBtn = pager.querySelector('#pgPrev');
    const nextBtn = pager.querySelector('#pgNext');
    if (prevBtn) prevBtn.onclick = () => { this._page--; this.renderTable(container); };
    if (nextBtn) nextBtn.onclick = () => { this._page++; this.renderTable(container); };
  },
};

function duplicateProduct(id) {
  const src = Store.state.Products.find((p) => String(p.id) === String(id));
  if (!src) return;
  const newId = Utils.uuid();
  const clone = { ...src, id: newId, code: src.code + '-COPY', name: src.name + ' (Copy)' };
  Store.upsertRow('Products', clone);
  ['BOM', 'Wood', 'MDF', 'Paint', 'Polish', 'Labour'].forEach((t) => {
    Store.rowsForProduct(t, id).forEach((r) => {
      Store.upsertRow(t, { ...r, id: Utils.uuid(), productId: newId });
    });
  });
  Utils.toast('Product duplicated', 'success');
  location.hash = `#/product/${newId}`;
}

function openProductQuickCreate() {
  Modal.open({
    title: 'New Product',
    body: `
      <div class="field"><label>Product Code</label><input id="qCode" type="text" placeholder="e.g. SF-1042" /></div>
      <div class="field"><label>Product Name</label><input id="qName" type="text" placeholder="e.g. 3-Seater Chesterfield Sofa" /></div>
      <div class="field"><label>Category</label>
        <select id="qCat"><option value="">— None —</option>${PRODUCT_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('')}</select>
      </div>
    `,
    footer: `<button class="btn btn-ghost" id="qCancel">Cancel</button><button class="btn btn-primary" id="qCreate">Create &amp; Open</button>`,
    onMount(modalEl) {
      modalEl.querySelector('#qCancel').onclick = () => Modal.close();
      modalEl.querySelector('#qCreate').onclick = () => {
        const code = modalEl.querySelector('#qCode').value.trim();
        const name = modalEl.querySelector('#qName').value.trim();
        if (!code || !name) return Utils.toast('Product code and name are required', 'error');
        const row = Store.upsertRow('Products', {
          code, name,
          category: modalEl.querySelector('#qCat').value,
          retailMargin: 40, wholesaleMargin: 20, photo: '',
        });
        Modal.close();
        location.hash = `#/product/${row.id}`;
      };
    },
  });
}
