// Tarik insight utas Threads @jejakkarya.kreatif ke tab "Insight Threads" di sheet.
// Dijalankan GitHub Actions (.github/workflows/ig-insight.yml) tiap pagi, setelah insight IG.
// Dibaca Agent Head Creative buat evaluasi eksperimen Threads (rasio balasan/views, repost/views per format & jam).
// Secrets: THREADS_TOKEN (wajib izin threads_basic + threads_manage_insights), KONTROL_KEY.
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwDVSLoU4CFZ9Vlnl_FlR6zRB67dsBgq20UohBXybC162gi6cfTdGy1IDEWYkN8bVvfGg/exec";
const EXPECT_USERNAME = "jejakkarya.kreatif";
const API = "https://graph.threads.net/v1.0";
const TAB = "Insight Threads";
const HEADER = ["Media ID", "ID Utas", "Topik", "Link", "Tayang", "Views", "Likes", "Balasan", "Repost", "Quote", "Share", "Diperbarui", "Catatan"];
const METRICS = ["views", "likes", "replies", "reposts", "quotes", "shares"];
const T = { id: 0, topik: 2, link: 11 };

const { THREADS_TOKEN, KONTROL_KEY } = process.env;
const log = (...a) => console.log(new Date().toISOString(), ...a);
const stamp = () => { const d = new Date(Date.now() + 7 * 3600e3).toISOString(); return `${d.slice(0, 10)} ${d.slice(11, 16)}`; };
const normLink = s => String(s || "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();
// Link Threads bisa threads.net atau threads.com; samain pakai kode post-nya.
const postCode = s => (normLink(s).match(/\/post\/([^/]+)/) || [])[1] || normLink(s);

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

async function th(path, params = {}) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries({ ...params, access_token: THREADS_TOKEN })) url.searchParams.set(k, v);
  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(j.error?.message || `HTTP ${res.status}`);
  return j;
}

// Ambil metrik satu utas (post pertama). Kalau satu metrik ditolak, coba satu per satu.
async function metricsOf(id) {
  const out = {}, gagal = [];
  const read = j => (j.data || []).forEach(m => { out[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? ""; });
  try { read(await th(`/${id}/insights`, { metric: METRICS.join(",") })); }
  catch (e) {
    if (/permission|scope|authoriz/i.test(e.message)) throw e;
    for (const m of METRICS) {
      try { read(await th(`/${id}/insights`, { metric: m })); } catch { gagal.push(m); }
    }
  }
  return { out, gagal };
}

async function main() {
  if (!KONTROL_KEY) throw new Error("Secret KONTROL_KEY belum diisi di repo.");
  if (!THREADS_TOKEN) { log("THREADS_TOKEN belum dipasang, insight Threads dilewati."); return; }

  const me = await th("/me", { fields: "id,username" });
  if (me.username !== EXPECT_USERNAME) throw new Error(`Token ini buat akun Threads @${me.username}, bukan @${EXPECT_USERNAME}.`);
  log(`Token OK: @${me.username}`);

  // /me/threads cuma ngasih post utama (bukan balasan berantai), pas buat 1 baris per utas.
  const media = (await th("/me/threads", { fields: "id,permalink,timestamp,text,media_type", limit: "50" })).data || [];
  log(`Utas kebaca: ${media.length}`);

  const sheet = ((await backend({ action: "get", range: "Threads!A2:N1000" })).values || []).filter(v => v[T.link]);
  const byCode = new Map(sheet.map(v => [postCode(v[T.link]), v]));

  const rows = [];
  let izinDitolak = null;
  for (const m of media) {
    const s = byCode.get(postCode(m.permalink));
    const topik = s ? s[T.topik] : String(m.text || "").split("\n")[0].slice(0, 80);
    const tayang = m.timestamp ? new Date(new Date(m.timestamp).getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ") : "";
    let met = {}, catatan = s ? "" : "di luar sheet";
    if (!izinDitolak) {
      try {
        const r = await metricsOf(m.id);
        met = r.out;
        if (r.gagal.length) catatan = [catatan, `metrik nggak tersedia: ${r.gagal.join(", ")}`].filter(Boolean).join("; ");
      } catch (e) { izinDitolak = e.message; }
    }
    if (izinDitolak) catatan = [catatan, "insight belum bisa dibaca (izin token)"].filter(Boolean).join("; ");
    const t = String(topik || "");
    rows.push([
      "'" + m.id, s ? s[T.id] : "", /^[=+]/.test(t) ? "'" + t : t, m.permalink || "", "'" + tayang,
      met.views ?? "", met.likes ?? "", met.replies ?? "", met.reposts ?? "", met.quotes ?? "", met.shares ?? "",
      "'" + stamp(), catatan,
    ]);
  }

  await backend({ action: "addSheet", name: TAB, header: HEADER });
  const old = (await backend({ action: "get", range: `${TAB}!A1:M2000` })).values || [];
  const grid = [HEADER, ...rows];
  while (grid.length < old.length) grid.push(HEADER.map(() => ""));
  await backend({ action: "set", range: `${TAB}!A1:M${grid.length}`, values: grid });
  log(`Tab "${TAB}" diperbarui: ${rows.length} utas.`);

  if (izinDitolak) {
    throw new Error(`Insight Threads ditolak: ${izinDitolak}. Token perlu izin threads_manage_insights — generate ulang token Threads dengan izin itu, lalu ganti secret THREADS_TOKEN.`);
  }
}

main().catch(e => { console.error("GAGAL:", e.message); process.exit(1); });
