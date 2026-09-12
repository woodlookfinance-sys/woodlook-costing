/**
 * WOODLOOK PRODUCT COSTING — Google Sheets backend
 * ---------------------------------------------------
 * Deploy this file as a Google Apps Script Web App bound to a Google Sheet.
 * It exposes a tiny JSON API (doGet / doPost) that the front-end (index.html)
 * talks to. The Google Sheet is the database — every sheet/tab below is a table.
 *
 * SHEETS (tabs) THIS SCRIPT MANAGES — created automatically on first run:
 *   Materials  : id, name, category, unit, rate, updatedAt
 *   Products   : id, code, name, photo, retailMargin, wholesaleMargin, notes, updatedAt
 *   BOM        : id, productId, category, materialId, quantity, unit, wastePct
 *   Wood       : id, productId, slot, materialId, length, width, breadth, qtyMultiplier
 *   MDF        : id, productId, slot, materialId, length, width, qtyMultiplier
 *   Paint      : id, productId, materialId, quantity, unit
 *   Polish     : id, productId, materialId, quantity, unit
 *   Labour     : id, productId, type, qty, rate
 *
 * Rates for Wood/MDF/Paint/Polish/BOM always come from Materials at read time —
 * only quantities/config are stored per product, so changing a Materials rate
 * instantly affects every product that uses it (no per-product row to update).
 *
 * SETUP
 *   1. Create a new Google Sheet (any name, e.g. "Woodlook Costing DB").
 *   2. Extensions > Apps Script. Delete the sample code, paste this whole file in.
 *   3. Click Deploy > New deployment > Select type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone (or "Anyone with the link")
 *   4. Copy the Web app URL it gives you.
 *   5. Paste that URL into js/api.js -> API_URL, or into the app's Settings screen.
 */

// ------------------------------------------------------------------
// Schema definition
// ------------------------------------------------------------------
var SHEETS = {
  Materials: ['id', 'name', 'category', 'unit', 'rate', 'updatedAt'],
  Products:  ['id', 'code', 'name', 'photo', 'retailMargin', 'wholesaleMargin', 'notes', 'updatedAt'],
  BOM:       ['id', 'productId', 'category', 'materialId', 'quantity', 'unit', 'wastePct'],
  Wood:      ['id', 'productId', 'slot', 'materialId', 'length', 'width', 'breadth', 'qtyMultiplier'],
  MDF:       ['id', 'productId', 'slot', 'materialId', 'length', 'width', 'qtyMultiplier'],
  Paint:     ['id', 'productId', 'materialId', 'quantity', 'unit'],
  Polish:    ['id', 'productId', 'materialId', 'quantity', 'unit'],
  Labour:    ['id', 'productId', 'type', 'qty', 'rate']
};

function getSS_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheets_() {
  var ss = getSS_();
  Object.keys(SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
    } else if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
    }
  });
  // remove default "Sheet1" if empty and unused
  var def = ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() <= 1 && ss.getSheets().length > 1) {
    var isKnown = false;
    // keep if it happens to be one of our sheets already
    Object.keys(SHEETS).forEach(function (n) { if (n === 'Sheet1') isKnown = true; });
    if (!isKnown) ss.deleteSheet(def);
  }
}

function sheetToObjects_(name) {
  var sh = getSS_().getSheetByName(name);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (row.join('') === '') continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) obj[headers[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function findRowById_(sh, headers, id) {
  var idCol = headers.indexOf('id');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return -1;
  var ids = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 1-indexed, +1 for header
  }
  return -1;
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
function doGet(e) {
  ensureSheets_();
  var action = (e.parameter.action || 'getAll');
  var result;
  if (action === 'getAll') {
    result = { ok: true, data: {} };
    Object.keys(SHEETS).forEach(function (name) {
      result.data[name] = sheetToObjects_(name);
    });
  } else if (action === 'ping') {
    result = { ok: true, message: 'Woodlook backend is alive' };
  } else {
    result = { ok: false, error: 'Unknown GET action: ' + action };
  }
  return jsonOut_(result);
}

function doPost(e) {
  ensureSheets_();
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Bad JSON body' });
  }

  var action = body.action;
  var sheetName = body.sheet;
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (!SHEETS[sheetName]) {
      return jsonOut_({ ok: false, error: 'Unknown sheet: ' + sheetName });
    }
    var sh = getSS_().getSheetByName(sheetName);
    var headers = SHEETS[sheetName];

    if (action === 'upsert') {
      var row = body.row || {};
      if (!row.id) row.id = Utilities.getUuid();
      row.updatedAt = new Date().toISOString();
      var rIdx = findRowById_(sh, headers, row.id);
      var values = headers.map(function (h) { return (row[h] === undefined || row[h] === null) ? '' : row[h]; });
      if (rIdx === -1) {
        sh.appendRow(values);
      } else {
        sh.getRange(rIdx, 1, 1, headers.length).setValues([values]);
      }
      return jsonOut_({ ok: true, row: row });
    }

    if (action === 'bulkUpsert') {
      var rows = body.rows || [];
      var now = new Date().toISOString();
      // Build an id->rowIndex map once for speed
      var lastRow = sh.getLastRow();
      var idCol = headers.indexOf('id');
      var idMap = {};
      if (lastRow >= 2) {
        var ids = sh.getRange(2, idCol + 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) idMap[String(ids[i][0])] = i + 2;
      }
      var appended = [];
      rows.forEach(function (row) {
        if (!row.id) row.id = Utilities.getUuid();
        row.updatedAt = now;
        var values = headers.map(function (h) { return (row[h] === undefined || row[h] === null) ? '' : row[h]; });
        var idx = idMap[String(row.id)];
        if (idx) {
          sh.getRange(idx, 1, 1, headers.length).setValues([values]);
        } else {
          appended.push(values);
        }
      });
      if (appended.length) {
        sh.getRange(sh.getLastRow() + 1, 1, appended.length, headers.length).setValues(appended);
      }
      return jsonOut_({ ok: true, count: rows.length });
    }

    if (action === 'delete') {
      var id = body.id;
      var idx = findRowById_(sh, headers, id);
      if (idx > -1) sh.deleteRow(idx);
      return jsonOut_({ ok: true });
    }

    return jsonOut_({ ok: false, error: 'Unknown POST action: ' + action });
  } finally {
    lock.releaseLock();
  }
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
