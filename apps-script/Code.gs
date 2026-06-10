function doPost(e) {
  var sheet = getSheet();
  var data = JSON.parse(e.postData.contents);
  var headers = ensureHeaders(sheet, data);
  var row = buildRow(headers, data);

  var lastRow = sheet.getLastRow();
  var idx = -1;
  if (lastRow > 1) {
    var dates = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < dates.length; i++) {
      if (String(dates[i][0]) === String(data.date)) { idx = i; break; }
    }
  }

  if (idx >= 0) {
    sheet.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  } else {
    sheet.appendRow(row);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var sheet = getSheet();
  var values = sheet.getDataRange().getValues();
  return ContentService.createTextOutput(JSON.stringify(values))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("習慣紀錄");
  if (!sheet) {
    sheet = ss.insertSheet("習慣紀錄");
    sheet.appendRow(["日期", "分數"]);
  }
  return sheet;
}

function ensureHeaders(sheet, data) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  if (headers.length === 0) headers = ["日期", "分數"];

  var changed = false;
  var allHabits = (data.good || []).concat(data.bad || []);
  allHabits.forEach(function (h) {
    if (headers.indexOf(h.name) === -1) {
      headers.push(h.name);
      changed = true;
    }
  });
  if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

function buildRow(headers, data) {
  var map = {};
  map["日期"] = data.date;
  map["分數"] = data.score;
  (data.good || []).concat(data.bad || []).forEach(function (h) {
    map[h.name] = h.value;
  });
  return headers.map(function (h) {
    return map[h] !== undefined ? map[h] : "";
  });
}
