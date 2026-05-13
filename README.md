# Mangal Provision Super Shop — Free Grocery Ordering Website

A zero-infrastructure, mobile-first ordering site for a local grocery / dry-fruits store.
Customer places an order → row appears in **Google Sheet** → **WhatsApp** opens with a prefilled order message for the owner.

- Static site: `index.html`, `styles.css`, `app.js`, `products.js`, `catalog.json`
- Backend: Google Apps Script (`google-apps-script/Code.gs`)
- Storage: Google Sheet
- **Primary deployment:** [Netlify](https://www.netlify.com/) — GitHub-connected site + serverless **`save-order`** function for reliable order POSTs to Apps Script. Example: `https://mangal-provision-store.netlify.app/`
- Other free options (§3): GitHub Pages, Cloudflare Pages, Netlify Drop

---

## 1. Run locally

No build step. Any static server works.

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Until you set **`appsScriptUrl`** in `products.js` (§2) — and on Netlify **`APPS_SCRIPT_WEBAPP_URL`** (§3) if you use the proxy — the order button will skip the Sheet save and only open WhatsApp.

---

## 2. Set up Google Sheet + Apps Script (one-time)

1. Create a Google Sheet (any name, e.g. `Mangal Orders`).
2. In the sheet: **Extensions → Apps Script**.
3. Replace `Code.gs` content with the contents of `google-apps-script/Code.gs` from this repo. Save.
4. Run the function `setupSheet` once (top toolbar → select `setupSheet` → Run). Authorize when prompted.
5. **Deploy → New deployment → Web app**:
   - Description: `Mangal Orders`
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the **Web app URL**.

### Connect the website (set `appsScriptUrl`)

The repo ships with a **placeholder** in `products.js` so your real Web App URL is **not** committed to Git (treat the `/exec` URL like a secret).

1. Open **`products.js`** in the project root.
2. Set **`appsScriptUrl`** to the Web app URL you copied in step 6 (must end with **`/exec`**):

```js
window.SHOP_CONFIG = {
  // ...
  appsScriptUrl: 'PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE', // ← replace with your real URL
  // ...
};
```

3. If you deploy on **Netlify**, add the **same** string as **`APPS_SCRIPT_WEBAPP_URL`** (§3, step 2). The storefront and the `save-order` function both need that value; leaving the placeholder in `products.js` disables Sheet saves even when the env var is set.

### Health check (optional)

Open the Web app URL in a browser. You should see:

```json
{ "ok": true, "service": "Mangal Provision Orders", "time": "..." }
```

### Script not bound to the Sheet?

If you created the project at [script.google.com](https://script.google.com) instead of **Extensions → Apps Script** inside the spreadsheet, `getActiveSpreadsheet()` has nothing to attach to.

Fix: in Apps Script, **Project Settings → Script properties** → add a property:

- **Property:** `SPREADSHEET_ID`  
- **Value:** the ID from your Sheet URL  
  `https://docs.google.com/spreadsheets/d/<THIS_PART>/edit`

Save, then **Deploy → Manage deployments → New version → Deploy** (or edit deployment and pick a new version).

### Orders not appearing in the Sheet?

Google’s Web App URL returns **302 redirects**. In the browser, **`fetch()` often turns the follow-up into GET**, so `doPost` never receives your JSON.

**On Netlify:** set **`APPS_SCRIPT_WEBAPP_URL`** (see §3). The storefront calls **`/.netlify/functions/save-order`**, which forwards the JSON using **Node** (redirects + POST body behave correctly). On **`*.netlify.app`** this is automatic; on a **custom domain** set `"orderProxyUrl": "/.netlify/functions/save-order"` in `products.js`.

**Fallback:** hidden **form POST** into an iframe (`formPostToSheet_` in `app.js`). If the sheet is still empty, use **Executions** in Apps Script and **`?sheetdebug=1`** (see “Debug blank Orders sheet” above).

After changing `Code.gs`, republish a **new deployment version** in Apps Script.

### Debug blank `Orders` sheet

1. **Apps Script → Executions** — open the latest run after you click *Place My Order*. If `doPost` throws (e.g. no spreadsheet), the error appears there.
2. **Script bound to the Sheet?** Open the script via **Extensions → Apps Script** on the same file that has the `Orders` tab. If the project was created at script.google.com, set **`SPREADSHEET_ID`** (see above).
3. **Browser console** — add `?sheetdebug=1` to your site URL or run `localStorage.setItem('mangalSheetDebug','1')` and reload. Submit an order; logs show whether the **Netlify proxy** or **form fallback** ran and the proxy HTTP status.
4. **Network tab** — filter **All** (not only Fetch/XHR). Look for `save-order` (Netlify) or **POST** to `script.google.com`.

---

## 3. Deploy (Netlify is primary; alternatives below)

**This repo targets Netlify first** (`netlify.toml`, `netlify/functions/save-order.mjs`). Other hosts serve the static files fine, but **order → Google Sheet** needs either Netlify’s proxy or the browser form fallback (see §2).

### Netlify (recommended — Git + order proxy)

This is the **default / production** setup for this project.

1. **Create the site:** In [Netlify](https://app.netlify.com) → **Add new site → Import an existing project** → connect this GitHub repo.  
   - **Build command:** leave empty (static files only).  
   - **Publish directory:** `/` (repository root), or `.` depending on the UI — the folder that contains `index.html`, `netlify.toml`, and `netlify/functions/`.

2. **Environment variable (required for orders → Sheet):**  
   - Open the site → **Site configuration** (gear) → **Environment variables** (under *Build & deploy* or *General* depending on Netlify UI version).  
   - **Add a variable** (or *Add a single variable*):  
     - **Key:** `APPS_SCRIPT_WEBAPP_URL`  
     - **Value:** paste your Apps Script **Web app** URL here — the full `/exec` URL from **Deploy → Manage deployments** (same value you set for **`appsScriptUrl`** in `products.js`; see §2).  
   - **Scopes:** choose **All deploy contexts** *or* at minimum **Production** so the live site sees it.  
   - **Save.**

   Also update **`appsScriptUrl`** in `products.js` to that same URL before you push/deploy the static site, or orders will not POST to the Sheet (the placeholder is intentional for public repos).

3. **Redeploy:** After adding or changing env vars, trigger a new deploy so functions pick them up: **Deploys → Trigger deploy → Deploy site**, or push a commit to `main`. Optionally use **Clear cache and deploy site** if behaviour looks stale.

4. **Local Netlify dev:** With [Netlify CLI](https://docs.netlify.com/cli/get-started/), run `netlify link` then `netlify dev`. Env vars can be loaded from the linked site or a root `.env` file (see Netlify docs); `APPS_SCRIPT_WEBAPP_URL` must be set for `save-order` to work locally.

The storefront calls **`/.netlify/functions/save-order`**, which forwards the order JSON to Apps Script using **Node** (handles Google’s **302 redirects** correctly). On **`*.netlify.app`** the app uses this proxy automatically. If you use a **custom domain**, set in `products.js`:

```js
"orderProxyUrl": "/.netlify/functions/save-order"
```

### Netlify Drop (fastest — drag & drop)

1. Go to <https://app.netlify.com/drop>.
2. Drag the **project folder** in.
3. Still add **`APPS_SCRIPT_WEBAPP_URL`** under site settings if you need the order proxy (Drop sites support env vars after creation). Edit **`appsScriptUrl`** in `products.js` to the same URL before zipping/uploading, or Sheet saves will stay disabled.
4. Netlify gives you a public URL.

### GitHub Pages

```bash
git push -u origin main
```

In your GitHub repo: **Settings → Pages → Deploy from branch → `main` / root → Save.**
Site goes live at `https://<user>.github.io/<repo>/`.

### Cloudflare Pages

1. <https://pages.cloudflare.com> → **Create project → Connect to Git**.
2. Build command: *(leave empty)*. Output directory: `/`.
3. Deploy.

---

## 4. How orders flow

1. Customer fills name / phone / address, picks products with `−  qty  +`.
2. Clicks **Place My Order**.
3. Site generates a client-side **Order ID** (`ORD-YYYYMMDD-HHMMSS-XXXX`).
4. POSTs the order JSON to Apps Script → row appended to the `Orders` sheet.
5. Opens `wa.me` with the prefilled order message (including the same Order ID).
6. Owner sees the order on **WhatsApp** and in the **Sheet**.

If the Sheet save fails (offline, quota, etc.) WhatsApp still opens — order never gets lost.

The Apps Script is **idempotent** on Order ID: a duplicate POST with the same Order ID does not create a second row.

---

## 5. Sheet columns

`Timestamp · Order ID · Name · Phone · Address · Delivery Time · Payment · Items · Total · Notes · Status`

Add a data-validation dropdown to the **Status** column manually with values like:
`New, Confirmed, Packed, Out for delivery, Delivered, Cancelled`.

---

## 6. Configuration (`products.js`)

```js
window.SHOP_CONFIG = {
  shopName: "Mangal Provision Super Shop",
  ownerWhatsApp: "919403393688",      // country code, no +, no spaces
  alternatePhone: "+91 88052 65233",
  location: "Pune, Maharashtra",
  appsScriptUrl: "…",                 // Web App /exec URL (set in your clone; not committed in this repo’s default)
  orderProxyUrl: "",                  // optional; use "/.netlify/functions/save-order" on Netlify custom domain
  catalogUrl: "catalog.json"          // optional; path to product catalog JSON
};
```

On Netlify, set **`APPS_SCRIPT_WEBAPP_URL`** to the **same** value as **`appsScriptUrl`** so the `save-order` function can forward orders. The default **`products.js`** in this repo uses a placeholder so the Web App URL is not stored in Git; for your live site, set **`appsScriptUrl`** in the file you actually deploy (or maintain a private fork) to match **`APPS_SCRIPT_WEBAPP_URL`**.

The product catalog lives in **`catalog.json`** (same folder as `index.html` by default). `products.js` loads it with a synchronous request and sets **`window.CATALOG`**. Deploy **`catalog.json`** next to your HTML; use **`catalogUrl`** in config only if the file lives elsewhere.

**Note:** opening `index.html` directly from disk (`file://`) may block loading `catalog.json`; use a local static server (`python3 -m http.server`) or your deployed URL.

---

## 7. Why this stack

- Vanilla JS, no framework, no build → loads fast on cheap Android phones.
- Google Sheet = free database + free admin UI for the owner.
- WhatsApp = the channel customers and the owner already trust.
- All hosting options above are free and require no server.

---

## 8. Future upgrades (not now)

- Order status tracking via owner-only page.
- UPI deep link / Razorpay.
- PDF invoice generation in Apps Script.
- Inventory + analytics in additional Sheet tabs.

The current architecture supports these without rewrites.
