const SHEET_NAME = 'Orders';
const HEADERS = ['Timestamp', 'Order ID', 'Name', 'Phone', 'Address', 'Delivery Time', 'Payment', 'Items', 'Total', 'Notes', 'Status'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:K1').setFontWeight('bold');
  }
  return sheet;
}

function generateOrderId_() {
  const tz = Session.getScriptTimeZone();
  const stamp = Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return 'ORD-' + stamp + '-' + rand;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function isDuplicate_(sheet, orderId) {
  if (!orderId) return false;
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const ids = sheet.getRange(2, 2, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
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
    if (!e || !e.postData || !e.postData.contents) {
      return jsonOut_({ ok: false, error: 'No payload' });
    }

    const data = JSON.parse(e.postData.contents);

    const items = Array.isArray(data.items) ? data.items : [];
    const name = (data.name || '').toString().trim();
    const phone = (data.phone || '').toString().replace(/\D/g, '');
    const address = (data.address || '').toString().trim();

    if (!name || phone.length < 10 || !address || items.length === 0) {
      return jsonOut_({ ok: false, error: 'Invalid order' });
    }

    const sheet = getSheet_();
    const orderId = (data.orderId || '').toString().trim() || generateOrderId_();

    if (isDuplicate_(sheet, orderId)) {
      return jsonOut_({ ok: true, orderId: orderId, duplicate: true });
    }

    const itemsText = items.map(function (i) {
      const qty = Number(i.qty) || 0;
      const price = Number(i.price) || 0;
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
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clear();
  sheet.appendRow(HEADERS);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:K1').setFontWeight('bold');
  sheet.autoResizeColumns(1, HEADERS.length);
}
