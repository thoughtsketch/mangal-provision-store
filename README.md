# Mangal Provision Super Shop - Free Grocery Ordering Website

This package gives you a zero-deployment-cost ordering system:

- Static website: `index.html`, `styles.css`, `app.js`, `products.js`
- Google Sheet backend through Apps Script: `google-apps-script/Code.gs`
- WhatsApp order message after submission

## How to deploy free

### 1. Create Google Sheet
Create a new Google Sheet named `Mangal Orders`.

### 2. Add Apps Script
In the sheet, go to **Extensions → Apps Script**.
Paste the content of `google-apps-script/Code.gs`.
Run `setupSheet()` once.

### 3. Deploy Apps Script
Go to **Deploy → New deployment → Web app**.
Set:
- Execute as: Me
- Who has access: Anyone

Copy the Web App URL.

### 4. Connect website to Sheet
Open `products.js` and replace:
`PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`
with your deployed Apps Script Web App URL.

### 5. Host website free
Use any one:
- GitHub Pages
- Netlify Drop
- Cloudflare Pages

Upload these files:
- index.html
- styles.css
- app.js
- products.js

## Owner order management
Orders will appear in Google Sheet with:
Timestamp, Order ID, customer details, items, total, notes, and status.

You can add dropdown status values in Sheet manually: New, Confirmed, Packed, Delivered, Cancelled.

## WhatsApp
This uses free click-to-WhatsApp. Customer must click/send manually. Auto-send WhatsApp notifications require WhatsApp Cloud API and are not required for this MVP.
