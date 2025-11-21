/**
 * Google Apps Script backend for the Christmas Wishlist.
 * Deployment:
 * 1. Deploy → New deployment → Type: Web app.
 * 2. Execute as: Me.
 * 3. Who has access: Anyone.
 */

const SHEET_NAME = "Wishlist";

function getWishlistSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Timestamp", "Name", "Item", "Link", "Notes"]);
  }

  return sheet;
}

function doGet(e) {
  const sheet = getWishlistSheet();
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1).map((row, index) => ({
    timestamp: row[0] instanceof Date ? row[0].toISOString() : row[0],
    name: row[1] || "",
    item: row[2] || "",
    link: row[3] || "",
    notes: row[4] || "",
    rowNumber: index + 2 // +2 accounts for the header row and 0-based index
  }));

  return createJsonOutput(rows);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createErrorResponse("Invalid request body.");
    }

    const payload = JSON.parse(e.postData.contents);
    const action = (payload.action || "add").toLowerCase();

    if (action === "delete") {
      const timestamp = payload.timestamp;
      const rowNumber = Number(payload.rowNumber);

      if (!timestamp && !rowNumber) {
        return createErrorResponse("Timestamp or row number is required to delete an entry.");
      }

      const sheet = getWishlistSheet();

      // Prefer the provided row number for exact matching to avoid timestamp parsing issues.
      if (rowNumber && rowNumber > 1 && rowNumber <= sheet.getLastRow()) {
        const rowTimestamp = sheet.getRange(rowNumber, 1).getValue();
        const normalizedTimestamp =
          rowTimestamp instanceof Date ? rowTimestamp.toISOString() : rowTimestamp;

        if (timestamp && normalizedTimestamp !== timestamp) {
          return createErrorResponse("Entry not found.");
        }

        sheet.deleteRow(rowNumber);
        return createJsonOutput({ success: true, message: "Item deleted" });
      }

      const data = sheet.getDataRange().getValues();
      let rowToDelete = -1;

      for (let i = 1; i < data.length; i++) {
        const rowTimestamp = data[i][0] instanceof Date ? data[i][0].toISOString() : data[i][0];
        if (rowTimestamp === timestamp) {
          rowToDelete = i + 1; // sheets are 1-indexed
          break;
        }
      }

      if (rowToDelete === -1) {
        return createErrorResponse("Entry not found.");
      }

      sheet.deleteRow(rowToDelete);
      return createJsonOutput({ success: true, message: "Item deleted" });
    }

    const name = (payload.name || "").trim();
    const item = (payload.item || "").trim();
    const link = (payload.link || "").trim();
    const notes = (payload.notes || "").trim();

    if (!name || !item) {
      return createErrorResponse("Name and item are required.");
    }

    const sheet = getWishlistSheet();
    const timestamp = new Date();
    sheet.appendRow([timestamp, name, item, link, notes]);

    const rowNumber = sheet.getLastRow();

    const entry = {
      timestamp: timestamp.toISOString(),
      name,
      item,
      link,
      notes,
      rowNumber
    };

    return createJsonOutput({ success: true, message: "Item added", entry });
  } catch (error) {
    return createErrorResponse(error && error.message ? error.message : "Unexpected error.");
  }
}

function doOptions(e) {
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*")
    .setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    .setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function createJsonOutput(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}

function createErrorResponse(message) {
  return ContentService.createTextOutput(JSON.stringify({ success: false, message }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
}
