/* WOODLOOK — reports.js
   Renders the Summary report (1 A4 page) and Detailed report (exactly 2 A4
   pages) into #printArea, then triggers window.print(). No date/time,
   file path, URL, or "WOODLOOK" company heading is ever printed — the only
   heading is PRODUCT CODE + PRODUCT NAME, per spec. */

const Reports = (() => {
  function photoBoxHtml(photo) {
    if (photo) {
      return `<div class="photo-box"><img src="${photo}" alt="Product photo" /></div>`;
    }
    return `<div class="photo-box">No photo</div>`;
  }

  function woodSubRowsHtml(woodRows, mMap) {
    if (!woodRows || !woodRows.length) return '';
    return woodRows.map((r) => {
      const name = materialName(r.materialId, mMap);
      const label = `${name} — ${Utils.money(r.rate)}/cft (${r.calcQty || 0} cft)`;
      return `<tr class="sub"><td>${Utils.escapeHtml(label)}</td><td></td></tr>`;
    }).join('');
  }

  function summaryTableHtml(computed, mMap) {
    const s = computed.summary;
    const row = (label, val, cls = '') => `<tr class="${cls}"><td>${Utils.escapeHtml(label)}</td><td>${Utils.money(val)}</td></tr>`;
    return `
      <table class="report-summary">
        ${row('Wood', s.woodCost)}
        ${woodSubRowsHtml(computed.wood, mMap)}
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
        <tr class="price"><td>Wholesale Margin</td><td>${Utils.money(s.wholesaleMarginAmount)} <span style="font-weight:400;color:#5a6c87;">(${s.wholesaleMargin}%)</span></td></tr>
        <tr class="price"><td>Wholesale Price</td><td>${Utils.money(s.wholesalePrice)} <span style="font-weight:400;color:#5a6c87;">(${s.wholesaleMargin}% margin)</span></td></tr>
        <tr class="price"><td>Retail Margin</td><td>${Utils.money(s.retailMarginAmount)} <span style="font-weight:400;color:#5a6c87;">(${s.retailMargin}%)</span></td></tr>
        <tr class="price"><td>Retail Price</td><td>${Utils.money(s.retailPrice)} <span style="font-weight:400;color:#5a6c87;">(${s.retailMargin}% margin)</span></td></tr>
      </table>`;
  }

  function headingBlock(product) {
    return `<div class="report-heading">${Utils.escapeHtml(product.code || '')} &mdash; ${Utils.escapeHtml(product.name || '')}</div>`;
  }

  function buildSummaryHtml(product, computed) {
    const mMap = Calc.materialsMap();
    return `
      <div class="report-page">
        ${headingBlock(product)}
        <div class="report-photo-wrap">${photoBoxHtml(product.photo)}</div>
        <div class="report-section-title">Cost Summary</div>
        ${summaryTableHtml(computed, mMap)}
      </div>`;
  }

  function bomTableHtml(rows, mMap) {
    if (!rows.length) return '<p style="color:#5a6c87;font-size:9.5pt;">No rows.</p>';
    return `
      <table class="report-table">
        <thead><tr><th>Category</th><th>Material</th><th class="num">Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Waste %</th><th class="num">Waste Amt</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td>${Utils.escapeHtml(r.category || '')}</td>
            <td>${Utils.escapeHtml(materialName(r.materialId, mMap))}</td>
            <td class="num">${r.quantity || 0}</td>
            <td>${Utils.escapeHtml(r.unit || '')}</td>
            <td class="num">${Utils.money(r.rate)}</td>
            <td class="num">${r.wastePct || 0}%</td>
            <td class="num">${Utils.money(r.wasteAmount)}</td>
            <td class="num">${Utils.money(r.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function woodTableHtml(rows, mMap) {
    if (!rows.length) return '<p style="color:#5a6c87;font-size:9.5pt;">No wood used.</p>';
    return `
      <table class="report-table">
        <thead><tr><th>Wood Type</th><th class="num">L</th><th class="num">W</th><th class="num">B</th><th class="num">Pcs</th><th class="num">Qty (cft)</th><th class="num">Rate</th><th class="num">Cost</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td>${Utils.escapeHtml(materialName(r.materialId, mMap))}</td>
            <td class="num">${r.length || 0}</td>
            <td class="num">${r.width || 0}</td>
            <td class="num">${r.breadth || 0}</td>
            <td class="num">${r.qtyMultiplier || 0}</td>
            <td class="num">${r.calcQty || 0}</td>
            <td class="num">${Utils.money(r.rate)}</td>
            <td class="num">${Utils.money(r.cost)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function mdfTableHtml(rows, mMap) {
    if (!rows.length) return '<p style="color:#5a6c87;font-size:9.5pt;">No MDF used.</p>';
    return `
      <table class="report-table">
        <thead><tr><th>MDF Type</th><th class="num">L</th><th class="num">W</th><th class="num">Sheets</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Cost</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td>${Utils.escapeHtml(materialName(r.materialId, mMap))}</td>
            <td class="num">${r.length || 0}</td>
            <td class="num">${r.width || 0}</td>
            <td class="num">${r.qtyMultiplier || 0}</td>
            <td class="num">${r.calcQty || 0}</td>
            <td class="num">${Utils.money(r.rate)}</td>
            <td class="num">${Utils.money(r.cost)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function simpleTableHtml(rows, mMap, label) {
    if (!rows.length) return `<p style="color:#5a6c87;font-size:9.5pt;">No ${label.toLowerCase()} used.</p>`;
    return `
      <table class="report-table">
        <thead><tr><th>${label} Type</th><th class="num">Qty</th><th>Unit</th><th class="num">Rate</th><th class="num">Cost</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td>${Utils.escapeHtml(materialName(r.materialId, mMap))}</td>
            <td class="num">${r.quantity || 0}</td>
            <td>${Utils.escapeHtml(r.unit || '')}</td>
            <td class="num">${Utils.money(r.rate)}</td>
            <td class="num">${Utils.money(r.cost)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function labourTableHtml(rows) {
    if (!rows.length) return '<p style="color:#5a6c87;font-size:9.5pt;">No labour recorded.</p>';
    return `
      <table class="report-table">
        <thead><tr><th>Type</th><th class="num">Hours/Qty</th><th class="num">Rate</th><th class="num">Total</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td>${Utils.escapeHtml(r.type || '')}</td>
            <td class="num">${r.qty || 0}</td>
            <td class="num">${Utils.money(r.rate)}</td>
            <td class="num">${Utils.money(r.total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function materialName(id, mMap) {
    const m = mMap.get(String(id));
    return m ? m.name : '—';
  }

  function buildDetailedHtml(product, computed) {
    const mMap = Calc.materialsMap();
    return `
      <div class="report-page">
        ${headingBlock(product)}
        <div class="report-photo-wrap">${photoBoxHtml(product.photo)}</div>
        <div class="report-section-title">Cost Summary</div>
        ${summaryTableHtml(computed, mMap)}
      </div>
      <div class="report-page page-break">
        <div class="report-section-title" style="margin-top:0;">Wood</div>
        ${woodTableHtml(computed.wood, mMap)}
        <div class="report-section-title">MDF</div>
        ${mdfTableHtml(computed.mdf, mMap)}
        <div class="report-section-title">Paint</div>
        ${simpleTableHtml(computed.paint, mMap, 'Paint')}
        <div class="report-section-title">Polish</div>
        ${simpleTableHtml(computed.polish, mMap, 'Polish')}
        <div class="report-section-title">Labour</div>
        ${labourTableHtml(computed.labour)}
        <div class="report-section-title">BOM (Other)</div>
        ${bomTableHtml(computed.bom, mMap)}
      </div>`;
  }

  function printSummary(productId) {
    const product = Store.state.Products.find((p) => String(p.id) === String(productId));
    if (!product) return Utils.toast('Product not found', 'error');
    const computed = Calc.computeProductCost(productId);
    document.getElementById('printArea').innerHTML = buildSummaryHtml(product, computed);
    requestAnimationFrame(() => window.print());
  }

  function printDetailed(productId) {
    const product = Store.state.Products.find((p) => String(p.id) === String(productId));
    if (!product) return Utils.toast('Product not found', 'error');
    const computed = Calc.computeProductCost(productId);
    document.getElementById('printArea').innerHTML = buildDetailedHtml(product, computed);
    requestAnimationFrame(() => window.print());
  }

  return { printSummary, printDetailed };
})();
