#!/usr/bin/env python3
"""Render Reels ber-voice over di GitHub Actions.

Nyari konten Format = Reels, Status = "Desain siap", yang foldernya punya naskah*.json
lebih baru dari video "-vo.mp4" (atau belum ada). Naskah dirender pakai render_video.py --vo,
lalu MP4 disimpan balik ke folder Drive konten itu sebagai "<ID>-vo.mp4".

Env: KONTROL_KEY (wajib), GEMINI_API_KEY (kalau suara Gemini), KONTEN_ID (opsional, paksa satu konten),
VO_VOICE (opsional; kalau kosong diambil dari tab Panduan baris "Suara VO Reels", contoh "gemini: Achird").
"""
import base64, json, os, re, subprocess, sys, tempfile, time, urllib.request
from datetime import datetime, timedelta, timezone

BACKEND_URL = "https://script.google.com/macros/s/AKfycbwDVSLoU4CFZ9Vlnl_FlR6zRB67dsBgq20UohBXybC162gi6cfTdGy1IDEWYkN8bVvfGg/exec"
KEY = os.environ.get("KONTROL_KEY", "")
HERE = os.path.dirname(os.path.abspath(__file__))
K = dict(id=0, judul=2, format=4, st=7, folder=12)


def backend(body, tries=3):
    data = json.dumps({**body, "key": KEY}).encode()
    for i in range(tries):
        try:
            req = urllib.request.Request(BACKEND_URL, data=data, headers={"Content-Type": "text/plain;charset=utf-8"})
            j = json.loads(urllib.request.urlopen(req, timeout=300).read())
            if not j.get("ok"):
                raise RuntimeError(f"Backend: {j.get('code')} {j.get('message', '')}")
            return j
        except RuntimeError:
            raise
        except Exception as e:
            if i == tries - 1:
                raise
            print("ulang backend:", e)
            time.sleep(5)


def stamp():
    return (datetime.now(timezone.utc) + timedelta(hours=7)).strftime("%Y-%m-%d %H:%M")


def log(kid, judul, hasil, detail):
    try:
        backend({"action": "addSheet", "name": "Log Upload", "header": ["Waktu", "ID Konten", "Judul", "Hasil", "Detail"]})
    except Exception:
        pass
    backend({"action": "append", "sheet": "Log Upload", "values": [["'" + stamp(), kid, judul, hasil, str(detail)[:4000]]]})


def folder_id(s):
    m = re.search(r"folders/([\w-]+)", str(s or "")) or re.search(r"id=([\w-]+)", str(s or ""))
    return m.group(1) if m else (str(s).strip() if re.fullmatch(r"[\w-]{20,}", str(s or "").strip()) else "")


def voice_cfg():
    """Dari Panduan baris "Suara VO Reels". Format:
    gemini: Achird | arah gaya bicara (opsional)      -> Gemini TTS (butuh GEMINI_API_KEY)
    gemini: Zubenelgenubi / Callirrhoe                -> A/B test, suara digilir per konten
    id-ID-ArdiNeural, +5%                             -> Microsoft edge-tts
    Balikin list pilihan (tiap pilihan = list argumen buat render_video.py)."""
    v = os.environ.get("VO_VOICE", "").strip()
    if not v:
        rows = backend({"action": "get", "range": "Panduan!A1:B60"}).get("values") or []
        for row in rows:
            if row and re.match(r"suara vo", str(row[0]), re.I) and len(row) > 1:
                v = str(row[1]).strip()
                break
    m = re.match(r"\s*gemini\s*:?\s*([A-Za-z /,]+?)\s*(?:\|\s*(.+))?$", v or "", re.S | re.I)
    if m:
        names = [x for x in re.split(r"[\s/,]+", m.group(1)) if x]
        gaya = ["--gaya", m.group(2).strip()] if m.group(2) and m.group(2).strip() else []
        return [["--tts", "gemini", "--vo", n, *gaya] for n in names]
    n = re.search(r"[a-z]{2}-[A-Z]{2}-\w+Neural", v or "")
    r = re.search(r"[+-]\d{1,2}%", v or "")
    return [["--vo", n.group(0) if n else "id-ID-ArdiNeural", "--rate", r.group(0) if r else "+5%"]]


def pick_voice(opts, kid):
    """1 suara: pakai itu. Lebih dari 1 (A/B test): konten yang pernah dirender tetap pakai suara yang sama,
    konten baru dapet suara yang paling jarang dipakai (dihitung dari Log Upload "Video VO")."""
    if len(opts) == 1:
        return opts[0]
    names = [o[o.index("--vo") + 1] for o in opts]
    try:
        logs = backend({"action": "get", "range": "Log Upload!A2:E5000"}).get("values") or []
    except Exception:
        logs = []
    used, count = {}, {n: 0 for n in names}
    for row in logs:
        row = row + [""] * 5
        if row[3] != "Video VO":
            continue
        mm = re.search(r"--vo (\S+)", row[4])
        if mm and mm.group(1) in count:
            if row[1] not in used:
                count[mm.group(1)] += 1
            used[row[1]] = mm.group(1)
    if kid in used:
        return opts[names.index(used[kid])]
    return opts[names.index(min(names, key=lambda n: (count[n], names.index(n))))]


def recent_fail():
    """ID konten yang gagal dirender < 2 jam lalu (biar kuota suara nggak abis buat ngulang yang gagal)."""
    try:
        logs = backend({"action": "get", "range": "Log Upload!A2:E5000"}).get("values") or []
    except Exception:
        return set()
    batas = (datetime.now(timezone.utc) + timedelta(hours=7) - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M")
    return {r[1] for r in logs if len(r) > 3 and r[3] == "Gagal video VO" and str(r[0]).lstrip("'") >= batas}


def jobs():
    only = os.environ.get("KONTEN_ID", "").strip()
    rows = backend({"action": "get", "range": "Konten!A2:R1000"}).get("values") or []
    gagal = set() if only else recent_fail()
    out = []
    for v in rows:
        v = v + [""] * (18 - len(v))
        if only and v[K["id"]] != only:
            continue
        if not re.search(r"reels?", v[K["format"]], re.I):
            continue
        if not only and v[K["st"]] != "Desain siap":
            continue
        fid = folder_id(v[K["folder"]])
        if not fid:
            continue
        if v[K["id"]] in gagal:
            print(v[K["id"]], "baru gagal < 2 jam lalu, dilewati dulu")
            continue
        files = backend({"action": "files", "folderId": fid}).get("files") or []
        js = sorted([f for f in files if f["title"].lower().endswith(".json") and "naskah" in f["title"].lower()],
                    key=lambda f: f.get("updated", ""), reverse=True)
        if not js:
            print(v[K["id"]], "belum ada naskah.json")
            continue
        vo = [f for f in files if f["title"].lower().endswith("-vo.mp4")]
        if vo and not only and max(f.get("updated", "") for f in vo) >= js[0].get("updated", "~"):
            continue
        out.append((v, fid, js[0]))
    return out


def manual_mode():
    """Panduan "Suara VO Reels" diisi "manual": Oky rekam VO sendiri, render otomatis berhenti."""
    v = os.environ.get("VO_VOICE", "").strip()
    if not v:
        rows = backend({"action": "get", "range": "Panduan!A1:B60"}).get("values") or []
        for row in rows:
            if row and re.match(r"suara vo", str(row[0]), re.I) and len(row) > 1:
                v = str(row[1]).strip()
                break
    return bool(re.match(r"\s*manual", v or "", re.I))


def main():
    if not KEY:
        sys.exit("KONTROL_KEY kosong.")
    if not os.environ.get("KONTEN_ID", "").strip() and manual_mode():
        print("Suara VO Reels = manual, render otomatis dimatiin.")
        gh = os.environ.get("GITHUB_OUTPUT")
        if gh and "--cek" in sys.argv:
            open(gh, "a").write("ok=0\n")
        return
    todo = jobs()
    if "--cek" in sys.argv:
        print(f"{len(todo)} Reels perlu dirender")
        gh = os.environ.get("GITHUB_OUTPUT")
        if gh:
            open(gh, "a").write(f"ok={1 if todo else 0}\n")
        return
    if not todo:
        print("Nggak ada Reels yang perlu dirender.")
        return
    # 1 Reels per jalan (kuota suara gratis terbatas); sisanya diambil jalan berikutnya (±20 menit)
    todo.sort(key=lambda t: (str(t[0][5]), str(t[0][6])))
    todo = todo[:int(os.environ.get("MAX_PER_RUN", "1"))]
    opts = voice_cfg()
    print("Pilihan suara:", [o[o.index("--vo") + 1] for o in opts])
    for v, fid, js in todo:
        kid, judul = v[K["id"]], v[K["judul"]]
        try:
            vargs = pick_voice(opts, kid)
            print(kid, "suara:", " ".join(vargs[:4]))
            naskah = base64.b64decode(backend({"action": "file", "fileId": js["id"]})["data"])
            with tempfile.TemporaryDirectory() as td:
                jp, mp = os.path.join(td, "naskah.json"), os.path.join(td, f"{kid}-vo.mp4")
                open(jp, "wb").write(naskah)
                subprocess.run([sys.executable, os.path.join(HERE, "render_video.py"), jp, mp, *vargs], check=True)
                data = base64.b64encode(open(mp, "rb").read()).decode()
                mb = os.path.getsize(mp) / 1e6
            backend({"action": "upload", "folderId": fid, "name": f"{kid}-vo.mp4", "mimeType": "video/mp4", "data": data, "replace": True})
            log(kid, judul, "Video VO", f"{kid}-vo.mp4 ({mb:.1f} MB) dari {js['title']}, suara {' '.join(vargs[:4])}{' (A/B test)' if len(opts) > 1 else ''}")
            print(kid, "beres")
        except Exception as e:
            msg = str(e)
            if "Aksi tidak dikenal: upload" in msg:
                msg = "Backend dashboard belum versi 3 (belum bisa simpan file). Ganti Code.gs lalu deploy ulang."
            print(kid, "GAGAL:", msg)
            try:
                log(kid, judul, "Gagal video VO", msg)
            except Exception:
                pass


if __name__ == "__main__":
    main()
