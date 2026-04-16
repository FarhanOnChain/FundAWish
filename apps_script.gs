// FundAWish — Google Apps Script Backend
// Deploy as Web App: Execute as Me, Access: Anyone
// The sheet and headers are created automatically — no manual setup needed.

const SHEET_NAME = 'Wishes';
const HEADERS    = ['id','name','text','amount','wallet','x_handle','status','claim_token','created'];
const COLS = { id:1, name:2, text:3, amount:4, wallet:5, x_handle:6, status:7, claim_token:8, created:9 };

// ── Get or create the Wishes sheet with headers ──
function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    // Make header row bold
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }

  return sheet;
}

function generateId() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function rowToObj(row) {
  return {
    id:          String(row[COLS.id - 1]          || ''),
    name:        String(row[COLS.name - 1]        || ''),
    text:        String(row[COLS.text - 1]        || ''),
    amount:      String(row[COLS.amount - 1]      || ''),
    wallet:      String(row[COLS.wallet - 1]      || ''),
    x_handle:    String(row[COLS.x_handle - 1]   || ''),
    status:      String(row[COLS.status - 1]      || 'open'),
    claim_token: String(row[COLS.claim_token - 1] || ''),
    created:     Number(row[COLS.created - 1]     || 0),
  };
}

// ── CORS headers — required for browser fetch() calls ──
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ── Handle OPTIONS preflight ──
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

// ── GET — return all wishes ──
function doGet(e) {
  try {
    const sheet = getSheet();
    const data  = sheet.getDataRange().getValues();
    const wishes = [];

    // Row 0 is headers, skip it
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // skip blank rows
      wishes.push(rowToObj(row));
    }

    // Most recent first
    wishes.sort((a, b) => b.created - a.created);

    return jsonResponse({ success: true, wishes });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ── POST — createWish or updateStatus ──
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheet  = getSheet();

    // ── createWish ──
    if (action === 'createWish') {
      const id          = generateId();
      const claim_token = generateId();
      const now         = Date.now();

      const row = new Array(HEADERS.length).fill('');
      row[COLS.id - 1]          = id;
      row[COLS.name - 1]        = body.name        || 'Anon';
      row[COLS.text - 1]        = body.text        || '';
      row[COLS.amount - 1]      = body.amount      || '';
      row[COLS.wallet - 1]      = body.wallet      || '';
      row[COLS.x_handle - 1]   = body.x_handle    || '';
      row[COLS.status - 1]      = 'open';
      row[COLS.claim_token - 1] = claim_token;
      row[COLS.created - 1]     = now;

      sheet.appendRow(row);

      return jsonResponse({ success: true, id, claim_token, status: 'open' });
    }

    // ── updateStatus ──
    if (action === 'updateStatus') {
      const token     = body.claim_token || '';
      const idToFind  = body.id          || '';
      const newStatus = body.status      || 'open';
      const data      = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        const rowToken = String(data[i][COLS.claim_token - 1] || '');
        const rowId    = String(data[i][COLS.id - 1]          || '');

        if ((token && rowToken === token) || (idToFind && rowId === idToFind)) {
          sheet.getRange(i + 1, COLS.status).setValue(newStatus);
          return jsonResponse({ success: true, status: newStatus });
        }
      }

      return jsonResponse({ success: false, error: 'Wish not found' });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}
