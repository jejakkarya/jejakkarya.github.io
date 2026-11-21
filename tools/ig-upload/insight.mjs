// Tarik insight postingan @jejakkarya.kreatif ke tab "Insight IG" di sheet.
// Dijalankan GitHub Actions (.github/workflows/ig-insight.yml) tiap pagi + bisa manual.
// Dibaca Agent Head Creative buat laporan mingguan & arahan tim.
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwDVSLoU4CFZ9Vlnl_FlR6zRB67dsBgq20UohBXybC162gi6cfTdGy1IDEWYkN8bVvfGg/exec";
const EXPECT_USERNAME = "jejakkarya.kreatif";
const IG_API = "https://graph.instagram.com/v22.0";
const TAB = "Insight IG";
const HEADER = ["Media ID", "ID Konten", "Judul", "Link", "Tayang", "Tipe", "Views", "Reach", "Likes", "Komentar", "Save", "Share", "Interaksi", "Diperbarui", "Catatan"];
const METRICS = ["views", "reach", "likes", "comments", "saved", "shares", "total_interactions"];
const K = { id: 0, judul: 2, link: 14 };

const { IG_TOKEN, KONTROL_KEY } = process.env;
const log = (...a) => console.log(new Date().toISOString(), ...a);
const stamp = () => { const d = new Date(Date.now() + 7 * 3600e3).toISOString(); return `${d.slice(0, 10)} ${d.slice(11, 16)}`; };
const normLink = s => String(s || "").trim().replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();

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

async function ig(path, params = {}) {
  const url = new URL(IG_API + path);
  for (const [k, v] of Object.entries({ ...params, access_token: IG_TOKEN })) url.searchParams.set(k, v);
  const res = await fetch(url);
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) { const e = new Error(j.error?.message || `HTTP ${res.status}`); e.code = j.error?.code; throw e; }
  return j;
}

// Ambil metrik satu postingan. Kalau satu metrik ditolak, coba satu per satu biar yang lain tetap kebaca.
async function metricsOf(id) {
  const out = {}, gagal = [];
  const read = j => (j.data || []).forEach(m => { out[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? ""; });
  try { read(await ig(`/${id}/insights`, { metric: METRICS.join(",") })); }
  catch (e) {
    if (/permission|scope|authoriz/i.test(e.message)) throw e;
    for (const m of METRICS) {
      try { read(await ig(`/${id}/insights`, { metric: m })); } catch { gagal.push(m); }
    }
  }
  return { out, gagal };
}

async function main() {
  if (!IG_TOKEN || !KONTROL_KEY) throw new Error("Secret IG_TOKEN atau KONTROL_KEY belum diisi di repo.");
  const me = await ig("/me", { fields: "user_id,username,followers_count,media_count" });
  if (me.username !== EXPECT_USERNAME) throw new Error(`Token ini buat akun @${me.username}, bukan @${EXPECT_USERNAME}.`);
  log(`Token OK: @${me.username} · ${me.followers_count ?? "?"} followers · ${me.media_count ?? "?"} post`);

  const media = (await ig("/me/media", { fields: "id,permalink,timestamp,media_type,caption", limit: "50" })).data || [];
  log(`Postingan kebaca: ${media.length}`);

  const konten = ((await backend({ action: "get", range: "Konten!A2:R1000" })).values || []).filter(v => v[K.link]);
  const byLink = new Map(konten.map(v => [normLink(v[K.link]), v]));

  const rows = [];
  let izinDitolak = null;
  for (const m of media) {
    const k = byLink.get(normLink(m.permalink));
    const judul = k ? k[K.judul] : String(m.caption || "").split("\n")[0].slice(0, 80);
    const tayang = m.timestamp ? new Date(new Date(m.timestamp).getTime() + 7 * 3600e3).toISOString().slice(0, 16).replace("T", " ") : "";
    let met = {}, catatan = k ? "" : "di luar sheet";
    if (!izinDitolak) {
      try {
        const r = await metricsOf(m.id);
        met = r.out;
        if (r.gagal.length) catatan = [catatan, `metrik nggak tersedia: ${r.gagal.join(", ")}`].filter(Boolean).join("; ");
      } catch (e) { izinDitolak = e.message; }
    }
    if (izinDitolak) catatan = [catatan, "insight belum bisa dibaca (izin token)"].filter(Boolean).join("; ");
    rows.push([
      "'" + m.id, k ? k[K.id] : "", judul, m.permalink || "", "'" + tayang, m.media_type || "",
      met.views ?? "", met.reach ?? "", met.likes ?? "", met.comments ?? "", met.saved ?? "", met.shares ?? "", met.total_interactions ?? "",
      "'" + stamp(), catatan,
    ]);
  }

  await backend({ action: "addSheet", name: TAB, header: HEADER });
  // Tulis ulang seluruh isi tab (header + data), sisa baris lama dikosongin.
  const old = (await backend({ action: "get", range: `${TAB}!A1:O2000` })).values || [];
  const grid = [HEADER, ...rows];
  while (grid.length < old.length) grid.push(HEADER.map(() => ""));
  await backend({ action: "set", range: `${TAB}!A1:O${grid.length}`, values: grid });
  log(`Tab "${TAB}" diperbarui: ${rows.length} postingan.`);

  if (izinDitolak) {
    throw new Error(`Insight ditolak Instagram: ${izinDitolak}. Token perlu izin instagram_business_manage_insights — generate ulang token IGAA dengan izin itu dicentang, lalu ganti secret IG_TOKEN.`);
  }
}

main().catch(e => { console.error("GAGAL:", e.message); process.exit(1); });
