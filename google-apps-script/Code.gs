const SHEET_NAME = 'Orders';
const HEADERS = ['Timestamp', 'Order ID', 'Name', 'Phone', 'Address', 'Delivery Time', 'Payment', 'Items', 'Total', 'Notes', 'Status'];

/**
 * If the script is NOT container-bound to your Sheet (e.g. copied as standalone),
 * set Script property SPREADSHEET_ID to your Sheet ID from the Sheet URL:
 * https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit
 * Project Settings → Script properties → Add row SPREADSHEET_ID
 */
function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('No spreadsheet. Use Extensions → Apps Script from inside the Orders Sheet, or set SPREADSHEET_ID in Script properties.');
  }
  return ss;
}

function getSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:K1').setFontWeight('bold');
  }
  return sheet;
}

function generateOrderId_() {
  var tz = Session.getScriptTimeZone();
  var stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  var rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'ORD-' + stamp + '-' + rand;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Parse order from raw JSON body or urlencoded form field `order` (browser form POST). */
function parseOrderFromEvent_(e) {
  if (e.parameter && e.parameter.order) {
    return JSON.parse(e.parameter.order);
  }
  if (!e.postData || !e.postData.contents) return null;
  var c = e.postData.contents.trim();
  if (c.charAt(0) === '{') return JSON.parse(c);
  var parts = c.split('&');
  for (var i = 0; i < parts.length; i++) {
    var eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    var key = decodeURIComponent(parts[i].substring(0, eq).replace(/\+/g, ' '));
    if (key === 'order') {
      var val = decodeURIComponent(parts[i].substring(eq + 1).replace(/\+/g, ' '));
      return JSON.parse(val);
    }
  }
  return JSON.parse(c);
}

function isDuplicate_(sheet, orderId) {
  if (!orderId) return false;
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var numRows = last - 1;
  var ids = sheet.getRange(2, 2, numRows, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (ids[i][0] === orderId) return true;
  }
  return false;
}

function doGet() {
  return jsonOut_({
    ok: true,
    service: 'Mangal Provision Orders',
    time: new Date().toISOString()
  });
}

function doPost(e) {
  try {
    var data = parseOrderFromEvent_(e);
    if (!data) {
      return jsonOut_({ ok: false, error: 'No payload' });
    }

    var items = Array.isArray(data.items) ? data.items : [];
    var name = (data.name || '').toString().trim();
    var phone = (data.phone || '').toString().replace(/\D/g, '');
    var address = (data.address || '').toString().trim();

    if (!name || phone.length < 10 || !address || items.length === 0) {
      return jsonOut_({ ok: false, error: 'Invalid order' });
    }

    var sheet = getSheet_();
    var orderId = (data.orderId || '').toString().trim() || generateOrderId_();

    if (isDuplicate_(sheet, orderId)) {
      return jsonOut_({ ok: true, orderId: orderId, duplicate: true });
    }

    var itemsText = items.map(function (i) {
      var qty = Number(i.qty) || 0;
      var price = Number(i.price) || 0;
      return (i.name || '') + ' (' + (i.variant || 'Standard') + ') - ' +
        qty + ' ' + (i.unit || 'kg') + ' x ₹' + price + ' = ₹' + Math.round(qty * price);
    }).join('\n');

    sheet.appendRow([
      new Date(),
      orderId,
      name,
      phone,
      address,
      data.deliveryTime || '',
      data.payment || '',
      itemsText,
      Number(data.total) || 0,
      data.notes || '',
      'New'
    ]);

    return jsonOut_({ ok: true, orderId: orderId });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function setupSheet() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:K1').setFontWeight('bold');
  sheet.autoResizeColumns(1, HEADERS.length);
}
