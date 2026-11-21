/**
 * Pemicu upload Instagram & Threads — file kedua di project Apps Script "jejak karya dashboard".
 * Code.gs tidak perlu diubah.
 *
 * Tiap 1 menit ngecek:
 *  - tab Konten: konten yang diminta "Upload sekarang" (kolom R diawali "upload|") atau
 *    konten Approve yang tanggal + jam tayangnya udah lewat → workflow ig-upload.yml
 *  - tab Threads: utas yang diminta "Upload sekarang" (kolom N diawali "upload|") atau
 *    utas Approve yang jadwalnya udah lewat → workflow threads-upload.yml
 * Nggak manggil GitHub kalau nggak ada yang perlu diposting.
 *
 * Pasang (sekali):
 * 1. Script Properties > GH_TOKEN = token GitHub (fine-grained, repo jejakkarya.github.io,
 *    izin Actions: Read and write).
 * 2. Pilih fungsi setupPemicu di toolbar, klik Run, izinkan aksesnya.
 * Kalau cuma ganti isi file ini, cukup Simpan. Trigger yang lama tetap jalan.
 */
const P_REPO = 'jejakkarya/jejakkarya.github.io';
const P_JEDA_MENIT = 20; // jeda minimal antar kiriman untuk item jatuh tempo yang sama

function setupPemicu() {
  hapusPemicu();
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
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const now = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm');
    const props = PropertiesService.getScriptProperties();
    const jobs = [
      { tab: 'Konten', cols: 18, st: 7, tgl: 5, jam: 6, antri: 17, jamDefault: '19:00', workflow: 'ig-upload.yml', input: 'konten_id', key: 'LAST_' },
      { tab: 'Threads', cols: 14, st: 9, tgl: 7, jam: 8, antri: 13, jamDefault: '12:00', workflow: 'threads-upload.yml', input: 'threads_id', key: 'LAST_T_' },
    ];
    jobs.forEach(function (job) {
      try { p_cek_(ss, job, now, props); }
      catch (e) { console.error(job.tab + ': ' + e.message); }
    });
  } finally {
    lock.releaseLock();
  }
}

function p_cek_(ss, job, now, props) {
  const sh = ss.getSheetByName(job.tab);
  if (!sh) return;
  const last = sh.getLastRow();
  if (last < 2) return;
  const vals = sh.getRange(2, 1, last - 1, job.cols).getDisplayValues();

  // 1) Permintaan "Upload sekarang"
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v[job.st] === 'Approve' && /^upload\|/.test(v[job.antri])) {
      p_dispatch_(job.workflow, job.input, v[0]);
      sh.getRange(i + 2, job.antri + 1).setValue('upload-dikirim|' + now);
      return; // satu per menit, sisanya menit berikutnya
    }
  }

  // 2) Jatuh tempo
  let due = null;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    if (v[job.st] !== 'Approve') continue;
    const tgl = (String(v[job.tgl]).match(/\d{4}-\d{2}-\d{2}/) || [''])[0];
    if (!tgl) continue;
    const m = String(v[job.jam]).match(/(\d{1,2})[:.](\d{2})/);
    const at = tgl + ' ' + (m ? ('0' + m[1]).slice(-2) + ':' + m[2] : job.jamDefault);
    if (at <= now && (!due || at < due.at)) due = { id: v[0], at: at };
  }
  if (!due) return;
  const key = job.key + due.id;
  const lastSent = Number(props.getProperty(key) || 0);
  if (Date.now() - lastSent < P_JEDA_MENIT * 60000) return;
  p_dispatch_(job.workflow, job.input, due.id);
  props.setProperty(key, String(Date.now()));
}

function p_dispatch_(workflow, inputName, id) {
  const token = PropertiesService.getScriptProperties().getProperty('GH_TOKEN');
  if (!token) throw new Error('GH_TOKEN belum diisi di Script Properties.');
  const inputs = { dry_run: 'false' };
  inputs[inputName] = String(id || '');
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + P_REPO + '/actions/workflows/' + workflow + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ ref: 'main', inputs: inputs }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() >= 300) throw new Error('GitHub nolak (' + res.getResponseCode() + '): ' + res.getContentText().slice(0, 200));
}
