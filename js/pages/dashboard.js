/* WOODLOOK — pages/dashboard.js */
window.Pages = window.Pages || {};

Pages.dashboard = {
  title: 'Dashboard',
  actions(container) {
    container.innerHTML = `<a class="btn btn-primary" href="#/products">+ New Product</a>`;
  },
  render(container) {
    const products = Store.state.Products;
    const materials = Store.state.Materials;

    let totalCost = 0, totalRetail = 0;
    products.forEach((p) => {
      const c = Calc.computeProductCost(p.id).summary;
      totalCost += c.totalProductionCost;
      totalRetail += c.retailPrice;
    });
    const avgCost = products.length ? totalCost / products.length : 0;
    const avgMargin = products.length
      ? products.reduce((a, p) => a + (Number(p.retailMargin) || 0), 0) / products.length
      : 0;

    const catCounts = {};
    materials.forEach((m) => { catCounts[m.category] = (catCounts[m.category] || 0) + 1; });

    container.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card"><div class="label">Products</div><div class="value">${products.length}</div><div class="sub">stored in the sheet</div></div>
        <div class="stat-card"><div class="label">Raw Materials</div><div class="value">${materials.length}</div><div class="sub">across ${Object.keys(catCounts).length} categories</div></div>
        <div class="stat-card"><div class="label">Avg. Production Cost</div><div class="value">${Utils.money(avgCost)}</div><div class="sub">per product</div></div>
        <div class="stat-card"><div class="label">Avg. Retail Margin</div><div class="value">${avgMargin.toFixed(1)}%</div><div class="sub">across all products</div></div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-head"><h3>Quick actions</h3></div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <a class="btn btn-ghost" href="#/materials">&#9878; Manage Raw Materials</a>
            <a class="btn btn-ghost" href="#/products">&#128230; Open Products &amp; Costing</a>
            <a class="btn btn-ghost" href="#/reports">&#128196; Print a Report</a>
            <a class="btn btn-ghost" href="#/backup">&#128190; Backup / Restore Data</a>
            <a class="btn btn-ghost" href="#/settings">&#9881; Connect Google Sheet</a>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Materials by category</h3></div>
          ${Object.keys(catCounts).length ? `
            <table class="summary-table">
              ${Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([cat,count]) => `
                <tr><td>${Utils.escapeHtml(cat)}</td><td>${count}</td></tr>
              `).join('')}
            </table>` : `<p>No materials yet — add some in Raw Materials.</p>`}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h3>How the automatic recalculation works</h3></div>
        <p style="margin:0;">Every BOM, Wood, MDF, Paint and Polish line stores a reference to a raw material — never a copied rate.
        The moment you edit a rate on the <a href="#/materials">Raw Materials</a> page, every product that uses it is recalculated the
        next time you view it, with zero manual steps.</p>
      </div>
    `;
  },
};
