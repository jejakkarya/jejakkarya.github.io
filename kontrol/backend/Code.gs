/**
 * Backend Kontrol Agent Jejak Karya (Google Apps Script Web App).
 *
 * Dipakai oleh halaman jejakkarya.github.io/kontrol/ untuk membaca dan
 * menulis sheet "Konten IG Jejak Karya" serta mengambil gambar desain di Drive.
 *
 * Pasang:
 * 1. Buka script.google.com pakai akun pemilik sheet, buat project baru, tempel file ini.
 * 2. Project Settings > Script Properties > tambah properti KEY berisi kunci rahasia
 *    (bebas, minimal 16 karakter). Kunci ini yang diisi di halaman kontrol.
 * 3. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone.
 * 4. Salin URL Web app (berakhiran /exec), isi di halaman kontrol bersama KEY.
 *
 * Semua permintaan wajib membawa KEY yang cocok. Tanpa itu, backend menolak.
 */
const SHEET_ID = '1Gh2-4uNna1qWwk2evuxrz49iBL-bljN9IMrhndAMLWA';
const ALLOWED_SHEETS = ['Konten', 'Bank Ide', 'Panduan'];

function doGet() {
  return out_({ ok: true, service: 'kontrol-jejakkarya' });
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = PropertiesService.getScriptProperties().getProperty('KEY');
    if (!key || String(body.key || '') !== key) {
      return out_({ ok: false, code: 'unauthorized', message: 'Kunci salah atau belum diatur.' });
    }
    const ss = SpreadsheetApp.openById(SHEET_ID);
    switch (body.action) {
      case 'get': {
        const range = ss.getRange(checkRange_(body.range));
        let values = range.getDisplayValues();
        while (values.length && values[values.length - 1].every(function (c) { return c === ''; })) values.pop();
        return out_({ ok: true, values: values });
      }
      case 'set': {
        const range = ss.getRange(checkRange_(body.range));
        const values = body.values;
        if (!Array.isArray(values) || values.length !== range.getNumRows() || values[0].length !== range.getNumColumns()) {
          throw new Error('Ukuran data tidak sama dengan range.');
        }
        range.setValues(values);
        return out_({ ok: true });
      }
      case 'append': {
        const name = sheetName_(checkRange_(body.range));
        const row = body.values && body.values[0];
        if (!Array.isArray(row)) throw new Error('Baris kosong.');
        ss.getSheetByName(name).appendRow(row);
        return out_({ ok: true });
      }
      case 'files': {
        const it = DriveApp.getFolderById(String(body.folderId)).getFiles();
        const files = [];
        while (it.hasNext()) {
          const f = it.next();
          if (String(f.getMimeType()).indexOf('image/') === 0) files.push({ id: f.getId(), title: f.getName() });
        }
        return out_({ ok: true, files: files });
      }
      case 'file': {
        const blob = DriveApp.getFileById(String(body.fileId)).getBlob();
        return out_({ ok: true, mimeType: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
      }
      default:
        return out_({ ok: false, code: 'bad_request', message: 'Aksi tidak dikenal.' });
    }
  } catch (err) {
    return out_({ ok: false, code: 'tool_error', message: String(err && err.message || err) });
  }
}

function sheetName_(a1) {
  const m = String(a1).match(/^'?([^'!]+)'?!/);
  return m ? m[1] : '';
}

function checkRange_(a1) {
  const name = sheetName_(a1);
  if (ALLOWED_SHEETS.indexOf(name) < 0) throw new Error('Tab tidak diizinkan: ' + name);
  return String(a1);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
