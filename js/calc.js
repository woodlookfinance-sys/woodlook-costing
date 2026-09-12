/* WOODLOOK — calc.js
   Pure calculation engine. Nothing here touches the DOM. Rates always come
   live from the Materials table at calculation time (never copied/cached
   onto a product), which is what makes "change a rate -> every product
   using it updates automatically" true with zero extra bookkeeping. */

const Calc = (() => {
  function materialsMap() {
    const map = new Map();
    Store.state.Materials.forEach((m) => map.set(String(m.id), m));
    return map;
  }

  function rateFor(materialId, mMap) {
    const m = mMap.get(String(materialId));
    return m ? Number(m.rate) || 0 : 0;
  }

  // --- Wood: qty = L x W x B x pieces / 144 (cubic-foot style timber calc) ---
  function computeWoodRow(row, mMap) {
    const rate = rateFor(row.materialId, mMap);
    const qty = (Number(row.length) || 0) * (Number(row.width) || 0) *
      (Number(row.breadth) || 0) * (Number(row.qtyMultiplier) || 0) / 144;
    const cost = qty * rate;
    return { ...row, rate, calcQty: Utils.num(qty, 4), cost: Utils.num(cost, 2) };
  }

  // --- MDF: qty = L x W x sheets (no /144), cost = qty x rate ---
  function computeMdfRow(row, mMap) {
    const rate = rateFor(row.materialId, mMap);
    const qty = (Number(row.length) || 0) * (Number(row.width) || 0) *
      (Number(row.qtyMultiplier) || 0);
    const cost = qty * rate;
    return { ...row, rate, calcQty: Utils.num(qty, 4), cost: Utils.num(cost, 2) };
  }

  // --- Paint / Polish: simple qty x rate ---
  function computeSimpleRow(row, mMap) {
    const rate = rateFor(row.materialId, mMap);
    const cost = (Number(row.quantity) || 0) * rate;
    return { ...row, rate, cost: Utils.num(cost, 2) };
  }

  // --- Generic BOM row: qty x rate, plus waste % of that line's cost ---
  function computeBomRow(row, mMap) {
    const rate = rateFor(row.materialId, mMap);
    const base = (Number(row.quantity) || 0) * rate;
    const wastePct = Number(row.wastePct) || 0;
    const wasteAmount = base * (wastePct / 100);
    const total = base + wasteAmount;
    return { ...row, rate, baseCost: Utils.num(base, 2), wasteAmount: Utils.num(wasteAmount, 2), total: Utils.num(total, 2) };
  }

  function computeLabourRow(row) {
    const total = (Number(row.qty) || 0) * (Number(row.rate) || 0);
    return { ...row, total: Utils.num(total, 2) };
  }

  // Pricing: margin is a straight markup — a percentage of the Total
  // Production Cost, added on top of it. Price = Cost + (Cost x margin/100).
  function priceFromMargin(cost, marginPct) {
    const m = Number(marginPct) || 0;
    return Utils.num(cost + cost * (m / 100), 2);
  }

  function computeProductCost(productId) {
    const mMap = materialsMap();
    const bom = Store.rowsForProduct('BOM', productId).map((r) => computeBomRow(r, mMap));
    const wood = Store.rowsForProduct('Wood', productId).map((r) => computeWoodRow(r, mMap));
    const mdf = Store.rowsForProduct('MDF', productId).map((r) => computeMdfRow(r, mMap));
    const paint = Store.rowsForProduct('Paint', productId).map((r) => computeSimpleRow(r, mMap));
    const polish = Store.rowsForProduct('Polish', productId).map((r) => computeSimpleRow(r, mMap));
    const labour = Store.rowsForProduct('Labour', productId).map(computeLabourRow);

    const materialCost = sum(bom.map((r) => r.baseCost));
    const wastage = sum(bom.map((r) => r.wasteAmount));
    const hardwareCost = sum(bom.filter((r) => r.category === 'Hardware').map((r) => r.total));
    const woodCost = sum(wood.map((r) => r.cost));
    const mdfCost = sum(mdf.map((r) => r.cost));
    const paintCost = sum(paint.map((r) => r.cost));
    const polishCost = sum(polish.map((r) => r.cost));

    const wageByType = (type) => sum(labour.filter((r) => r.type === type).map((r) => r.total));
    const carpenterWage = wageByType('Carpenter');
    const sprayWage = wageByType('Spray');
    const polishWage = wageByType('Polish');
    const otherLabour = wageByType('Other');
    const labourCost = carpenterWage + sprayWage + polishWage + otherLabour;

    const totalProductionCost = materialCost + wastage + woodCost + mdfCost + paintCost + polishCost + labourCost;

    const product = Store.state.Products.find((p) => String(p.id) === String(productId)) || {};
    const retailPrice = priceFromMargin(totalProductionCost, product.retailMargin);
    const wholesalePrice = priceFromMargin(totalProductionCost, product.wholesaleMargin);
    const wholesaleMarginAmount = Utils.num(wholesalePrice - totalProductionCost, 2);
    const retailMarginAmount = Utils.num(retailPrice - totalProductionCost, 2);

    return {
      bom, wood, mdf, paint, polish, labour,
      summary: {
        materialCost: Utils.num(materialCost, 2),
        hardwareCost: Utils.num(hardwareCost, 2),
        woodCost: Utils.num(woodCost, 2),
        mdfCost: Utils.num(mdfCost, 2),
        paintCost: Utils.num(paintCost, 2),
        polishCost: Utils.num(polishCost, 2),
        wastage: Utils.num(wastage, 2),
        carpenterWage: Utils.num(carpenterWage, 2),
        sprayWage: Utils.num(sprayWage, 2),
        polishWage: Utils.num(polishWage, 2),
        otherLabour: Utils.num(otherLabour, 2),
        labourCost: Utils.num(labourCost, 2),
        totalProductionCost: Utils.num(totalProductionCost, 2),
        retailMargin: Number(product.retailMargin) || 0,
        wholesaleMargin: Number(product.wholesaleMargin) || 0,
        retailPrice,
        wholesalePrice,
        wholesaleMarginAmount,
        retailMarginAmount,
      },
    };
  }

  function sum(arr) {
    return arr.reduce((a, b) => a + (Number(b) || 0), 0);
  }

  return { computeProductCost, computeWoodRow, computeMdfRow, computeSimpleRow, computeBomRow, computeLabourRow, priceFromMargin, materialsMap };
})();
