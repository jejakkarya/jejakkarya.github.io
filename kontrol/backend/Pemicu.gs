/**
 * Pemicu upload Instagram — file kedua di project Apps Script "jejak karya dashboard".
 * Tempel sebagai file BARU (Pemicu.gs). Code.gs tidak perlu diubah.
 *
 * Tiap 1 menit ngecek tab Konten:
 *  - konten yang diminta "Upload sekarang" dari dashboard (kolom R diawali "upload|")
 *  - konten Approve yang tanggal + jam tayangnya udah lewat
 * lalu nyuruh GitHub Actions (workflow ig-upload.yml) jalan saat itu juga.
 * Nggak manggil GitHub kalau nggak ada yang perlu diposting.
 *
 * Pasang (sekali):
 * 1. Script Properties > tambah GH_TOKEN = token GitHub (fine-grained, repo jejakkarya.github.io,
 *    izin Actions: Read and write).
 * 2. Pilih fungsi setupPemicu di toolbar, klik Run, izinkan aksesnya.
 */
const P_REPO = 'jejakkarya/jejakkarya.github.io';
const P_WORKFLOW = 'ig-upload.yml';
const P_DEFAULT_JAM = '19:00';
const P_JEDA_MENIT = 20; // jeda minimal antar kiriman untuk konten jatuh tempo yang sama

function setupPemicu() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'cekPemicu'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cekPemicu').timeBased().everyMinutes(1).create();
  cekPemicu();
}

function hapusPemicu() {
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'cekPemicu'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

function cekPemicu() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName('Konten');
    const last = sh.getLastRow();
    if (last < 2) return;
    const vals = sh.getRange(2, 1, last - 1, 18).getDisplayValues();
    const now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
    const props = PropertiesService.getScriptProperties();

    // 1) Permintaan "Upload sekarang"
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v[7] === 'Approve' && /^upload\|/.test(v[17])) {
        p_dispatch_(v[0]);
        sh.getRange(i + 2, 18).setValue('upload-dikirim|' + now);
        return; // satu per menit, sisanya menit berikutnya
      }
    }

    // 2) Konten jatuh tempo
    let due = null;
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      if (v[7] !== 'Approve') continue;
      const tgl = (String(v[5]).match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
      if (!tgl) continue;
      const m = String(v[6]).match(/(\d{1,2})[:.](\d{2})/);
      const at = tgl + ' ' + (m ? ('0' + m[1]).slice(-2) + ':' + m[2] : P_DEFAULT_JAM);
      if (at <= now && (!due || at < due.at)) due = { id: v[0], at: at };
    }
    if (!due) return;
    const key = 'LAST_' + due.id;
    const lastSent = Number(props.getProperty(key) || 0);
    if (Date.now() - lastSent < P_JEDA_MENIT * 60000) return;
    p_dispatch_(due.id);
    props.setProperty(key, String(Date.now()));
  } finally {
    lock.releaseLock();
  }
}

function p_dispatch_(kontenId) {
  const token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) throw new Error('GH_TOKEN belum diisi di Script Properties.');
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + P_REPO + '/actions/workflows/' + P_WORKFLOW + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main', inputs: { dry_run: 'false', konten_id: String(kontenId || '') } }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('GitHub nolak (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200));
}
