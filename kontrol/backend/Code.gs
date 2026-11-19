/**
 * Backend Kontrol Agent Jejak Karya — project Apps Script "jejak karya dashboard".
 *
 * Backend ini sengaja dibuat umum: semua logika tampilan ada di halaman
 * jejakkarya.github.io/kontrol/, jadi fitur baru cukup diubah di halaman itu.
 * File ini idealnya tidak perlu diubah lagi.
 *
 * Bisa: baca/tulis/tambah baris di tab mana pun pada spreadsheet SHEET_ID,
 * bikin tab baru, baca daftar tab, dan ambil gambar dari Drive (milik akun ini).
 * Semua permintaan wajib membawa KEY yang cocok (Script Properties > KEY).
 *
 * Kalau file ini diganti: Deploy > Manage deployments > ikon pensil >
 * Version: New version > Deploy. URL /exec tetap sama.
 */
const SHEET_ID = '1Gh2-4uNna1qWwk2evuxrz49iBL-bljN9IMrhndAMLWA';
const VERSION = 2;

function doGet() {
  return out_({ ok: true, service: 'kontrol-jejakkarya', version: VERSION });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = PropertiesService.getScriptProperties().getProperty('KEY');
    if (!key || String(body.key || '') !== key) {
      return out_({ ok: false, code: 'unauthorized', message: 'Kunci salah atau belum diatur.' });
    }
    if (body.action === 'batch') {
      const ops = Array.isArray(body.ops) ? body.ops : [];
      const lock = LockService.getScriptLock();
      lock.waitLock(20000);
      try {
        return out_({ ok: true, version: VERSION, results: ops.map(function (op) {
          try { return run_(op); } catch (err) { return { ok: false, code: 'tool_error', message: msg_(err) }; }
        }) });
      } finally { lock.releaseLock(); }
    }
    const res = run_(body);
    res.version = VERSION;
    return out_(res);
  } catch (err) {
    return out_({ ok: false, code: 'tool_error', message: msg_(err), version: VERSION });
  }
}

function run_(op) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  switch (op.action) {
    case 'ping':
      return { ok: true };
    case 'sheets':
      return { ok: true, sheets: ss.getSheets().map(function (sh) {
        const cols = Math.max(sh.getLastColumn(), 1);
        return { name: sh.getName(), rows: sh.getLastRow(), cols: sh.getLastColumn(), header: sh.getRange(1, 1, 1, cols).getDisplayValues()[0] };
      }) };
    case 'get': {
      let values = range_(ss, op.range).getDisplayValues();
      while (values.length && values[values.length - 1].every(function (c) { return c === ''; })) values.pop();
      return { ok: true, values: values };
    }
    case 'set': {
      const range = range_(ss, op.range);
      const values = op.values;
      if (!Array.isArray(values) || !values.length || values.length !== range.getNumRows() || values[0].length !== range.getNumColumns()) {
        throw new Error('Ukuran data tidak sama dengan range.');
      }
      range.setValues(values);
      return { ok: true };
    }
    case 'append': {
      const sh = sheet_(ss, op.sheet || nameOf_(op.range));
      const rows = Array.isArray(op.values) ? op.values : [];
      rows.forEach(function (row) { if (Array.isArray(row)) sh.appendRow(row); });
      return { ok: true, lastRow: sh.getLastRow() };
    }
    case 'addSheet': {
      const name = String(op.name || '').trim();
      if (!name) throw new Error('Nama tab kosong.');
      let sh = ss.getSheetByName(name);
      if (!sh) {
        sh = ss.insertSheet(name);
        if (Array.isArray(op.header) && op.header.length) {
          sh.getRange(1, 1, 1, op.header.length).setValues([op.header]).setFontWeight('bold');
          sh.setFrozenRows(1);
        }
      }
      return { ok: true, name: name };
    }
    case 'files': {
      const it = DriveApp.getFolderById(String(op.folderId)).getFiles();
      const files = [];
      while (it.hasNext()) {
        const f = it.next();
        const type = String(f.getMimeType());
        if (!op.type || type.indexOf(op.type) === 0) files.push({ id: f.getId(), title: f.getName(), mimeType: type });
      }
      return { ok: true, files: files };
    }
    case 'file': {
      const blob = DriveApp.getFileById(String(op.fileId)).getBlob();
      return { ok: true, mimeType: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
    }
    default:
      return { ok: false, code: 'bad_request', message: 'Aksi tidak dikenal: ' + op.action };
  }
}

function nameOf_(a1) {
  const m = String(a1 || '').match(/^'?(.+?)'?!/);
  return m ? m[1].replace(/''/g, "'") : '';
}

function sheet_(ss, name) {
  const sh = ss.getSheetByName(String(name || ''));
  if (!sh) throw new Error('Tab tidak ditemukan: ' + name);
  return sh;
}

function range_(ss, a1) {
  sheet_(ss, nameOf_(a1));
  return ss.getRange(String(a1));
}

function msg_(err) {
  return String((err && err.message) || err);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
