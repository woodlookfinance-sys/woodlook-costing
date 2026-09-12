/* WOODLOOK — pages/reportsPage.js */
window.Pages = window.Pages || {};

Pages.reports = {
  title: 'Reports',
  _q: '',

  actions(container) { container.innerHTML = ''; },

  render(container) {
    const self = this;
    container.innerHTML = `
      <div class="card">
        <div class="card-head"><h3>Print a Report</h3></div>
        <p>Pick a product, then choose which report to generate. Both open your browser's print dialog — choose "Save as PDF" as the destination for a PDF export.</p>
        <div class="field"><label>Find Product</label><input id="repSearch" type="text" placeholder="Search by code or name..." /></div>
        <div id="repResults"></div>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <h3>Summary Report</h3>
          <p>One A4 page: Product Code + Name, Photo (6cm × 6cm), and the Cost Summary only.</p>
        </div>
        <div class="card">
          <h3>Detailed Report</h3>
          <p>Exactly two A4 pages: Page 1 is the summary; Page 2 is the full Wood, MDF, Paint, Polish, Labour and BOM breakdown.</p>
        </div>
      </div>
    `;
    container.querySelector('#repSearch').oninput = Utils.debounce((e) => {
      self._q = e.target.value;
      self.renderResults(container);
    }, 200);
    this.renderResults(container);
  },

  renderResults(container) {
    const q = this._q.trim().toLowerCase();
    const results = q
      ? Store.state.Products.filter((p) => `${p.code} ${p.name}`.toLowerCase().includes(q)).slice(0, 25)
      : Store.state.Products.slice(0, 10);
    const host = container.querySelector('#repResults');
    if (!results.length) {
      host.innerHTML = `<p class="hint">No products found.</p>`;
      return;
    }
    host.innerHTML = `<div class="table-wrap"><table class="data">
      <thead><tr><th>Code</th><th>Name</th><th></th></tr></thead>
      <tbody>${results.map((p) => `
        <tr>
          <td>${Utils.escapeHtml(p.code || '')}</td>
          <td>${Utils.escapeHtml(p.name || '')}</td>
          <td class="row-actions">
            <button class="btn btn-sm btn-primary" data-sum="${p.id}">Print Summary</button>
            <button class="btn btn-sm btn-ghost" data-det="${p.id}">Print Detailed</button>
          </td>
        </tr>`).join('')}</tbody>
    </table></div>`;
    host.querySelectorAll('[data-sum]').forEach((b) => b.onclick = () => Reports.printSummary(b.dataset.sum));
    host.querySelectorAll('[data-det]').forEach((b) => b.onclick = () => Reports.printDetailed(b.dataset.det));
  },
};
