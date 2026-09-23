# WOODLOOK PRODUCT COSTING

A responsive web app for costing 1000+ furniture products, using a **Google Sheet as
the database**. Raw material rates are centralised — change a rate once and every
product's cost recalculates automatically, with no manual steps.

It runs as plain static files (HTML/CSS/JS, no build step, no server) and works on
PC, mobile and any modern browser.

---

## 1. How it's built (quick overview)

- **Database**: a Google Sheet, with one tab per table (Materials, Products, BOM,
  Wood, MDF, Paint, Polish, Labour).
- **Backend**: a Google Apps Script (`gas/Code.gs`) deployed as a small JSON Web
  App, bound to that Sheet. It's the only thing that talks to the Sheet.
- **Frontend**: this folder (`index.html` + `css/` + `js/`). It calls the Apps
  Script Web App to read/write data.
- **Local cache**: every screen reads from an in-browser IndexedDB cache, so the
  app stays instant even with 1000+ products and works offline. Changes save to
  IndexedDB immediately and sync to the Sheet in the background (queued and
  retried automatically if you're offline or the request fails).
- **Rates are never copied** onto a product. Every BOM/Wood/MDF/Paint/Polish row
  stores a reference to a material; the current rate is looked up live every time
  a cost is calculated. That's what makes "change a rate → every product updates"
  work with zero extra code.

---

## 2. One-time setup: create the Google Sheet database

1. Go to [sheets.google.com](https://sheets.google.com) and create a new,
   blank spreadsheet. Name it anything, e.g. **"Woodlook Costing DB"**.
2. Open **Extensions → Apps Script**.
3. Delete the placeholder `myFunction() {}` code you see there.
4. Open `gas/Code.gs` from this project, copy its entire contents, and paste it
   into the Apps Script editor. Save (Ctrl/Cmd+S).
5. Click **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Description: anything (e.g. "Woodlook API").
   - Execute as: **Me**.
   - Who has access: **Anyone** (this lets the web app call it; the URL itself
     is your private secret — don't share it publicly).
   - Click **Deploy**, then **Authorize access** and approve the permissions
     Google asks for (it needs to edit this one spreadsheet).
6. Copy the **Web app URL** it gives you (looks like
   `https://script.google.com/macros/s/AKfycb.../exec`).
7. The first time you open `doGet`/`doPost` (which happens automatically the
   first time the app connects), the script creates all the required tabs
   (Materials, Products, BOM, Wood, MDF, Paint, Polish, Labour) with headers —
   you don't need to create them by hand.

Keep that Web App URL — you'll paste it into the app's **Settings** page next.

> **Re-deploying later:** if you ever edit `Code.gs` again, use
> **Deploy → Manage deployments → Edit (pencil) → New version** so the same URL
> picks up your changes.

---

## 3. Running the app

### On a PC
No installation needed — it's static files. Two options:
- **Simplest:** double-click `index.html` to open it in your browser.
- **Recommended:** serve it locally so IndexedDB behaves identically to a real
  deployment:
  ```bash
  cd woodlook
  python3 -m http.server 8080
  # then open http://localhost:8080 in your browser
  ```
- **For real use / sharing with your team:** upload the whole `woodlook` folder
  to any static host (GitHub Pages, Netlify, Vercel, Google Sites, a shared
  company web server, etc.). Anyone with the link and a browser can use it —
  the actual data always lives in your Google Sheet, not on that host.

### On mobile
Open the same hosted URL in Chrome/Safari on your phone or tablet. The layout
is responsive: the sidebar collapses into a ☰ menu, tables scroll horizontally,
and forms stack into a single column. Photo upload uses your phone's camera or
gallery automatically (the file picker offers "Camera" on most phones).

### First-time app configuration
1. Open the app → **Settings**.
2. Paste your Apps Script Web App URL → **Save & Test Connection**.
3. The app pulls (currently empty) data from your Sheet. You're ready to add
   Raw Materials and Products.

The app works fully offline before you connect a Sheet, or any time you lose
connection afterwards — everything queues locally and syncs when you're back
online (see the sync dot in the bottom of the sidebar).

---

## 4. Using the app

1. **Raw Materials** — add every material you buy (Wood, MDF, Plywood,
   Hardware, Foam, Fabric, Paint, Polish, Other) with its unit and current
   rate. Edit the rate any time; every product using it recalculates instantly.
2. **Products → + New Product** — enter a code and name, then open it.
3. Inside a product, use the tabs:
   - **Details** — photo (auto-cropped preview, exactly 6cm × 6cm), category,
     margins.
   - **BOM (Other Materials)** — any number of rows for hardware, foam,
     fabric, plywood, etc. Waste % is a percentage of that row's cost.
   - **Wood Calculator** — up to 3 wood sections. You must manually pick the
     wood type for each section you use (never auto-selected). Quantity =
     L × W × B × pieces ÷ 144.
   - **MDF Calculator** — add as many MDF types as needed (4+ supported).
     Quantity = L × W ÷ 144 × sheets.
   - **Paint / Polish** — add one or more rows each.
   - **Labour** — Carpenter / Spray / Polish / Other wages, tracked separately.
   - **Cost Summary** — full breakdown, Wholesale & Retail price, and the
     print buttons.
4. **Reports** — pick any product and print/export the Summary (1 page) or
   Detailed (exactly 2 pages) report. Use your browser's "Save as PDF" print
   destination to export a PDF, or download either report as an Excel `.xlsx`
   workbook. Each detailed workbook is a single, blue-formatted report sheet
   with the product photo and editable Wood, MDF, Paint, Polish, Labour and
   BOM sections; it can be imported back into the app, including the photo.
5. **Backup / Restore** — download a full JSON backup (including photos), or
   restore one. Also includes a **sample data generator** to create 1000+ demo
   products for a real performance test (see §6), and a one-click remover for
   that sample data afterwards.

---

## 5. Pricing formula

`Price = Total Production Cost / (1 − Margin% / 100)`

This treats the margin as a percentage of the **selling price** (the common
retail-costing convention), not a flat markup on cost. If you'd rather use a
simple cost-plus markup (`Price = Cost × (1 + Margin/100)`), change the one
function `priceFromMargin()` in `js/calc.js` — it's isolated there on purpose.

---

## 6. Testing checklist (matches the app's own quality bar)

Everything below can be verified directly in the running app:

- Add a material → open a product using it → confirm its cost line appears.
- Edit that material's rate → reopen the product (or just watch the Cost
  Summary tab) → confirm the cost and prices update immediately.
- Fill all 3 Wood sections and 4+ MDF rows on one product → confirm each
  computes its own quantity/cost correctly.
- Add Paint, Polish, and all 4 Labour types → confirm each totals separately
  and rolls into Total Production Cost.
- Upload a product photo → confirm the 6cm × 6cm preview, and that the same
  photo shows on both the Summary and Detailed print reports.
- Print/export both reports → confirm: Summary is 1 page; Detailed is exactly
  2 pages with a forced page break before the detailed sections; no date,
  time, file path, browser URL, or "WOODLOOK" heading appears anywhere in the
  printed output — only "CODE — NAME".
- Backup → Generate Sample Data (1000) → confirm the Products list stays fast
  to search and page through, then use "Remove All Sample Data" to clean up.

> Note on "exactly 2 pages": the layout is built to fit standard products
> comfortably (a page break is forced right after the summary, and detail
> tables are compact). A product with an unusually large number of BOM/Wood/MDF
> rows could push the detail section past one page — this is a natural paper
> limit, not a bug, and the same discipline (keep BOM rows purposeful) that
> keeps a paper report readable also keeps it to 2 pages.

---

## 7. Project structure

```
woodlook/
├─ index.html            # app shell
├─ css/
│  ├─ style.css          # app design system
│  └─ print.css          # A4 report rules (Summary / Detailed)
├─ js/
│  ├─ utils.js           # helpers (ids, formatting, image compression, toasts)
│  ├─ modal.js           # small reusable dialog
│  ├─ db.js              # IndexedDB cache + offline sync queue
│  ├─ api.js             # client for the Google Apps Script backend
│  ├─ store.js           # in-memory state, single source of truth for the UI
│  ├─ calc.js            # all costing formulas (pure functions, no DOM)
│  ├─ reports.js         # builds Summary/Detailed report HTML + triggers print
│  ├─ app.js             # router + shell wiring + boot sequence
│  └─ pages/             # one file per screen (dashboard, materials, products,
│                         #  productCosting, reportsPage, backup, settings)
└─ gas/
   └─ Code.gs            # paste into Google Apps Script — this is the API/DB layer
```

---

## 8. Limitations & notes

- Photos are stored as compressed base64 JPEGs (resized client-side, usually a
  few tens of KB) directly in the Products sheet/cache — no separate file
  storage needed, and they travel with your JSON backups automatically.
- Google Sheets cells have a size limit (~50,000 characters); the automatic
  photo compression keeps well within that for typical product photos.
- Apps Script web apps have Google-imposed daily quotas on very high-volume
  usage; normal day-to-day costing work for one workshop is well within them.
- This is a from-scratch build, not a hardened multi-tenant SaaS — if several
  people edit the same product at the exact same moment, the last save wins.
