/* WOODLOOK — pages/materials.js */
window.Pages = window.Pages || {};

const MATERIAL_CATEGORIES = ['Wood', 'MDF', 'Plywood', 'Hardware', 'Foam', 'Fabric', 'Paint', 'Polish', 'Other'];
const MATERIAL_UNITS = ['cft', 'sqft', 'kg', 'g', 'litre', 'ml', 'nos', 'set', 'meter', 'roll', 'hour'];

Pages.materials = {
  title: 'Raw Materials',
  _filter: { q: '', cat: '' },

  actions(container) {
    container.innerHTML = `<button class="btn btn-primary" id="btnAddMaterial">+ Add Material</button>`;
    container.querySelector('#btnAddMaterial').onclick = () => openMaterialModal();
  },

  render(container) {
    const self = this;
    container.innerHTML = `
      <div class="search-bar">
        <input type="text" id="matSearch" placeholder="Search by material name..." value="${Utils.escapeHtml(self._filter.q)}" />
        <select id="matCatFilter">
          <option value="">All categories</option>
          ${MATERIAL_CATEGORIES.map((c) => `<option value="${c}" ${self._filter.cat === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="table-wrap"><table class="data" id="matTable">
        <thead><tr><th>Category</th><th>Material Name</th><th>Unit</th><th>Current Rate</th><th>Used In</th><th></th></tr></thead>
        <tbody></tbody>
      </table></div>
      <div id="matEmpty"></div>
    `;

    container.querySelector('#matSearch').oninput = Utils.debounce((e) => {
      self._filter.q = e.target.value;
      self.renderTable(container);
    }, 200);
    container.querySelector('#matCatFilter').onchange = (e) => {
      self._filter.cat = e.target.value;
      self.renderTable(container);
    };

    this.renderTable(container);
  },

  usageCount(materialId) {
    const tables = ['BOM', 'Wood', 'MDF', 'Paint', 'Polish'];
    return tables.reduce((sum, t) => sum + Store.state[t].filter((r) => String(r.materialId) === String(materialId)).length, 0);
  },

  renderTable(container) {
    const q = this._filter.q.trim().toLowerCase();
    const cat = this._filter.cat;
    let rows = Store.state.Materials.filter((m) => {
      if (cat && m.category !== cat) return false;
      if (q && !(`${m.name}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));

    const tbody = container.querySelector('#matTable tbody');
    const empty = container.querySelector('#matEmpty');
    if (!rows.length) {
      tbody.innerHTML = '';
      empty.innerHTML = `<div class="empty-state"><div class="big">&#9878;</div><p>No materials match. Add your first raw material to get started.</p></div>`;
      return;
    }
    empty.innerHTML = '';
    tbody.innerHTML = rows.map((m) => `
      <tr data-id="${m.id}">
        <td><span class="pill ${(m.category || '').toLowerCase()}">${Utils.escapeHtml(m.category || '')}</span></td>
        <td><strong>${Utils.escapeHtml(m.name)}</strong></td>
        <td>${Utils.escapeHtml(m.unit || '')}</td>
        <td>${Utils.money(m.rate)} / ${Utils.escapeHtml(m.unit || 'unit')}</td>
        <td>${this.usageCount(m.id)} product line(s)</td>
        <td class="row-actions">
          <button class="btn btn-sm btn-ghost" data-edit="${m.id}">Edit</button>
          <button class="btn btn-sm btn-danger" data-del="${m.id}">Delete</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => openMaterialModal(Store.indexById('Materials').get(b.dataset.edit)));
    tbody.querySelectorAll('[data-del]').forEach((b) => b.onclick = () => {
      const used = this.usageCount(b.dataset.del);
      const msg = used
        ? `This material is used in ${used} product line(s). Delete anyway? Those lines will show a zero rate until you pick a replacement material.`
        : 'Delete this material?';
      if (confirm(msg)) {
        Store.deleteRow('Materials', b.dataset.del);
        Utils.toast('Material deleted', 'success');
      }
    });
  },
};

function openMaterialModal(existing) {
  const isEdit = !!existing;
  Modal.open({
    title: isEdit ? 'Edit Material' : 'Add Material',
    body: `
      <div class="field"><label>Material Name</label><input id="mName" type="text" value="${Utils.escapeHtml(existing?.name || '')}" placeholder="e.g. Teak Wood 1st Class" /></div>
      <div class="inline-fields">
        <div class="field"><label>Category</label>
          <select id="mCategory">${MATERIAL_CATEGORIES.map((c) => `<option value="${c}" ${existing?.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
        </div>
        <div class="field"><label>Unit</label>
          <select id="mUnit">${MATERIAL_UNITS.map((u) => `<option value="${u}" ${existing?.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field"><label>Current Rate (per unit)</label><input id="mRate" type="number" step="0.01" min="0" value="${existing?.rate ?? ''}" placeholder="0.00" /></div>
      <div class="help-note">Changing this rate later will automatically recalculate every product that uses this material — no manual updates needed.</div>
    `,
    footer: `<button class="btn btn-ghost" id="mCancel">Cancel</button><button class="btn btn-primary" id="mSave">${isEdit ? 'Save Changes' : 'Add Material'}</button>`,
    onMount(modalEl) {
      modalEl.querySelector('#mCancel').onclick = () => Modal.close();
      modalEl.querySelector('#mSave').onclick = () => {
        const name = modalEl.querySelector('#mName').value.trim();
        if (!name) return Utils.toast('Material name is required', 'error');
        const row = {
          id: existing?.id,
          name,
          category: modalEl.querySelector('#mCategory').value,
          unit: modalEl.querySelector('#mUnit').value,
          rate: Number(modalEl.querySelector('#mRate').value) || 0,
        };
        Store.upsertRow('Materials', row);
        Utils.toast(isEdit ? 'Material updated — costs recalculated' : 'Material added', 'success');
        Modal.close();
      };
    },
  });
}
