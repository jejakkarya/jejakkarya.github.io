// Posting utas Threads @jejakkarya.kreatif dari tab "Threads" di sheet.
// Dijalankan GitHub Actions (.github/workflows/threads-upload.yml): dipicu Apps Script (Pemicu.gs)
// pas jadwal tiba / tombol "Upload sekarang", plus cron cadangan.
//
// Alur: baca tab Threads → ambil 1 baris "Approve" (THREADS_ID atau yang jadwalnya paling lama lewat)
// → pecah kolom Utas jadi post per baris "---" → post 1 tayang, post berikutnya jadi balasan berantai
// → tulis Tayang + link ke sheet → catat di Log Upload.
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwDVSLoU4CFZ9Vlnl_FlR6zRB67dsBgq20UohBXybC162gi6cfTdGy1IDEWYkN8bVvfGg/exec";
const EXPECT_USERNAME = "jejakkarya.kreatif";
const API = "https://graph.threads.net/v1.0";
const DEFAULT_JAM = "12:00";
const MAX_CHARS = 500;
const T = { id: 0, topik: 2, utas: 4, jumlah: 5, tgl: 7, jam: 8, st: 9, link: 11, ubah: 12, antri: 13 };

const { THREADS_TOKEN, KONTROL_KEY } = process.env;
const DRY = String(process.env.DRY_RUN || "").toLowerCase() === "true";
const THREADS_ID = String(process.env.THREADS_ID || "").trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);
const wib = () => { const d = new Date(Date.now() + 7 * 3600e3).toISOString(); return `${d.slice(0, 10)} ${d.slice(11, 16)}`; };
const cleanDate = s => (String(s || "").match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
const cleanTime = s => { const m = String(s || "").match(/(\d{1,2})[:.](\d{2})/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : ""; };
const norm = s => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();

export function splitUtas(s) {
  return String(s || "").replace(/\r/g, "").split(/\n\s*-{3,}\s*\n/).map(p => p.trim()).filter(Boolean);
}

async function backend(body) {
  const res = await fetch(BACKEND_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...body, key: KONTROL_KEY }),
    redirect: "follow",
  });
  const text = await res.text();
  let j;
  try { j = JSON.parse(text); } catch { throw new Error(`Backend balas bukan JSON (HTTP ${res.status}): ${text.slice(0, 200)}`); }
  if (!j.ok) throw new Error(`Backend: ${j.code || "error"} ${j.message || ""}`.trim());
  return j;
}
const setRow = (r, a, b, vals) => backend({ action: "set", range: `Threads!${a}${r}:${b}${r}`, values: [vals] });
async function logRow(id, judul, hasil, detail) {
  try {
    await backend({ action: "addSheet", name: "Log Upload", header: ["Waktu", "ID Konten", "Judul", "Hasil", "Detail"] });
    await backend({ action: "append", sheet: "Log Upload", values: [["'" + wib(), id, "[Threads] " + judul, hasil, String(detail).slice(0, 4000)]] });
  } catch (e) { log("Gagal nulis Log Upload:", e.message); }
}

async function th(method, path, params = {}) {
  const url = new URL(API + path);
  let body;
  if (method === "GET") { for (const [k, v] of Object.entries({ ...params, access_token: THREADS_TOKEN })) url.searchParams.set(k, v); }
  else body = new URLSearchParams({ ...params, access_token: THREADS_TOKEN });
  const res = await fetch(url, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`Threads ${path}: ${j.error?.message || res.status}`);
  return j;
}
async function waitReady(id) {
  for (let i = 0; i < 20; i++) {
    const j = await th("GET", `/${id}`, { fields: "status,error_message" }).catch(() => ({}));
    if (!j.status || j.status === "FINISHED") return;
    if (j.status === "ERROR" || j.status === "EXPIRED") throw new Error(`Container ${id} ${j.status}: ${j.error_message || ""}`);
    await sleep(2000);
  }
}
async function publish(text, replyTo) {
  const params = { media_type: "TEXT", text };
  if (replyTo) params.reply_to_id = replyTo;
  const c = await th("POST", "/me/threads", params);
  await waitReady(c.id);
  const p = await th("POST", "/me/threads_publish", { creation_id: c.id });
  return p.id;
}

async function main() {
  if (!KONTROL_KEY) throw new Error("Secret KONTROL_KEY belum diisi di repo.");
  if (!THREADS_TOKEN && !DRY) {
    // Cron cadangan jangan bikin run gagal terus selama token belum dipasang.
    if (process.env.GITHUB_EVENT_NAME === "schedule") { log("THREADS_TOKEN belum dipasang, cron dilewati."); return; }
    throw new Error("Secret THREADS_TOKEN belum diisi di repo.");
  }

  if (THREADS_TOKEN) {
    const me = await th("GET", "/me", { fields: "id,username" });
    if (me.username !== EXPECT_USERNAME) throw new Error(`Token ini buat akun Threads @${me.username}, bukan @${EXPECT_USERNAME}.`);
    log(`Token OK: @${me.username}`);
  } else log("THREADS_TOKEN kosong — uji coba tanpa cek token.");

  const vals = (await backend({ action: "get", range: "Threads!A2:N1000" })).values || [];
  const rows = vals.map((v, i) => ({ r: i + 2, v: Array.from({ length: 14 }, (_, k) => String(v[k] ?? "")) })).filter(x => x.v[T.utas].trim());
  const now = wib();
  let row;
  if (THREADS_ID) {
    row = rows.find(x => x.v[T.id] === THREADS_ID);
    if (!row) throw new Error(`ID ${THREADS_ID} nggak ada di tab Threads.`);
    if (row.v[T.st] !== "Approve") { log(`${THREADS_ID} statusnya "${row.v[T.st]}", bukan Approve. Dilewati.`); return; }
    log(`Diminta langsung: ${THREADS_ID}`);
  } else {
    const due = rows
      .filter(x => x.v[T.st] === "Approve" && cleanDate(x.v[T.tgl]))
      .map(x => ({ ...x, at: `${cleanDate(x.v[T.tgl])} ${cleanTime(x.v[T.jam]) || DEFAULT_JAM}` }))
      .filter(x => x.at <= now)
      .sort((a, b) => a.at.localeCompare(b.at));
    row = due[0];
    if (!row) { log("Nggak ada utas Approve yang jatuh tempo."); return; }
    log(`Jatuh tempo: ${row.v[T.id]} (${row.at})`);
  }

  const id = row.v[T.id], judul = row.v[T.topik] || id;
  const posts = splitUtas(row.v[T.utas]);
  if (!posts.length) throw new Error(`${id}: kolom Utas kosong.`);
  const panjang = posts.map((p, i) => [i + 1, [...p].length]).filter(([, n]) => n > MAX_CHARS);
  if (panjang.length) {
    const msg = panjang.map(([i, n]) => `post ${i}: ${n} karakter`).join(", ");
    await logRow(id, judul, "Gagal", `Kepanjangan (maks ${MAX_CHARS}): ${msg}`);
    throw new Error(`${id} kepanjangan — ${msg}. Edit di dashboard dulu.`);
  }
  log(`${id}: ${posts.length} post (${posts.map(p => [...p].length).join(", ")} karakter)`);

  if (DRY) { posts.forEach((p, i) => log(`--- post ${i + 1} ---\n${p}`)); log("DRY RUN: nggak diposting."); return; }

  // Cegah dobel: kalau post pertama udah ada di akun, anggap udah tayang.
  const recent = (await th("GET", "/me/threads", { fields: "id,text,permalink", limit: "25" })).data || [];
  const dup = recent.find(m => norm(m.text) === norm(posts[0]));
  if (dup) {
    log(`Post pertama udah ada di akun (${dup.permalink}). Nggak diposting ulang.`);
    await setRow(row.r, "J", "J", ["Tayang"]);
    await setRow(row.r, "L", "N", [dup.permalink || "", "'" + now, ""]);
    await logRow(id, judul, "Sudah ada", dup.permalink || dup.id);
    return;
  }

  let firstId = null, prev = null, done = 0;
  try {
    for (const p of posts) {
      prev = await publish(p, prev);
      if (!firstId) firstId = prev;
      done++;
      log(`Post ${done}/${posts.length} tayang: ${prev}`);
      if (done < posts.length) await sleep(3000);
    }
  } catch (e) {
    if (!firstId) { await logRow(id, judul, "Gagal", e.message); throw e; }
    // Sebagian udah tayang: tandai Tayang biar nggak dobel, catat yang gagal.
    const link = (await th("GET", `/${firstId}`, { fields: "permalink" }).catch(() => ({}))).permalink || "";
    await setRow(row.r, "J", "J", ["Tayang"]);
    await setRow(row.r, "L", "N", [link, "'" + wib(), ""]);
    await logRow(id, judul, "Sebagian", `${done}/${posts.length} post tayang, sisanya gagal: ${e.message}. ${link}`);
    throw new Error(`${id}: cuma ${done}/${posts.length} post yang tayang — ${e.message}`);
  }

  const link = (await th("GET", `/${firstId}`, { fields: "permalink" }).catch(() => ({}))).permalink || "";
  await setRow(row.r, "J", "J", ["Tayang"]);
  await setRow(row.r, "L", "N", [link, "'" + wib(), ""]);
  await logRow(id, judul, "Sukses", link);
  log(`Tayang: ${link}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error("GAGAL:", e.message); process.exit(1); });
}
