// Upload otomatis Instagram @jejakkarya.kreatif.
// Dijalankan GitHub Actions (.github/workflows/ig-upload.yml) tiap 15 menit.
//
// Alur: baca tab Konten lewat backend dashboard (Apps Script "jejak karya dashboard")
// → ambil 1 konten berstatus "Approve" yang jadwal + jamnya udah lewat
// → ambil PNG dari folder Drive-nya → ubah ke JPEG → taruh sementara di branch ig-media
// → posting carousel lewat Instagram API → tulis Uploaded + link ke sheet → hapus file sementara.
import sharp from "sharp";

const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwDVSLoU4CFZ9Vlnl_FlR6zRB67dsBgq20UohBXybC162gi6cfTdGy1IDEWYkN8bVvfGg/exec";
const EXPECT_USERNAME = "jejakkarya.kreatif";
const IG_API = "https://graph.instagram.com/v22.0";
const MEDIA_BRANCH = "ig-media";
const DEFAULT_JAM = "19:00";
const K = { id: 0, ide: 1, judul: 2, tgl: 5, jam: 6, st: 7, caption: 10, folder: 12, slide: 13, link: 14, ubah: 16 };

const { IG_TOKEN, KONTROL_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env;
const DRY = String(process.env.DRY_RUN || "").toLowerCase() === "true";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString(), ...a);

function wib() {
  const d = new Date(Date.now() + 7 * 3600e3).toISOString();
  return { date: d.slice(0, 10), stamp: `${d.slice(0, 10)} ${d.slice(11, 16)}` };
}
const cleanDate = s => (String(s || "").match(/\d{4}-\d{2}-\d{2}/) || [""])[0];
const cleanTime = s => { const m = String(s || "").match(/(\d{1,2})[:.](\d{2})/); return m ? `${m[1].padStart(2, "0")}:${m[2]}` : ""; };

/* ---------- backend dashboard ---------- */
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
const setCell = (a1, v) => backend({ action: "set", range: a1, values: [[v]] });
async function logRow(kid, judul, hasil, detail) {
  try {
    await backend({ action: "addSheet", name: "Log Upload", header: ["Waktu", "ID Konten", "Judul", "Hasil", "Detail"] });
    await backend({ action: "append", sheet: "Log Upload", values: [["'" + wib().stamp, kid, judul, hasil, String(detail).slice(0, 4000)]] });
  } catch (e) { log("Gagal nulis Log Upload:", e.message); }
}

/* ---------- Instagram API ---------- */
async function ig(method, path, params = {}) {
  const url = new URL(IG_API + path);
  let body;
  if (method === "GET") { for (const [k, v] of Object.entries({ ...params, access_token: IG_TOKEN })) url.searchParams.set(k, v); }
  else body = new URLSearchParams({ ...params, access_token: IG_TOKEN });
  const res = await fetch(url, { method, body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`Instagram ${path}: ${j.error?.message || res.status}`);
  return j;
}
async function waitReady(id) {
  for (let i = 0; i < 30; i++) {
    const j = await ig("GET", `/${id}`, { fields: "status_code" });
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") throw new Error(`Container ${id} ${j.status_code}`);
    await sleep(3000);
  }
  throw new Error(`Container ${id} kelamaan diproses`);
}

/* ---------- hosting sementara di branch ig-media ---------- */
async function gh(method, path, body) {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}${path}`, {
    method,
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = res.status === 204 ? {} : await res.json().catch(() => ({}));
  return { status: res.status, j };
}
async function ensureBranch() {
  const b = await gh("GET", `/branches/${MEDIA_BRANCH}`);
  if (b.status === 200) return;
  const main = await gh("GET", `/git/ref/heads/main`);
  if (main.status !== 200) throw new Error("Nggak bisa baca branch main");
  const r = await gh("POST", `/git/refs`, { ref: `refs/heads/${MEDIA_BRANCH}`, sha: main.j.object.sha });
  if (r.status >= 300) throw new Error(`Gagal bikin branch ${MEDIA_BRANCH}: ${r.j.message}`);
}
async function putMedia(path, buf) {
  const r = await gh("PUT", `/contents/${path}`, { message: `ig-media: ${path}`, content: buf.toString("base64"), branch: MEDIA_BRANCH });
  if (r.status >= 300) throw new Error(`Gagal upload ${path}: ${r.j.message}`);
  return { sha: r.j.content.sha, url: `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${MEDIA_BRANCH}/${path}` };
}
async function delMedia(path, sha) {
  await gh("DELETE", `/contents/${path}`, { message: `ig-media: hapus ${path}`, sha, branch: MEDIA_BRANCH }).catch(() => {});
}
async function waitPublic(url) {
  for (let i = 0; i < 10; i++) {
    const r = await fetch(url, { method: "HEAD" }).catch(() => null);
    if (r && r.ok) return;
    await sleep(3000);
  }
  throw new Error(`Gambar belum bisa diakses publik: ${url}`);
}

/* ---------- utama ---------- */
async function main() {
  if (!IG_TOKEN || !KONTROL_KEY) throw new Error("Secret IG_TOKEN atau KONTROL_KEY belum diisi di repo.");

  const me = await ig("GET", "/me", { fields: "user_id,username" });
  if (me.username !== EXPECT_USERNAME) throw new Error(`Token ini buat akun @${me.username}, bukan @${EXPECT_USERNAME}.`);
  log(`Token OK: @${me.username}`);

  const vals = (await backend({ action: "get", range: "Konten!A2:Q1000" })).values || [];
  const rows = vals.map((v, i) => ({ r: i + 2, v })).filter(x => x.v[K.judul]);
  const now = wib();
  const approved = rows.filter(x => x.v[K.st] === "Approve" && cleanDate(x.v[K.tgl]));
  const due = approved
    .map(x => ({ ...x, at: `${cleanDate(x.v[K.tgl])} ${cleanTime(x.v[K.jam]) || DEFAULT_JAM}` }))
    .filter(x => x.at <= now.stamp)
    .sort((a, b) => a.at.localeCompare(b.at));
  log(`Sekarang ${now.stamp} WIB. Approve: ${approved.length}, jatuh tempo: ${due.length}`);

  let x = due[0];
  if (!x) {
    if (!DRY || !approved.length) { log("Nggak ada yang perlu diposting."); return; }
    x = approved[0];
    log(`[UJI] Nggak ada yang jatuh tempo, pakai konten Approve pertama buat uji: ${x.v[K.judul]}`);
  }
  const v = x.v, kid = v[K.id], judul = v[K.judul], caption = v[K.caption] || "";
  log(`Konten: ${kid} "${judul}" (baris ${x.r})`);

  // Cegah dobel: kalau caption yang sama udah tayang, cukup tandai Uploaded.
  const recent = await ig("GET", "/me/media", { fields: "id,caption,permalink,timestamp", limit: "10" });
  const sameCap = (recent.data || []).find(m => (m.caption || "").trim().slice(0, 120) === caption.trim().slice(0, 120) && caption.trim());
  if (sameCap) {
    log(`Udah tayang sebelumnya: ${sameCap.permalink}`);
    if (!DRY) {
      await setCell(`Konten!H${x.r}`, "Uploaded"); await setCell(`Konten!O${x.r}`, sameCap.permalink); await setCell(`Konten!Q${x.r}`, "'" + now.stamp);
      await logRow(kid, judul, "Uploaded", `Udah tayang, ditandai: ${sameCap.permalink}`);
    }
    return;
  }

  const fid = (String(v[K.folder]).match(/folders\/([\w-]+)/) || [])[1];
  if (!fid) throw new Error(`Folder desain kosong atau bukan link folder: ${v[K.folder]}`);
  const files = ((await backend({ action: "files", folderId: fid, type: "image/" })).files || [])
    .map(f => ({ ...f, n: +((f.title || "").match(/(\d+)\.\w+$/) || [0, 0])[1] }))
    .filter(f => f.n > 0).sort((a, b) => a.n - b.n);
  const expect = +v[K.slide] || files.length;
  if (!files.length) throw new Error("Folder desain nggak ada gambarnya.");
  if (files.length !== expect) throw new Error(`Jumlah gambar ${files.length}, harusnya ${expect} (kolom Jumlah Slide).`);
  if (files.length > 10) throw new Error("Carousel Instagram maksimal 10 slide.");

  const jpgs = [];
  for (const f of files) {
    const b = await backend({ action: "file", fileId: f.id });
    const jpg = await sharp(Buffer.from(b.data, "base64")).flatten({ background: "#ffffff" }).resize({ width: 1080, withoutEnlargement: true }).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
    jpgs.push(jpg);
  }
  log(`Gambar siap: ${jpgs.length} slide`);

  if (DRY) { log("[UJI] Berhenti di sini, nggak ada yang diposting. Semua pengecekan lolos."); return; }

  await ensureBranch();
  const hosted = [];
  try {
    const stampId = Date.now().toString(36);
    for (let i = 0; i < jpgs.length; i++) hosted.push({ path: `ig/${kid}-${stampId}/${i + 1}.jpg`, ...(await putMedia(`ig/${kid}-${stampId}/${i + 1}.jpg`, jpgs[i])) });
    for (const h of hosted) await waitPublic(h.url);

    let creation;
    if (hosted.length === 1) {
      creation = (await ig("POST", `/${me.user_id}/media`, { image_url: hosted[0].url, caption })).id;
    } else {
      const children = [];
      for (const h of hosted) children.push((await ig("POST", `/${me.user_id}/media`, { image_url: h.url, is_carousel_item: "true" })).id);
      for (const c of children) await waitReady(c);
      creation = (await ig("POST", `/${me.user_id}/media`, { media_type: "CAROUSEL", children: children.join(","), caption })).id;
    }
    await waitReady(creation);
    const pub = await ig("POST", `/${me.user_id}/media_publish`, { creation_id: creation });
    const info = await ig("GET", `/${pub.id}`, { fields: "permalink" });
    log(`Tayang: ${info.permalink}`);

    await setCell(`Konten!H${x.r}`, "Uploaded");
    await setCell(`Konten!O${x.r}`, info.permalink || "");
    await setCell(`Konten!Q${x.r}`, "'" + wib().stamp);
    await logRow(kid, judul, "Uploaded", info.permalink);
  } finally {
    for (const h of hosted) await delMedia(h.path, h.sha);
  }
}

main().catch(async e => {
  console.error("GAGAL:", e.message);
  if (KONTROL_KEY && !DRY) await logRow("", "", "Gagal", e.message);
  process.exit(1);
});
