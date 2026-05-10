const SHEET_NAME = 'Orders';

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  const headers = ['Timestamp','Order ID','Name','Phone','Address','Delivery Time','Payment','Items','Total','Notes','Status'];
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);

  const data = JSON.parse(e.postData.contents);
  const orderId = 'ORD-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const itemsText = (data.items || []).map(function(i) {
    return i.name + ' (' + i.variant + ') - ' + i.qty + ' ' + i.unit + ' x ₹' + i.price + ' = ₹' + Math.round(i.qty * i.price);
  }).join('\n');

  sheet.appendRow([
    new Date(), orderId, data.name, data.phone, data.address,
    data.deliveryTime, data.payment, itemsText, data.total, data.notes || '', 'New'
  ]);

  return ContentService.createTextOutput(JSON.stringify({ ok: true, orderId: orderId }))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  sheet.clear();
  sheet.appendRow(['Timestamp','Order ID','Name','Phone','Address','Delivery Time','Payment','Items','Total','Notes','Status']);
  sheet.setFrozenRows(1);
  sheet.getRange('A1:K1').setFontWeight('bold');
  sheet.autoResizeColumns(1, 11);
}
