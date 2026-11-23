#!/usr/bin/env python3
"""Render video Reels Jejak Karya (1080x1920, 30 fps) dari file JSON adegan.

Pakai:
  python3 render_video.py naskah.json hasil.mp4            # render penuh
  python3 render_video.py naskah.json --frames 2.5 7 11    # simpan frame JPG buat dicek (frame_2.5.jpg, ...)

  python3 render_video.py naskah.json hasil.mp4 --tts gemini --vo Achird [--gaya "arah gaya bicara"]   # VO Gemini (env GEMINI_API_KEY)
  python3 render_video.py naskah.json hasil.mp4 --vo id-ID-ArdiNeural [--rate +5%]   # VO Microsoft (edge-tts)

Butuh: playwright (python) + Chromium, ffmpeg. Font & logo diunduh otomatis ke folder skrip kalau belum ada.
--vo butuh: pip install edge-tts, plus akses internet ke layanan suara Microsoft (jalan di GitHub Actions).
Pakai --vo: durasi tiap adegan otomatis ngikut panjang suara, subtitle karaoke pas sama kata yang diucapin.
Env opsional: CHROME (path Chrome/Chromium).

FORMAT JSON
{
  "judul_kecil": "Klien vs desainer",            # teks kecil kiri atas (opsional)
  "judul": "\"Revisi dikit\"\n==itu seberapa dikit?==",   # judul kiri atas; ==...== = warna biru; \n = baris baru
  "ilustrasi": true,                              # tampilkan tag ILUSTRASI di bawah (default true)
  "adegan": [ {ADEGAN}, ... ]                     # 3–12 adegan, total 15–60 detik
}

ADEGAN
{
  "durasi": 3.5,                    # detik (opsional; default dihitung dari panjang VO, ±2,6 kata/detik)
  "vo": "Klien bilang: revisi dikit ya kak.",   # naskah voice over = subtitle karaoke (maks ±14 kata/adegan)
  "highlight": "dikit",             # kata di VO yang diblok kuning (1–2 kata, harus persis ada di VO)
  "visual": {VISUAL},               # isi utama adegan (wajib)
  "label": "warna balik ke versi 1",   # opsional: label kuning penunjuk di bawah visual (maks ±6 kata)
  "catatan": "Bukan lo yang kurang sabar.\n**Kesepakatannya yang kosong.**",  # opsional: teks kecil di bawah (**tebal**)
  "cta": {"judul": "Simpan buat proyek berikutnya", "sub": "jejakkarya.github.io"}   # opsional: kartu ajakan (biasanya adegan terakhir)
}

VISUAL (pilih satu "tipe")
- chat      : {"tipe":"chat","nama":"Klien","pesan":[{"dari":"dia|gue","teks":"Revisi **dikit** ya kak","jam":"23.40","ngetik":true}, ...]}   maks 4 pesan
- daftar    : {"tipe":"daftar","ikon":"file|doc|chat|x|cek|uang","item":[{"judul":"final_v2.psd","sub":"disimpan 00.12"}, ...],
               "angka":{"label":"revisi ke-","dari":1,"ke":9}}      maks 6 item; "angka" opsional (angka besar di kanan)
- bandingan : {"tipe":"bandingan","baris":[{"label":"Yang dibayar","ket":"1 proyek","nilai":22,"warna":"biru|kuning|abu|merah"}, ...]}  nilai 0–100, maks 4 baris
- checklist : {"tipe":"checklist","judul":"Penawaran Desain","sub":"tulis sebelum mulai kerja","item":["Termasuk 2x revisi", ...]}   maks 4 item
- teks      : {"tipe":"teks","teks":"Exposure nggak bisa\nbuat bayar ==kos==.","sub":"opsional"}   pernyataan besar
- angka     : {"tipe":"angka","dari":0,"ke":9,"depan":"","belakang":" revisi","label":"buat 1 logo","sub":"opsional"}
- vs        : {"tipe":"vs","kiri":{"judul":"Mitos","isi":"Harga teman = baik hati","warna":"abu"},"kanan":{"judul":"Fakta","isi":"Diskon harga = diskon kerjaan","warna":"biru"}}
Teks di visual: **...** = tebal, ==...== = stabilo kuning. Jangan pakai emoji (nggak kebaca di renderer).
"""
import asyncio, json, os, re, subprocess, sys, shutil, urllib.request, html

HERE = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 1080, 1920, 30
FONTS = {
    "Gabarito.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/gabarito/Gabarito%5Bwght%5D.ttf",
    "HankenGrotesk.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/hankengrotesk/HankenGrotesk%5Bwght%5D.ttf",
}
LOGO_URL = "https://raw.githubusercontent.com/jejakkarya/jejakkarya.github.io/main/assets/img/logo-512.png"


def ensure_assets():
    os.makedirs(os.path.join(HERE, "fonts"), exist_ok=True)
    for name, url in FONTS.items():
        p = os.path.join(HERE, "fonts", name)
        if not os.path.exists(p):
            urllib.request.urlretrieve(url, p)
    lp = os.path.join(HERE, "logo.png")
    if not os.path.exists(lp):
        urllib.request.urlretrieve(LOGO_URL, lp)


def words(s):
    return [w for w in re.split(r"\s+", str(s or "").strip()) if w]


def normalize(data):
    sc = data.get("adegan") or []
    if not sc:
        raise SystemExit("JSON harus punya minimal 1 adegan.")
    t = 0.0
    for a in sc:
        if not a.get("visual"):
            raise SystemExit(f"Adegan tanpa visual: {a.get('vo','')[:40]}")
        if "_asli" not in a:
            a["_asli"] = a.get("durasi")
        n = len(words(a.get("vo")))
        a["durasi"] = float(a.get("durasi") or max(2.5, n / 2.6 + 0.7))
        a["mulai"] = round(t, 3)
        t += a["durasi"]
    data["total"] = round(t, 3)
    return data


def find_ffmpeg():
    ff = shutil.which("ffmpeg")
    if ff:
        return ff
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        raise SystemExit("ffmpeg nggak ada. Pasang: pip install imageio-ffmpeg --break-system-packages")


def bare(w):
    return re.sub(r"[^\w]", "", str(w).lower())


def align(ws, wb, lead, span):
    """Waktu mulai tiap kata caption (detik, relatif adegan) dari WordBoundary edge-tts."""
    out, j = [None] * len(ws), 0
    for i, w in enumerate(ws):
        b = bare(w)
        for k in range(j, min(j + 4, len(wb))):
            c = bare(wb[k][2])
            if b and c and (b == c or b.startswith(c) or c.startswith(b) or c in b):
                out[i], j = lead + wb[k][0], k + 1
                break
    # isi yang nggak ketemu: interpolasi
    known = [(i, t) for i, t in enumerate(out) if t is not None]
    if not known:
        tot = sum(len(w) + 2 for w in ws) or 1
        acc = 0
        for i, w in enumerate(ws):
            out[i] = lead + span * acc / tot
            acc += len(w) + 2
        return [round(t, 3) for t in out]
    first_i, first_t = known[0]
    for i in range(first_i):
        out[i] = lead + (first_t - lead) * i / max(first_i, 1)
    for (i0, t0), (i1, t1) in zip(known, known[1:]):
        for i in range(i0 + 1, i1):
            out[i] = t0 + (t1 - t0) * (i - i0) / (i1 - i0)
    last_i, last_t = known[-1]
    end = lead + span
    for i in range(last_i + 1, len(ws)):
        out[i] = last_t + (end - last_t) * (i - last_i) / (len(ws) - last_i)
    return [round(t, 3) for t in out]


async def tts(text, voice, rate):
    import edge_tts
    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:
        comm = edge_tts.Communicate(text, voice, rate=rate)
    audio, wb = bytearray(), []
    async for ch in comm.stream():
        if ch["type"] == "audio":
            audio += ch["data"]
        elif ch["type"] == "WordBoundary":
            wb.append((ch["offset"] / 1e7, ch["duration"] / 1e7, ch["text"]))
    return bytes(audio), wb


GEMINI_MODELS = ["gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"]
GAYA_DEFAULT = ("Casual Jakarta-style Indonesian, like chatting with a friend who is also a creative worker. "
                "Relaxed, warm, a little playful and lightly sarcastic, natural conversational rhythm and intonation, "
                "medium-fast pace. Not a news anchor, not an ad voice-over.")


def gemini_tts(text, voice, gaya, out_wav):
    """Suara dari Gemini TTS (WAV 24 kHz). Butuh env GEMINI_API_KEY."""
    import base64, urllib.error, time
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise SystemExit("GEMINI_API_KEY kosong.")
    bodies = [
        {"contents": [{"role": "user", "parts": [{"text": text, "speech_metadata": {"style": gaya}}]}]},
        {"contents": [{"role": "user", "parts": [{"text": f"{gaya}\nSay the following in Indonesian:\n{text}"}]}]},
    ]
    gen = {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}
    last = ""
    for model in ([os.environ["GEMINI_TTS_MODEL"]] if os.environ.get("GEMINI_TTS_MODEL") else GEMINI_MODELS):
        # model 3.8 baca teks persis (gaya lewat speech_metadata); model lama gaya ditaruh di teks
        for body in (bodies[:1] if model.startswith("gemini-3.8") else bodies[1:]):
            for attempt in range(12):
                req = urllib.request.Request(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                    data=json.dumps({**body, "generationConfig": gen}).encode(),
                    headers={"x-goog-api-key": key, "Content-Type": "application/json"})
                try:
                    j = json.loads(urllib.request.urlopen(req, timeout=120).read())
                    part = j["candidates"][0]["content"]["parts"][0]["inlineData"]
                    raw = base64.b64decode(part["data"])
                    mime = part.get("mimeType", "")
                    if raw[:4] == b"RIFF":
                        open(out_wav, "wb").write(raw)
                    else:  # PCM mentah 16-bit mono
                        import wave
                        rate = int((re.search(r"rate=(\d+)", mime) or [0, 24000])[1])
                        with wave.open(out_wav, "wb") as w:
                            w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(raw)
                    return model
                except urllib.error.HTTPError as e:
                    err = e.read().decode("utf-8", "replace")
                    last = f"{model} HTTP {e.code}: {err[:300]}"
                    if e.code == 429:
                        if re.search(r"PerDay", err):
                            raise SystemExit("Kuota harian Gemini TTS habis. Coba lagi besok, atau pasang billing di Google AI Studio.")
                        m = re.search(r'"retryDelay"\s*:\s*"(\d+)', err)
                        time.sleep(min(75, (int(m.group(1)) if m else 30) + 3))
                        continue
                    if e.code in (500, 503):
                        time.sleep(15 * (attempt + 1))
                        continue
                    break  # 400/404: coba bentuk body/model berikutnya
                except (KeyError, IndexError) as e:
                    last = f"{model}: respons tanpa audio ({e})"
                    break
            else:
                # kena batas terus: jangan pindah model (suaranya bisa beda), berhenti aja
                raise SystemExit("Gemini TTS kena batas terus: " + last)
    raise SystemExit("Gemini TTS gagal: " + last)


def trim_silence(ff, src, dst):
    subprocess.run([ff, "-v", "error", "-y", "-i", src, "-af",
                    "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
                    "-ar", "44100", "-ac", "1", dst], check=True)


def make_vo(data, voice, rate, workdir, engine="edge", gaya=""):
    """Bikin suara per adegan, set durasi & waktu kata, lalu gabung jadi satu WAV. Balikin path WAV."""
    import wave
    ff = find_ffmpeg()
    os.makedirs(workdir, exist_ok=True)
    LEAD, TAIL = 0.3, 0.45
    sc = data["adegan"]
    for i, a in enumerate(sc):
        text = re.sub(r"\*\*|==", "", str(a.get("vo") or "")).strip()
        if not text:
            continue
        wv = os.path.join(workdir, f"a{i}.wav")
        if engine == "gemini":
            raw = os.path.join(workdir, f"a{i}_raw.wav")
            maks = len(words(text)) / 1.3 + 2.5  # lebih lama dari ini = kemungkinan suaranya ngaco
            for coba in range(3):
                used = gemini_tts(text, voice, gaya or GAYA_DEFAULT, raw)
                trim_silence(ff, raw, wv)
                with wave.open(wv) as w:
                    pj = w.getnframes() / w.getframerate()
                print(f"adegan {i + 1}: {used} {pj:.1f} dtk")
                if pj <= maks:
                    break
            else:
                raise SystemExit(f"Suara adegan {i + 1} kepanjangan ({pj:.1f} dtk), kemungkinan ngaco.")
            wb = []
        else:
            mp3, wb = asyncio.run(tts(text, voice, rate))
            if not mp3:
                raise SystemExit(f"Suara kosong buat adegan {i + 1}.")
            mp = os.path.join(workdir, f"a{i}.mp3")
            open(mp, "wb").write(mp3)
            subprocess.run([ff, "-v", "error", "-y", "-i", mp, "-ar", "44100", "-ac", "1", wv], check=True)
        with wave.open(wv) as w:
            ln = w.getnframes() / w.getframerate()
        a["_wav"], a["_len"] = wv, ln
        a["durasi"] = round(max(float(a.get("_asli") or 0), LEAD + ln + TAIL, 2.0), 3)
        a["kata"] = align(words(a.get("vo")), wb, LEAD, ln)
    normalize(data)
    ins, flt = [], []
    for a in sc:
        if a.get("_wav"):
            ms = int(round((a["mulai"] + LEAD) * 1000))
            k = len(ins) // 2
            flt.append(f"[{k}:a]adelay={ms}|{ms}[v{k}]")
            ins += ["-i", a.pop("_wav")]
            a.pop("_len", None)
    out = os.path.join(workdir, "vo.wav")
    n = len(ins) // 2
    if not n:
        return None
    mix = "".join(f"[v{k}]" for k in range(n)) + f"amix=inputs={n}:normalize=0:dropout_transition=0,apad,atrim=0:{data['total']:.3f}[o]"
    subprocess.run([ff, "-v", "error", "-y", *ins, "-filter_complex", ";".join(flt + [mix]), "-map", "[o]", "-ar", "44100", "-ac", "2", out], check=True)
    return out


CSS = r"""
@font-face{font-family:Gabarito;src:url(fonts/Gabarito.ttf)}
@font-face{font-family:Hanken;src:url(fonts/HankenGrotesk.ttf)}
:root{--ink:#141826;--blue:#2846d8;--mark:#ffcf4a;--bg:#f6f7fb;--soft:#e7ecff;--grey:#c9cde0;--muted:#5b6178;--red:#e2544b}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--bg)}
body{font-family:Hanken,sans-serif;color:var(--ink);position:relative}
.abs{position:absolute}
b,strong{font-weight:800}
mark{background:linear-gradient(transparent 12%,var(--mark) 12%,var(--mark) 92%,transparent 92%);color:inherit;padding:0 .12em;border-radius:6px}
#bg{inset:0;background:radial-gradient(1200px 900px at 85% 10%,#e3e9ff 0,transparent 60%),radial-gradient(900px 900px at 0% 100%,#eef1fb 0,transparent 60%),var(--bg)}
#grid{inset:-80px 0 0 0;background-image:linear-gradient(#dfe4f3 1.5px,transparent 1.5px),linear-gradient(90deg,#dfe4f3 1.5px,transparent 1.5px);background-size:72px 72px;opacity:.55}
#head{left:64px;top:96px;right:330px}
#head .k{font:600 26px/1 Hanken;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
#head .t{font:800 62px/1.06 Gabarito;margin-top:14px;letter-spacing:-.01em}
#head .t em{font-style:normal;color:var(--blue)}
#badge{right:56px;top:96px;background:#fff;border-radius:999px;padding:12px 22px 12px 12px;display:flex;align-items:center;gap:12px;box-shadow:0 6px 20px rgba(20,24,38,.08);font:800 28px Gabarito}
#badge img{width:48px;height:48px;border-radius:12px}
#badge b{background:var(--mark);padding:2px 8px;border-radius:6px}
#tag{left:64px;top:1830px;font:600 22px Hanken;color:#9aa0b8;letter-spacing:.08em}
.scene{left:0;top:400px;width:1080px;height:1040px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:40px;padding:0 90px}
.card{background:#fff;border-radius:40px;box-shadow:0 24px 60px rgba(20,24,38,.12),0 2px 0 rgba(20,24,38,.04)}
/* chat */
.chat{width:720px;overflow:hidden;padding-bottom:36px}
.chat .bar{height:116px;background:var(--ink);color:#fff;display:flex;align-items:center;gap:22px;padding:0 36px;margin-bottom:30px}
.chat .av{width:62px;height:62px;border-radius:50%;background:var(--soft);display:grid;place-items:center;color:var(--blue);font:800 30px Gabarito}
.chat .nm{font:700 32px Hanken}.chat .st{font:500 22px Hanken;color:#9aa3c7;margin-top:4px}
.chat .row{display:flex;padding:0 36px;margin-top:22px;position:relative}
.chat .row.gue{justify-content:flex-end}
.bub{max-width:540px;background:var(--soft);border-radius:30px 30px 30px 8px;padding:22px 28px;font:600 35px/1.3 Hanken}
.bub small{display:block;font:500 20px Hanken;color:var(--muted);margin-top:8px;text-align:right}
.gue .bub{background:var(--blue);color:#fff;border-radius:30px 30px 8px 30px}.gue .bub small{color:#c7d1ff}
.dots{position:absolute;left:36px;top:0;background:var(--soft);border-radius:30px;padding:24px 28px;display:flex;gap:10px}
.dots i{width:16px;height:16px;border-radius:50%;background:#8d95b8;display:block}
/* daftar */
.daftar{display:flex;align-items:flex-start;gap:30px;width:100%}
.daftar .items{display:flex;flex-direction:column;gap:20px;flex:1}
.it{display:flex;align-items:center;gap:24px;padding:20px 28px;border-radius:28px}
.it .ic{width:68px;height:68px;border-radius:16px;background:var(--soft);display:grid;place-items:center;flex:none;font:800 22px Gabarito;color:var(--blue)}
.it .jd{font:700 32px/1.2 Hanken}.it .sb{font:500 22px Hanken;color:var(--muted);margin-top:4px}
.daftar .num{text-align:right;flex:none;min-width:220px;padding-top:10px}
.num .l{font:700 30px Hanken;color:var(--muted)}.num .n{font:800 210px/0.9 Gabarito;color:var(--blue);letter-spacing:-.04em}
/* bandingan */
.band{width:100%;display:flex;flex-direction:column;gap:46px}
.band .bl{font:700 34px Hanken;margin-bottom:16px;display:flex;justify-content:space-between;gap:20px}
.band .bl span{color:var(--muted);font-weight:600}
.band .track{height:84px;border-radius:22px;background:#e6e9f4;overflow:hidden}
.band .fill{height:100%;border-radius:22px;width:0}
/* checklist */
.check{width:820px;padding:52px 58px}
.check .dh{font:800 46px Gabarito}.check .ds{font:500 26px Hanken;color:var(--muted);margin-top:8px}
.check .ln2{height:16px;border-radius:8px;background:#eceff7;margin-top:20px}
.chk{display:flex;align-items:center;gap:26px;margin-top:32px;font:700 36px/1.25 Hanken}
.chk svg{flex:none}
/* teks besar */
.teks{text-align:center}
.teks .big{font:800 96px/1.08 Gabarito;letter-spacing:-.02em}
.teks .sub{font:600 36px/1.35 Hanken;color:var(--muted);margin-top:30px}
/* angka */
.angka{text-align:center}
.angka .n{font:800 300px/0.9 Gabarito;color:var(--blue);letter-spacing:-.05em}
.angka .l{font:800 54px Gabarito;margin-top:20px}.angka .s{font:600 34px Hanken;color:var(--muted);margin-top:14px}
/* vs */
.vs{display:flex;gap:28px;width:100%;align-items:stretch}
.vs .col{flex:1;padding:44px 40px;border-radius:36px}
.vs .h{font:800 30px Gabarito;letter-spacing:.1em;text-transform:uppercase}
.vs .i{font:800 50px/1.15 Gabarito;margin-top:22px}
.vs .abu{background:#e6e9f4;color:#4a5068}.vs .biru{background:var(--blue);color:#fff}.vs .kuning{background:var(--mark)}.vs .merah{background:#fde3e1;color:#7a1f19}
/* label, catatan, cta */
.call{display:flex;flex-direction:column;align-items:center}
.call .dot{width:18px;height:18px;border-radius:50%;background:var(--ink);border:4px solid #fff;box-shadow:0 0 0 3px var(--ink)}
.call .ln{width:4px;height:44px;background:var(--ink)}
.call .lab{background:var(--mark);font:800 30px Gabarito;padding:12px 22px;border-radius:14px;box-shadow:0 6px 16px rgba(20,24,38,.12);text-align:center;max-width:860px}
.cat{width:100%;font:600 34px/1.4 Hanken;color:var(--muted)}.cat b{color:var(--ink)}
.cta{width:820px;padding:32px 42px;background:var(--ink);color:#fff;border-radius:34px;display:flex;align-items:center;gap:26px}
.cta img{width:84px;height:84px;border-radius:20px;background:#fff;flex:none}
.cta .a{font:800 38px/1.15 Gabarito}.cta .b{font:600 26px Hanken;color:#aab3d8;margin-top:6px}
/* caption */
#cap{left:60px;right:60px;top:1500px;display:flex;justify-content:center}
#cap .pill{background:rgba(20,24,38,.92);color:#fff;border-radius:26px;padding:24px 34px;font:800 52px/1.25 Gabarito;text-align:center;max-width:960px}
#cap .w{display:inline-block;margin:0 .02em}
#cap .w.hl{background:var(--mark);color:var(--ink);padding:0 .18em;border-radius:10px}
"""

ENGINE = r"""
const D=window.DATA;
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const P=(t,a,b)=>clamp((t-a)/(b-a));
const eo=x=>1-Math.pow(1-x,3);
const eio=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const back=x=>{const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/==(.+?)==/g,"<mark>$1</mark>").replace(/\n/g,"<br>");
const ICON={file:"PSD",doc:"DOC",chat:"...",x:"&#10005;",cek:"&#10003;",uang:"Rp"};
const CK=`<svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="26" fill="#2846d8"/><path data-draw d="M16 29l8 8 16-17" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="40" stroke-dashoffset="40"/></svg>`;
const COLOR={biru:"var(--blue)",kuning:"var(--mark)",abu:"#9aa0b8",merah:"var(--red)"};

// header
document.getElementById("hk").innerHTML=esc(D.judul_kecil||"");
document.getElementById("ht").innerHTML=esc(D.judul||"").replace(/==(.+?)==/g,"<em>$1</em>").replace(/\n/g,"<br>");
if(D.ilustrasi===false)document.getElementById("tag").remove();

// tiap elemen animasi: {el, a(jenis), t(detik relatif adegan), d(durasi), ...}
const scenes=[];
const root=document.getElementById("scenes");
D.adegan.forEach((A,si)=>{
  const s=document.createElement("div");s.className="scene abs";root.appendChild(s);
  const dur=A.durasi,anims=[];const add=(el,a,t,d=.4,x={})=>{anims.push({el,a,t,d,...x});return el;};
  const V=A.visual,tp=V.tipe;let main;
  const span=(a,b)=>[a*dur,b*dur];
  if(tp==="chat"){
    main=document.createElement("div");main.className="chat card";
    main.innerHTML=`<div class="bar"><div class="av">${esc((V.nama||"K")[0])}</div><div><div class="nm">${esc(V.nama||"Klien")}</div><div class="st">online</div></div></div>`;
    const ms=(V.pesan||[]).slice(0,4),[a,b]=span(.08,.72);
    ms.forEach((m,i)=>{const r=document.createElement("div");r.className="row "+(m.dari==="gue"?"gue":"dia");
      r.innerHTML=`<div class="bub">${fmt(m.teks)}${m.jam?`<small>${esc(m.jam)}</small>`:""}</div>`;main.appendChild(r);
      const at=a+(ms.length>1?(b-a)*i/(ms.length-1):0);
      if(m.ngetik&&m.dari!=="gue"){const d=document.createElement("div");d.className="dots";d.innerHTML="<i></i><i></i><i></i>";r.appendChild(d);add(d,"typing",Math.max(0,at-.55),.55);}
      add(r.querySelector(".bub"),"pop",at,.4);});
  }else if(tp==="daftar"){
    main=document.createElement("div");main.className="daftar";
    const box=document.createElement("div");box.className="items";main.appendChild(box);
    const its=(V.item||[]).slice(0,6),[a,b]=span(.06,.62);
    its.forEach((it,i)=>{const e=document.createElement("div");e.className="it card";e.style.marginLeft=(i*6)+"px";
      e.innerHTML=`<div class="ic">${ICON[V.ikon]||ICON.doc}</div><div><div class="jd">${fmt(it.judul)}</div>${it.sub?`<div class="sb">${fmt(it.sub)}</div>`:""}</div>`;
      box.appendChild(e);add(e,"slidein",a+(its.length>1?(b-a)*i/(its.length-1):0),.4);});
    if(V.angka){const n=document.createElement("div");n.className="num";n.innerHTML=`<div class="l">${esc(V.angka.label||"")}</div><div class="n">${esc(V.angka.dari??0)}</div>`;main.appendChild(n);
      add(n,"up",a,.4);add(n.querySelector(".n"),"count",a+.1,(b-a),{from:+(V.angka.dari||0),to:+(V.angka.ke||0)});}
  }else if(tp==="bandingan"){
    main=document.createElement("div");main.className="band";
    const rows=(V.baris||[]).slice(0,4);
    rows.forEach((r,i)=>{const e=document.createElement("div");e.innerHTML=`<div class="bl">${fmt(r.label)} <span>${fmt(r.ket||"")}</span></div><div class="track"><div class="fill" style="background:${COLOR[r.warna]||COLOR.biru}"></div></div>`;
      main.appendChild(e);add(e,"up",.1+i*.25,.4);add(e.querySelector(".fill"),"bar",.4+i*.35,Math.min(1.6,dur*.35),{w:clamp(+r.nilai||0,0,100)});});
  }else if(tp==="checklist"){
    main=document.createElement("div");main.className="check card";
    main.innerHTML=`<div class="dh">${fmt(V.judul||"")}</div>${V.sub?`<div class="ds">${fmt(V.sub)}</div>`:""}<div class="ln2" style="width:90%"></div><div class="ln2" style="width:70%"></div>`;
    const its=(V.item||[]).slice(0,4),[a,b]=span(.15,.6);
    its.forEach((t,i)=>{const e=document.createElement("div");e.className="chk";e.innerHTML=CK+`<span>${fmt(t)}</span>`;main.appendChild(e);
      const at=a+(its.length>1?(b-a)*i/(its.length-1):0);add(e,"slidein",at,.35);add(e.querySelector("[data-draw]"),"draw",at+.1,.35);});
    add(main,"up",0,.45);
  }else if(tp==="teks"){
    main=document.createElement("div");main.className="teks";
    main.innerHTML=`<div class="big">${fmt(V.teks||"")}</div>${V.sub?`<div class="sub">${fmt(V.sub)}</div>`:""}`;
    add(main.querySelector(".big"),"pop",.1,.5);main.querySelectorAll("mark").forEach(m=>add(m,"mark",.55,.5));
    if(V.sub)add(main.querySelector(".sub"),"up",.5,.4);
  }else if(tp==="angka"){
    main=document.createElement("div");main.className="angka";
    main.innerHTML=`<div class="n"><span data-pre>${esc(V.depan||"")}</span><span data-num>${esc(V.dari??0)}</span><span>${esc(V.belakang||"")}</span></div>${V.label?`<div class="l">${fmt(V.label)}</div>`:""}${V.sub?`<div class="s">${fmt(V.sub)}</div>`:""}`;
    add(main.querySelector(".n"),"pop",.05,.45);add(main.querySelector("[data-num]"),"count",.2,Math.max(.6,dur*.5),{from:+(V.dari||0),to:+(V.ke||0)});
    if(V.label)add(main.querySelector(".l"),"up",.45,.4);if(V.sub)add(main.querySelector(".s"),"up",.65,.4);
  }else if(tp==="vs"){
    main=document.createElement("div");main.className="vs";
    [["kiri","abu"],["kanan","biru"]].forEach(([k,c],i)=>{const o=V[k]||{};const e=document.createElement("div");e.className="col "+(o.warna||c);
      e.innerHTML=`<div class="h">${esc(o.judul||"")}</div><div class="i">${fmt(o.isi||"")}</div>`;main.appendChild(e);add(e,"pop",.1+i*dur*.35,.45);});
  }else{main=document.createElement("div");main.className="teks";main.innerHTML=`<div class="big">${fmt(V.teks||tp)}</div>`;}
  s.appendChild(main);
  if(A.label){const c=document.createElement("div");c.className="call";c.innerHTML=`<div class="dot"></div><div class="ln"></div><div class="lab">${fmt(A.label)}</div>`;s.appendChild(c);add(c,"up",dur*.5,.4);}
  if(A.catatan){const c=document.createElement("div");c.className="cat";c.innerHTML=fmt(A.catatan);s.appendChild(c);add(c,"up",dur*.62,.4);}
  if(A.cta){const c=document.createElement("div");c.className="cta";c.innerHTML=`<img src="logo.png" alt=""><div><div class="a">${fmt(A.cta.judul||"")}</div>${A.cta.sub?`<div class="b">${fmt(A.cta.sub)}</div>`:""}</div>`;s.appendChild(c);add(c,"pop",dur*.55,.45);}
  // caption: kata dibagi rata sepanjang 8%–85% durasi, ditimbang panjang kata
  const ws=String(A.vo||"").trim().split(/\s+/).filter(Boolean);
  const hl=String(A.highlight||"").toLowerCase().split(/\s+/).filter(Boolean).map(x=>x.replace(/[^\p{L}\p{N}-]/gu,""));
  const tot=ws.reduce((n,w)=>n+w.length+2,0)||1;let acc=0;
  const K=Array.isArray(A.kata)&&A.kata.length===ws.length?A.kata:null;
  const cw=ws.map((w,i)=>{const at=K?K[i]:dur*(.08+.77*acc/tot);acc+=w.length+2;const bare=w.toLowerCase().replace(/[^\p{L}\p{N}-]/gu,"");return{w,at,hl:hl.includes(bare)};});
  scenes.push({s,start:A.mulai,dur,anims,cw});
});

const pill=document.getElementById("pill"),cap=document.getElementById("cap");let cur=-1;
function vis(el,o,tx=0,ty=0,sc=1){el.style.opacity=o;el.style.transform=`translate(${tx}px,${ty}px) scale(${sc})`;el.style.visibility=o<=.001?"hidden":"visible";}
function render(t){
  const h=eo(P(t,0,.6));vis(document.getElementById("head"),h,0,(1-h)*-30);vis(document.getElementById("badge"),h,0,(1-h)*-30);
  const tag=document.getElementById("tag");if(tag)vis(tag,.9*P(t,.4,.9));
  document.getElementById("grid").style.transform=`translateY(${(t*6)%72}px)`;
  let k=-1;
  scenes.forEach((S,i)=>{
    const lt=t-S.start,last=i===scenes.length-1;
    const inQ=eo(P(lt,0,.45)),outQ=last?0:eio(P(lt,S.dur-.35,S.dur));
    const on=lt>=0&&lt<S.dur+(last?99:0);
    if(!on){S.s.style.display="none";return;}
    S.s.style.display="flex";
    if(lt<S.dur||last)k=i;
    vis(S.s,inQ*(1-outQ),-outQ*160,(1-inQ)*70);
    S.anims.forEach(A=>{const q=P(lt,A.t,A.t+A.d),e=A.el;
      if(A.a==="up"){const z=eo(q);vis(e,z,0,(1-z)*40);}
      else if(A.a==="pop"){const z=back(q);vis(e,clamp(q*2),0,(1-clamp(z))*30,.86+.14*z);}
      else if(A.a==="slidein"){const z=back(q);vis(e,clamp(q*2),(1-clamp(z))*-110,0,.92+.08*z);}
      else if(A.a==="typing"){vis(e,lt>=A.t&&lt<A.t+A.d?1:0);[...e.children].forEach((d,j)=>{d.style.transform=`translateY(${Math.sin(lt*14-j*.9)*6}px)`;});}
      else if(A.a==="bar"){e.style.width=(A.w*eio(q))+"%";}
      else if(A.a==="count"){const v=Math.round(A.from+(A.to-A.from)*eio(q));e.textContent=v.toLocaleString("id-ID");e.style.display="inline-block";e.style.transform=`scale(${1+.1*Math.max(0,1-P(lt,A.t+A.d,A.t+A.d+.35))*(q>=1?1:0)})`;}
      else if(A.a==="draw"){e.style.strokeDashoffset=40*(1-eo(q));}
      else if(A.a==="mark"){e.style.backgroundSize=`${100*eo(q)}% 100%`;e.style.backgroundRepeat="no-repeat";}
    });
  });
  if(k<0){vis(cap,0);return;}
  const S=scenes[k],lt=t-S.start;
  if(k!==cur){pill.innerHTML=S.cw.map(w=>`<span class="w${w.hl?" hl":""}">${esc(w.w)}</span>`).join(" ");cur=k;}
  if(!S.cw.length){vis(cap,0);return;}
  const last=k===scenes.length-1,ci=eo(P(lt,.05,.3)),co=last?0:eio(P(lt,S.dur-.25,S.dur));vis(cap,ci*(1-co),0,(1-ci)*24-co*14);
  [...pill.children].forEach((s,i)=>{const w=S.cw[i],q=eo(P(lt,w.at,w.at+.18));s.style.opacity=.18+.82*q;s.style.transform=`translateY(${(1-q)*10}px) scale(${w.hl?.9+.1*back(P(lt,w.at,w.at+.35)):1})`;});
}
window.render=render;window.TOTAL=D.total;render(0);
"""


def build_html(data):
    return f"""<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div id="bg" class="abs"></div><div id="grid" class="abs"></div>
<div id="head" class="abs"><div class="k" id="hk"></div><div class="t" id="ht"></div></div>
<div id="badge" class="abs"><img src="logo.png" alt=""><span>jejak <b>karya</b></span></div>
<div id="scenes"></div>
<div id="cap" class="abs"><div class="pill" id="pill"></div></div>
<div id="tag" class="abs">ILUSTRASI</div>
<script>window.DATA={json.dumps(data, ensure_ascii=False)};</script>
<script>{ENGINE}</script></body></html>"""


async def run(data, out=None, frames=None, audio=None):
    from playwright.async_api import async_playwright
    page_path = os.path.join(HERE, "_video.html")
    with open(page_path, "w", encoding="utf-8") as f:
        f.write(build_html(data))
    async with async_playwright() as p:
        kw = {"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}
        b = await p.chromium.launch(**kw)
        pg = await b.new_page(viewport={"width": W, "height": H})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + page_path)
        await pg.evaluate("document.fonts.ready")
        await pg.wait_for_timeout(300)
        if errs:
            raise SystemExit("Error di halaman: " + "; ".join(errs))
        total = await pg.evaluate("window.TOTAL")
        if frames:
            for t in frames:
                await pg.evaluate(f"render({t})")
                await pg.screenshot(path=f"frame_{t}.jpg", type="jpeg", quality=88)
                print(f"frame_{t}.jpg")
        else:
            ff = find_ffmpeg()
            ain = ["-i", audio] if audio else ["-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo"]
            tmp = out + ".part.mp4"
            proc = subprocess.Popen([ff, "-v", "error", "-y", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                     *ain, "-af", "apad", "-shortest",
                                     "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p",
                                     "-c:a", "aac", "-b:a", "128k" if audio else "64k", "-movflags", "+faststart", tmp], stdin=subprocess.PIPE)
            n = int(round(total * FPS))
            for i in range(n):
                await pg.evaluate(f"render({i / FPS})")
                proc.stdin.write(await pg.screenshot(type="jpeg", quality=92))
            proc.stdin.close()
            if proc.wait() != 0:
                raise SystemExit("ffmpeg gagal.")
            os.replace(tmp, out)
            print(f"{out} · {total:.1f} detik · {n} frame")
        await b.close()


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        sys.exit(1)
    opt = {}
    for k in ("--vo", "--rate", "--tts", "--gaya"):
        if k in a:
            i = a.index(k)
            opt[k] = a[i + 1]
            del a[i:i + 2]
    data = normalize(json.load(open(a[0], encoding="utf-8")))
    ensure_assets()
    audio = None
    if opt.get("--vo") and not (len(a) > 1 and a[1] == "--frames"):
        audio = make_vo(data, opt["--vo"], opt.get("--rate", "+0%"), os.path.join(HERE, "_vo"),
                        engine=opt.get("--tts", "edge"), gaya=opt.get("--gaya", ""))
    if len(a) > 1 and a[1] == "--frames":
        asyncio.run(run(data, frames=[float(x) for x in a[2:]] or [1.0]))
    else:
        out = a[1] if len(a) > 1 else os.path.splitext(a[0])[0] + ".mp4"
        asyncio.run(run(data, out=out, audio=audio))


if __name__ == "__main__":
    main()
