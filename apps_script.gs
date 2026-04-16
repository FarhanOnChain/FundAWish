// FundAWish — Google Apps Script Backend
// Deploy as Web App: Execute as Me, Access: Anyone
// Sheet name: Wishes
// Columns: id | name | text | amount | wallet | x_handle | status | claim_token | created

const SHEET_NAME = 'Wishes';
const COLS = { id:1, name:2, text:3, amount:4, wallet:5, x_handle:6, status:7, claim_token:8, created:9 };

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function generateId() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}

function rowToObj(row) {
  return {
    id:          row[COLS.id - 1],
    name:        row[COLS.name - 1],
    text:        row[COLS.text - 1],
    amount:      row[COLS.amount - 1],
    wallet:      row[COLS.wallet - 1],
    x_handle:    row[COLS.x_handle - 1],
    status:      row[COLS.status - 1],
    claim_token: row[COLS.claim_token - 1],
    created:     row[COLS.created - 1],
  };
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET — return all wishes
function doGet(e) {
  try {
    const sheet = getSheet();
    const data  = sheet.getDataRange().getValues();
    const wishes = [];

    // Skip header row (row 0)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // skip empty rows
      wishes.push(rowToObj(row));
    }

    // Most recent first
    wishes.sort((a, b) => (b.created || 0) - (a.created || 0));

    return jsonResponse({ success: true, wishes });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// POST — createWish or updateStatus
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheet  = getSheet();

    if (action === 'createWish') {
      const id          = generateId();
      const claim_token = generateId();
      const now         = Date.now();

      const row = new Array(9).fill('');
      row[COLS.id - 1]          = id;
      row[COLS.name - 1]        = body.name || 'Anon';
      row[COLS.text - 1]        = body.text;
      row[COLS.amount - 1]      = body.amount;
      row[COLS.wallet - 1]      = body.wallet || '';
      row[COLS.x_handle - 1]   = body.x_handle || '';
      row[COLS.status - 1]      = 'open';
      row[COLS.claim_token - 1] = claim_token;
      row[COLS.created - 1]     = now;

      sheet.appendRow(row);

      return jsonResponse({ success: true, id, claim_token, status: 'open' });
    }

    if (action === 'updateStatus') {
      const token  = body.claim_token;
      const newStatus = body.status;
      const data   = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        const rowToken = data[i][COLS.claim_token - 1];
        const rowId    = data[i][COLS.id - 1];

        if (rowToken === token || rowId === body.id) {
          sheet.getRange(i + 1, COLS.status).setValue(newStatus);
          return jsonResponse({ success: true, status: newStatus });
        }
      }

      return jsonResponse({ success: false, error: 'Wish not found' });
    }

    return jsonResponse({ success: false, error: 'Unknown action' });

  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}
