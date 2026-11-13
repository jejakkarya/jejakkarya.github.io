/* Jejak Karya Mandiri: form isi portofolio dengan preview langsung. */
(function () {
  'use strict';

  var CFG = window.JK_MANDIRI || {};
  var DASAR_P = CFG.dasarP || '/p/';
  var MAKS_KARYA = 8;
  var KUNCI = 'jk-mandiri-v1';
  var LANGKAH = ['desain', 'profil', 'karya', 'kontak', 'terbit'];
  var DESAIN = [
    { id: 'nama-besar', nama: 'Nama Besar', ket: 'Nama tampil besar, karya bertingkat.', no: 1 },
    { id: 'blok-warna', nama: 'Blok Warna', ket: 'Blok kuning berani, karya pertama selebar layar.', no: 2 },
    { id: 'grid-kotak', nama: 'Grid Kotak', ket: 'Karya rapi seperti feed Instagram.', no: 3 },
    { id: 'satu-kolom', nama: 'Satu Kolom', ket: 'Gaya link-in-bio, enak dibuka dari HP.', no: 4 },
    { id: 'neo-brutal', nama: 'Neo-Brutal', ket: 'Garis tebal dan kartu warna-warni.', no: 5 },
  ];
  var KONTAK = ['email', 'whatsapp', 'linkedin', 'instagram', 'tiktok', 'behance', 'dribbble', 'youtube', 'website'];

  var HALUS = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // ===================================================================
  // State
  // ===================================================================
  function stateBaru() {
    var kontak = {};
    KONTAK.forEach(function (k) { kontak[k] = ''; });
    return {
      v: 1,
      desain: 'nama-besar',
      langkah: 'desain',
      isi: { nama: '', peran: '', pembuka: '', status: '', tema: 'terang', foto: '', tentang: '', tools: '', kontak: kontak, karya: [] },
      kode: '', slug: '', terbit: null, terkunci: false,
    };
  }
  var state = stateBaru();
  var fotoLokal = {}; // id -> { blob, url }

  function idAcak() {
    var s = '';
    var h = 'abcdefghijkmnpqrstuvwxyz23456789';
    for (var i = 0; i < 8; i++) s += h.charAt(Math.floor(Math.random() * h.length));
    return s;
  }
  function karyaBaru() {
    return { id: idAcak(), tipe: 'gambar', judul: '', keterangan: '', kategori: '', gambar: '', youtube: '', sampul: '', tegak: false, kutipan: '', isi: '' };
  }

  // ---------- Simpan ke browser ----------
  var timerSimpan;
  function simpan() {
    clearTimeout(timerSimpan);
    timerSimpan = setTimeout(function () {
      try {
        localStorage.setItem(KUNCI, JSON.stringify(state));
        tulisInfo('Draf tersimpan');
      } catch (e) {
        tulisInfo('Draf gagal disimpan di browser ini');
      }
    }, 300);
  }
  function tulisInfo(t) { var el = $('#simpan-info'); if (el) el.textContent = t; }

  // ---------- IndexedDB untuk foto ----------
  var dbJanji = null;
  function db() {
    if (dbJanji) return dbJanji;
    dbJanji = new Promise(function (ok, gagal) {
      if (!('indexedDB' in window)) return gagal(new Error('tanpa IndexedDB'));
      var r = indexedDB.open('jk-mandiri', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('foto'); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { gagal(r.error); };
    });
    return dbJanji;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (ok, gagal) {
        var tx = d.transaction('foto', mode);
        var hasil = fn(tx.objectStore('foto'));
        tx.oncomplete = function () { ok(hasil && hasil.result); };
        tx.onerror = function () { gagal(tx.error); };
      });
    }).catch(function () { return null; });
  }
  function simpanFoto(id, blob) { return idb('readwrite', function (s) { return s.put(blob, id); }); }
  function ambilFoto(id) { return idb('readonly', function (s) { return s.get(id); }); }
  function hapusFoto(id) {
    if (fotoLokal[id]) { URL.revokeObjectURL(fotoLokal[id].url); delete fotoLokal[id]; }
    return idb('readwrite', function (s) { return s.delete(id); });
  }

  // ===================================================================
  // Foto: kompres di browser
  // ===================================================================
  function kompres(file, sisiMaks) {
    return new Promise(function (ok, gagal) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var s = Math.min(1, sisiMaks / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * s));
        var h = Math.max(1, Math.round(img.naturalHeight * s));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        var coba = function (q) {
          c.toBlob(function (b) {
            if (!b) return gagal(new Error('gagal'));
            if (b.size > 900000 && q > 0.55) return coba(q - 0.12);
            ok(b);
          }, 'image/jpeg', q);
        };
        coba(0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); gagal(new Error('format')); };
      img.src = url;
    });
  }

  function urlFoto(ref) {
    if (!ref) return '';
    if (ref.charAt(0) === '@') return fotoLokal[ref.slice(1)] ? fotoLokal[ref.slice(1)].url : '';
    if (ref.indexOf('r:') === 0) return state.slug ? DASAR_P + state.slug + '/foto/' + ref.slice(2) : '';
    return '';
  }

  function gantiFoto(lama, baru) {
    if (lama && lama.charAt(0) === '@' && lama !== baru) {
      var masihDipakai = refFoto().filter(function (r) { return r === lama; }).length > 0;
      if (!masihDipakai) hapusFoto(lama.slice(1));
    }
  }

  function refFoto() {
    var r = [state.isi.foto];
    state.isi.karya.forEach(function (k) { r.push(k.gambar, k.sampul); });
    return r.filter(Boolean);
  }

  function prosesFoto(input, sisi, setter, tampil) {
    var file = input.files && input.files[0];
    if (!file) return;
    var wadah = input.closest('label') || input;
    wadah.classList.add('sedang');
    kompres(file, sisi).then(function (blob) {
      var id = idAcak();
      fotoLokal[id] = { blob: blob, url: URL.createObjectURL(blob) };
      return simpanFoto(id, blob).then(function () {
        var lama = setter('@' + id);
        gantiFoto(lama, '@' + id);
        tampil();
        simpan();
        segarkan();
      });
    }).catch(function () {
      alert('Foto ini tidak bisa dibaca. Coba pakai foto JPG atau PNG.');
    }).then(function () {
      wadah.classList.remove('sedang');
      input.value = '';
    });
  }

  // ===================================================================
  // Isi untuk preview dan untuk terbit
  // ===================================================================
  function paragraf(t) { return String(t || '').split(/\n\s*\n/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean); }
  function koma(t) { return String(t || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean); }
  function idYouTube(u) {
    u = String(u || '').trim();
    var m = u.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(u) ? u : '');
  }

  // petaFoto(ref) mengubah referensi foto jadi url (preview) atau nama file (terbit)
  function susunIsi(petaFoto, pratinjau) {
    var s = state.isi;
    var contoh = function (f) { return DASAR_P + 't/' + state.desain + '/foto/' + f; };
    var isi = {
      nama: s.nama.trim() || (pratinjau ? 'Nama Kamu' : ''),
      peran: s.peran.trim() || (pratinjau ? 'Peran Kamu' : ''),
      pembuka: s.pembuka.trim() || (pratinjau ? 'Tulis satu atau dua kalimat tentang dirimu di sini.' : ''),
      status: s.status.trim(),
      tema: s.tema === 'gelap' ? 'gelap' : 'terang',
      foto: petaFoto(s.foto) || (pratinjau ? contoh('foto-profil.jpg') : ''),
      deskripsi: '',
      tentang: paragraf(s.tentang).slice(0, 3),
      tools: koma(s.tools).slice(0, 20),
      kontak: {},
      karya: [],
    };
    isi.deskripsi = 'Portofolio ' + (s.nama.trim() || 'Nama Kamu') + (s.peran.trim() ? ', ' + s.peran.trim() : '') + '.';
    if (pratinjau && !isi.tentang.length) isi.tentang = ['Ceritakan tentang dirimu di bagian ini: perjalananmu, apa yang paling kamu suka kerjakan, dan posisi yang kamu incar.'];
    if (pratinjau && !isi.tools.length) isi.tools = ['Tool 1', 'Tool 2', 'Tool 3'];
    KONTAK.forEach(function (k) { isi.kontak[k] = (s.kontak[k] || '').trim(); });
    s.karya.slice(0, MAKS_KARYA).forEach(function (k, i) {
      var x = { judul: k.judul.trim() || (pratinjau ? 'Judul karya ' + (i + 1) : ''), keterangan: k.keterangan.trim(), kategori: k.kategori.trim() || 'Karya', tipe: k.tipe };
      if (k.tipe === 'gambar') {
        x.gambar = petaFoto(k.gambar);
        if (k.tegak) x.tegak = true;
      } else if (k.tipe === 'video') {
        x.youtube = k.youtube.trim();
        x.sampul = petaFoto(k.sampul);
        x.tegak = !!k.tegak;
      } else {
        x.kutipan = k.kutipan.trim();
        x.isi = paragraf(k.isi).slice(0, 10);
        if (pratinjau && !x.kutipan && !x.isi.length) x.kutipan = '“Potongan tulisanmu akan tampil di sini.”';
      }
      isi.karya.push(x);
    });
    if (pratinjau && !isi.karya.length) {
      isi.karya = [
        { judul: 'Judul karya pertama', keterangan: 'Contoh. Tambahkan karyamu di langkah Karya.', kategori: 'Kategori A', tipe: 'gambar', gambar: contoh('karya-1.jpg') },
        { judul: 'Judul karya kedua', keterangan: 'Contoh tampilan karya tegak.', kategori: 'Kategori B', tipe: 'gambar', gambar: contoh('karya-2.jpg'), tegak: true },
        { judul: 'Judul karya ketiga', keterangan: 'Contoh tampilan karya mendatar.', kategori: 'Kategori A', tipe: 'gambar', gambar: contoh('karya-4.jpg') },
      ];
    }
    return isi;
  }

  window.jkPratinjau = function () { return susunIsi(urlFoto, true); };

  // ===================================================================
  // Preview
  // ===================================================================
  var iframe, wrap, layar = 'hp', gulirTersimpan = 0, timerSegar;
  function srcDesain() { return DASAR_P + 't/' + state.desain + '/index.html'; }

  function muatPreview() {
    var src = srcDesain();
    if (iframe.getAttribute('data-src') !== src) {
      gulirTersimpan = 0;
      iframe.setAttribute('data-src', src);
      iframe.src = src;
      return;
    }
    try {
      gulirTersimpan = iframe.contentWindow.scrollY || 0;
      iframe.contentWindow.location.reload();
    } catch (e) {
      iframe.src = src;
    }
  }
  function segarkan() {
    clearTimeout(timerSegar);
    timerSegar = setTimeout(muatPreview, 450);
  }
  function pasUkuran() {
    if (!wrap || !wrap.clientWidth) return;
    var W = wrap.clientWidth, H = wrap.clientHeight;
    var w, h, s;
    if (layar === 'hp') {
      w = 390;
      s = Math.min(1, (W - 24) / w);
      h = (H - 24) / s;
    } else {
      w = 1280;
      s = W / w;
      h = H / s;
    }
    iframe.style.width = w + 'px';
    iframe.style.height = h + 'px';
    iframe.style.transform = 'translateX(-50%) scale(' + s + ')';
    wrap.classList.toggle('hp', layar === 'hp');
  }

  // ===================================================================
  // Form: isian satuan
  // ===================================================================
  function isiKeForm() {
    $$('[data-isi]').forEach(function (el) { el.value = state.isi[el.getAttribute('data-isi')] || ''; });
    $$('[data-kontak]').forEach(function (el) { el.value = state.isi.kontak[el.getAttribute('data-kontak')] || ''; });
    $$('[data-tema]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-tema') === state.isi.tema)); });
    tampilFotoProfil();
    hitungSemua();
    renderDesain();
    renderKarya();
    renderTerbit();
    if (KONTAK.slice(4).some(function (k) { return state.isi.kontak[k]; })) $('.lainnya').open = true;
  }

  function tampilFotoProfil() {
    var el = $('#foto-profil-pratinjau');
    var u = urlFoto(state.isi.foto);
    el.style.backgroundImage = u ? 'url("' + u + '")' : '';
    el.classList.toggle('ada', !!u);
  }

  function hitungSemua() {
    $$('[data-hitung]').forEach(function (el) {
      var k = el.getAttribute('data-hitung');
      el.textContent = (state.isi[k] || '').length + ' / ' + el.getAttribute('data-maks') + ' karakter';
    });
  }

  function ikatIsian() {
    $$('[data-isi]').forEach(function (el) {
      el.addEventListener('input', function () {
        state.isi[el.getAttribute('data-isi')] = el.value;
        hitungSemua();
        tandaiLangkah();
        simpan();
        segarkan();
      });
    });
    $$('[data-kontak]').forEach(function (el) {
      el.addEventListener('input', function () {
        state.isi.kontak[el.getAttribute('data-kontak')] = el.value;
        tandaiLangkah();
        simpan();
        segarkan();
      });
    });
    $$('[data-tema]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.isi.tema = b.getAttribute('data-tema');
        $$('[data-tema]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        simpan();
        segarkan();
      });
    });
    $('[data-foto="foto"]').addEventListener('change', function (e) {
      prosesFoto(e.target, 1000, function (ref) { var l = state.isi.foto; state.isi.foto = ref; return l; }, tampilFotoProfil);
    });
  }

  // ===================================================================
  // Desain
  // ===================================================================
  function renderDesain() {
    var g = $('#desain-grid');
    g.innerHTML = '';
    DESAIN.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'desain-opsi';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(state.desain === d.id));
      b.innerHTML = '<img alt="" loading="lazy" width="320" height="200"><b></b><span></span>';
      b.querySelector('img').src = '../assets/img/contoh-basic-' + d.no + '.jpg';
      b.querySelector('b').textContent = d.nama;
      b.querySelector('span').textContent = d.ket;
      b.addEventListener('click', function () {
        state.desain = d.id;
        $$('.desain-opsi', g).forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
        simpan();
        muatPreview();
      });
      g.appendChild(b);
    });
  }

  // ===================================================================
  // Karya
  // ===================================================================
  var TIPE = [['gambar', 'Gambar'], ['video', 'Video'], ['tulisan', 'Tulisan']];

  function el(tag, attrs, anak) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (anak || []).forEach(function (a) { if (a) e.appendChild(a); });
    return e;
  }

  function fieldTeks(label, k, kunci, opsi) {
    opsi = opsi || {};
    var input = opsi.area ? el('textarea', { rows: opsi.rows || 3, maxlength: opsi.maks || 300 }) : el('input', { type: opsi.type || 'text', maxlength: opsi.maks || 120 });
    if (opsi.ph) input.placeholder = opsi.ph;
    if (opsi.list) input.setAttribute('list', opsi.list);
    input.value = k[kunci] || '';
    input.addEventListener('input', function () {
      k[kunci] = input.value;
      if (kunci === 'judul') {
        var h = input.closest('.karya').querySelector('h3');
        h.textContent = input.value.trim() || 'Karya baru';
      }
      if (kunci === 'kategori') isiDaftarKategori();
      if (kunci === 'youtube' && /\/shorts\//.test(input.value) && !k.tegakDiubah) {
        k.tegak = true;
        var c = input.closest('.karya').querySelector('[data-tegak]');
        if (c) c.checked = true;
      }
      tandaiLangkah();
      simpan();
      segarkan();
    });
    var lab = el('label', { class: 'field' + (opsi.span ? ' span-2' : '') }, [el('span', { html: label })]);
    lab.appendChild(input);
    if (opsi.bantuan) lab.appendChild(el('small', { text: opsi.bantuan }));
    return lab;
  }

  function fieldUnggah(label, k, kunci, bantuan) {
    var kotak = el('div', { class: 'unggah-kotak' }, [el('span', { text: 'Belum ada' })]);
    var tampil = function () {
      var u = urlFoto(k[kunci]);
      kotak.style.backgroundImage = u ? 'url("' + u + '")' : '';
      kotak.classList.toggle('ada', !!u);
    };
    var input = el('input', { type: 'file', accept: 'image/*', class: 'sr-only' });
    input.addEventListener('change', function () {
      prosesFoto(input, 1600, function (ref) { var l = k[kunci]; k[kunci] = ref; return l; }, tampil);
    });
    var tombol = el('label', { class: 'btn btn-line btn-kecil' }, [input, document.createTextNode(k[kunci] ? 'Ganti' : 'Pilih')]);
    tampil();
    var isiKanan = el('div', {}, [tombol]);
    if (bantuan) isiKanan.appendChild(el('p', { class: 'note', text: bantuan, style: 'margin-top:6px' }));
    return el('div', { class: 'field span-2' }, [el('span', { text: label }), el('div', { class: 'unggah' }, [kotak, isiKanan])]);
  }

  function cekTegak(k, label) {
    var c = el('input', { type: 'checkbox', 'data-tegak': '1' });
    c.checked = !!k.tegak;
    c.addEventListener('change', function () { k.tegak = c.checked; k.tegakDiubah = true; simpan(); segarkan(); });
    return el('label', { class: 'cek span-2' }, [c, document.createTextNode(label)]);
  }

  function kartuKarya(k, i, total) {
    var kepala = el('div', { class: 'karya-kepala' }, [
      el('h3', { text: (i + 1) + '. ' + (k.judul.trim() || 'Karya baru') }),
    ]);
    kepala.querySelector('h3').textContent = k.judul.trim() || 'Karya baru';
    var naik = el('button', { type: 'button', class: 'ikon-btn', 'aria-label': 'Pindah ke atas', text: '↑' });
    var turun = el('button', { type: 'button', class: 'ikon-btn', 'aria-label': 'Pindah ke bawah', text: '↓' });
    var hapus = el('button', { type: 'button', class: 'ikon-btn hapus', text: 'Hapus' });
    naik.disabled = i === 0;
    turun.disabled = i === total - 1;
    naik.addEventListener('click', function () { pindah(i, -1); });
    turun.addEventListener('click', function () { pindah(i, 1); });
    hapus.addEventListener('click', function () {
      if ((k.judul || k.gambar || k.youtube || k.isi) && !confirm('Hapus karya "' + (k.judul || 'ini') + '"?')) return;
      state.isi.karya.splice(i, 1);
      [k.gambar, k.sampul].forEach(function (r) { gantiFoto(r, ''); });
      renderKarya(); tandaiLangkah(); simpan(); segarkan();
    });
    [naik, turun, hapus].forEach(function (b) { kepala.appendChild(b); });

    var seg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Tipe karya' });
    TIPE.forEach(function (t) {
      var b = el('button', { type: 'button', 'aria-pressed': String(k.tipe === t[0]), text: t[1] });
      b.addEventListener('click', function () { k.tipe = t[0]; renderKarya(); simpan(); segarkan(); });
      seg.appendChild(b);
    });

    var grid = el('div', { class: 'grid' }, [
      fieldTeks('Judul', k, 'judul', { maks: 120, ph: 'Identitas visual kedai kopi', span: true }),
      fieldTeks('Keterangan <em>opsional</em>', k, 'keterangan', { maks: 300, ph: 'Untuk siapa, apa peranmu, hasilnya apa.', span: true }),
      fieldTeks('Kategori', k, 'kategori', { maks: 40, ph: 'Branding', list: 'daftar-kategori', bantuan: 'Jadi tombol filter. Pakai nama yang sama untuk karya sejenis.', span: true }),
    ]);
    if (k.tipe === 'gambar') {
      grid.appendChild(fieldUnggah('Gambar', k, 'gambar', 'Mendatar ±1280×720 atau tegak ±720×1280.'));
      grid.appendChild(cekTegak(k, 'Gambar tegak (poster, feed, story)'));
    } else if (k.tipe === 'video') {
      grid.appendChild(fieldTeks('Link YouTube', k, 'youtube', { type: 'url', maks: 200, ph: 'https://youtu.be/...', bantuan: 'Video Instagram/TikTok upload dulu ke YouTube (boleh unlisted).', span: true }));
      grid.appendChild(fieldUnggah('Sampul <em>opsional</em>'.replace(/<[^>]+>/g, ''), k, 'sampul', 'Kosongkan untuk pakai gambar dari YouTube.'));
      grid.appendChild(cekTegak(k, 'Video tegak (Reels, TikTok, Shorts)'));
    } else {
      grid.appendChild(fieldTeks('Potongan pendek', k, 'kutipan', { maks: 300, ph: '“Kalimat terbaik dari tulisanmu.”', bantuan: 'Tampil di kartu karya.', span: true }));
      grid.appendChild(fieldTeks('Isi tulisan', k, 'isi', { area: true, rows: 6, maks: 6000, ph: 'Tempel tulisanmu di sini.', bantuan: 'Pisahkan paragraf dengan baris kosong. Tulis **seperti ini** untuk teks tebal.', span: true }));
    }
    return el('div', { class: 'karya', 'data-id': k.id }, [kepala, seg, grid]);
  }

  function pindah(i, arah) {
    var a = state.isi.karya, j = i + arah;
    if (j < 0 || j >= a.length) return;
    var t = a[i]; a[i] = a[j]; a[j] = t;
    renderKarya(); simpan(); segarkan();
  }

  function renderKarya() {
    var d = $('#daftar-karya');
    d.innerHTML = '';
    var a = state.isi.karya;
    if (!a.length) d.appendChild(el('p', { class: 'kosong', text: 'Belum ada karya. Preview menampilkan contoh sampai kamu menambahkan karya.' }));
    a.forEach(function (k, i) { d.appendChild(kartuKarya(k, i, a.length)); });
    var t = $('#tambah-karya');
    t.disabled = a.length >= MAKS_KARYA;
    t.textContent = a.length >= MAKS_KARYA ? 'Sudah 8 karya (maksimal)' : '+ Tambah karya';
    isiDaftarKategori();
  }

  function isiDaftarKategori() {
    var dl = $('#daftar-kategori');
    var ada = {};
    dl.innerHTML = '';
    state.isi.karya.forEach(function (k) {
      var v = k.kategori.trim();
      if (v && !ada[v.toLowerCase()]) { ada[v.toLowerCase()] = 1; dl.appendChild(el('option', { value: v })); }
    });
  }

  // ===================================================================
  // Langkah
  // ===================================================================
  function tandaiLangkah() {
    var s = state.isi;
    var selesai = {
      desain: true,
      profil: !!(s.nama.trim() && s.peran.trim()),
      karya: s.karya.length > 0,
      kontak: KONTAK.some(function (k) { return (s.kontak[k] || '').trim(); }),
      terbit: !!state.terbit,
    };
    $$('.steps button').forEach(function (b) { b.classList.toggle('selesai', !!selesai[b.getAttribute('data-ke')]); });
    if (state.langkah === 'terbit') renderCek();
  }

  function keLangkah(nama, gulir) {
    state.langkah = nama;
    $$('.step').forEach(function (s) { s.hidden = s.getAttribute('data-langkah') !== nama; });
    $$('.steps button').forEach(function (b) {
      if (b.getAttribute('data-ke') === nama) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    var i = LANGKAH.indexOf(nama);
    $('#btn-kembali').style.visibility = i === 0 ? 'hidden' : 'visible';
    $('#btn-lanjut').style.visibility = i === LANGKAH.length - 1 ? 'hidden' : 'visible';
    $('#btn-lanjut-hp').textContent = i === LANGKAH.length - 1 ? 'Terbitkan' : 'Lanjut';
    if (nama === 'terbit') renderTerbit();
    simpan();
    if (gulir) {
      var top = $('.steps').getBoundingClientRect().top + window.scrollY - 70;
      window.scrollTo({ top: Math.max(0, top), behavior: HALUS });
    }
  }
  function geser(arah) {
    var i = LANGKAH.indexOf(state.langkah) + arah;
    if (i >= 0 && i < LANGKAH.length) keLangkah(LANGKAH[i], true);
  }

  // ===================================================================
  // Cek isian & terbit
  // ===================================================================
  function periksa() {
    var s = state.isi, kurang = [], saran = [];
    if (!s.nama.trim()) kurang.push(['Nama belum diisi.', 'profil']);
    if (!s.peran.trim()) kurang.push(['Peran / posisi belum diisi.', 'profil']);
    if (!s.karya.length) kurang.push(['Belum ada karya. Tambahkan minimal satu.', 'karya']);
    s.karya.forEach(function (k, i) {
      var n = 'Karya ' + (i + 1) + (k.judul.trim() ? ' (' + k.judul.trim() + ')' : '');
      if (!k.judul.trim()) kurang.push(['Karya ' + (i + 1) + ': judul belum diisi.', 'karya']);
      if (k.tipe === 'gambar' && !k.gambar) kurang.push([n + ': gambar belum dipilih.', 'karya']);
      if (k.tipe === 'video' && !idYouTube(k.youtube)) kurang.push([n + ': link YouTube belum diisi atau tidak terbaca.', 'karya']);
      if (k.tipe === 'tulisan' && !paragraf(k.isi).length && !k.kutipan.trim()) kurang.push([n + ': isi tulisan masih kosong.', 'karya']);
    });
    if (!(s.kontak.email || '').trim() && !(s.kontak.whatsapp || '').trim()) kurang.push(['Isi minimal email atau WhatsApp supaya HRD bisa menghubungimu.', 'kontak']);
    if (!s.foto) saran.push(['Foto profil belum ada.', 'profil']);
    if (!s.pembuka.trim()) saran.push(['Kalimat pembuka masih kosong.', 'profil']);
    if (!paragraf(s.tentang).length) saran.push(['Bagian "Tentang kamu" masih kosong.', 'profil']);
    return { kurang: kurang, saran: saran };
  }

  function renderCek() {
    var c = $('#cek-isian'), p = periksa();
    c.innerHTML = '';
    var baris = function (kelas, item) {
      var e = el('p', { class: kelas, text: item[0] + ' ' });
      var b = el('button', { type: 'button', class: 'link-btn', text: 'Perbaiki' });
      b.addEventListener('click', function () { keLangkah(item[1], true); });
      e.appendChild(b);
      c.appendChild(e);
    };
    p.kurang.forEach(function (x) { baris('kurang', x); });
    p.saran.forEach(function (x) { baris('saran', x); });
    if (!p.kurang.length) c.appendChild(el('p', { class: 'siap', text: p.saran.length ? 'Sudah bisa diterbitkan. Saran di atas boleh dilewati.' : 'Semua sudah lengkap. Siap diterbitkan!' }));
    return p;
  }

  function renderTerbit() {
    renderCek();
    var punyaSlug = !!state.slug;
    $('#field-slug').hidden = punyaSlug;
    var tetap = $('#slug-tetap');
    tetap.hidden = !punyaSlug;
    if (punyaSlug) tetap.textContent = 'Alamat: ' + location.host + DASAR_P + state.slug + '/';
    $('#slug-awal').textContent = location.host + DASAR_P;
    $('#slug').value = state.slugDraf || '';
    $('#kode').value = state.kode || '';
    $('#btn-terbit').textContent = punyaSlug ? 'Terbitkan perubahan' : 'Terbitkan portofolio';
    $('#btn-terbit').disabled = !!state.terkunci;
    var pesan = $('#pesan-terbit');
    if (state.terkunci) {
      pesan.textContent = 'Masa edit 2 bulan untuk kode ini sudah habis. Portofoliomu tetap bisa dibuka. Untuk mengubah isi, hubungi Jejak Karya lewat WhatsApp.';
      pesan.className = 'note bad';
    }
    $('#info-kode').hidden = !!state.kode;
    if (state.terbit) tampilHasil(state.terbit, false);
  }

  function tampilHasil(t, baru) {
    var h = $('#hasil-terbit');
    h.hidden = false;
    $('#hasil-judul').textContent = baru ? (t.pertama ? 'Portofoliomu sudah terbit!' : 'Perubahan sudah diterbitkan!') : 'Portofoliomu sudah online';
    $('#hasil-url').textContent = t.url.replace(/^https?:\/\//, '');
    $('#hasil-url').href = t.url;
    $('#buka-url').href = t.url;
    $('#hasil-batas').textContent = t.batasEdit ? 'Kamu bisa mengubah isi sampai ' + t.batasEdit + ' pakai kode yang sama.' : '';
  }

  var SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
  function jadiSlug(t) {
    return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 40);
  }
  var timerSlug;
  function ikatSlug() {
    var input = $('#slug'), info = $('#slug-info');
    input.addEventListener('focus', function () {
      if (!input.value && state.isi.nama.trim()) { input.value = jadiSlug(state.isi.nama); input.dispatchEvent(new Event('input')); }
    });
    input.addEventListener('input', function () {
      var v = input.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      if (v !== input.value) input.value = v;
      state.slugDraf = v;
      simpan();
      clearTimeout(timerSlug);
      info.className = '';
      if (!v) { info.textContent = 'Huruf kecil, angka, dan tanda strip. Tidak bisa diganti setelah terbit.'; return; }
      if (!SLUG_RE.test(v)) { info.textContent = 'Minimal 3 karakter, tidak diawali atau diakhiri tanda strip.'; info.className = 'bad'; return; }
      if (!CFG.api) { info.textContent = 'Alamatmu nanti: ' + location.host + DASAR_P + v + '/'; return; }
      info.textContent = 'Mengecek…';
      timerSlug = setTimeout(function () {
        fetch(CFG.api + '?aksi=cek-slug&slug=' + encodeURIComponent(v)).then(function (r) { return r.json(); }).then(function (r) {
          if (input.value !== v) return;
          info.textContent = r.tersedia ? 'Tersedia: ' + location.host + DASAR_P + v + '/' : r.pesan;
          info.className = r.tersedia ? 'ok' : 'bad';
        }).catch(function () { info.textContent = 'Belum bisa mengecek sekarang. Tetap bisa dicoba saat terbit.'; });
      }, 500);
    });
    $('#kode').addEventListener('input', function (e) {
      state.kode = e.target.value.trim().toUpperCase();
      simpan();
    });
  }

  function keBase64(blob) {
    return new Promise(function (ok, gagal) {
      var r = new FileReader();
      r.onload = function () { ok(String(r.result).split(',')[1]); };
      r.onerror = function () { gagal(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function terbit() {
    var pesan = $('#pesan-terbit'), btn = $('#btn-terbit');
    var salah = function (t) { pesan.textContent = t; pesan.className = 'note bad'; };
    pesan.className = 'note';
    if (state.terkunci) return;
    if (!CFG.api) return salah('Penerbitan belum aktif. Hubungi Jejak Karya lewat WhatsApp.');
    var p = renderCek();
    if (p.kurang.length) return salah('Lengkapi dulu isian yang ditandai merah di atas.');
    var kode = ($('#kode').value || '').trim().toUpperCase();
    if (!kode) { $('#kode').focus(); return salah('Masukkan kode akses dulu.'); }
    var slug = state.slug || ($('#slug').value || '').trim();
    if (!state.slug && !SLUG_RE.test(slug)) { $('#slug').focus(); return salah('Alamat portofolio belum valid.'); }

    // Foto: baru dikirim, lama cukup disebut namanya
    var baru = {};
    var peta = function (ref) {
      if (!ref) return '';
      if (ref.charAt(0) === '@') { var n = 'f-' + ref.slice(1) + '.jpg'; baru[n] = ref.slice(1); return n; }
      if (ref.indexOf('r:') === 0) return ref.slice(2);
      return '';
    };
    var isi = susunIsi(peta, false);
    var kurangFoto = Object.keys(baru).filter(function (n) { return !fotoLokal[baru[n]]; });
    if (kurangFoto.length) return salah('Ada foto yang hilang dari browser ini. Pilih ulang fotonya lalu terbitkan lagi.');

    btn.disabled = true;
    btn.textContent = 'Menerbitkan…';
    pesan.textContent = Object.keys(baru).length ? 'Mengunggah ' + Object.keys(baru).length + ' foto. Jangan tutup halaman ini.' : 'Menyimpan perubahan…';

    Promise.all(Object.keys(baru).map(function (n) {
      return keBase64(fotoLokal[baru[n]].blob).then(function (d) { return { nama: n, data: d }; });
    })).then(function (foto) {
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var batas = setTimeout(function () { if (ctrl) ctrl.abort(); }, 120000);
      return fetch(CFG.api, {
        method: 'POST',
        body: JSON.stringify({ aksi: 'terbit', kode: kode, slug: slug, desain: state.desain, isi: isi, foto: foto }),
        signal: ctrl ? ctrl.signal : undefined,
      }).then(function (r) { clearTimeout(batas); return r.json(); });
    }).then(function (r) {
      if (!r || !r.ok) throw new Error((r && r.pesan) || 'Gagal menerbitkan.');
      // Foto baru sekarang sudah ada di server
      var ubah = function (ref) {
        if (ref && ref.charAt(0) === '@') { var id = ref.slice(1); hapusFoto(id); return 'r:f-' + id + '.jpg'; }
        return ref;
      };
      state.slug = r.slug;
      state.isi.foto = ubah(state.isi.foto);
      state.isi.karya.forEach(function (k) { k.gambar = ubah(k.gambar); k.sampul = ubah(k.sampul); });
      state.kode = kode;
      state.terbit = { url: r.url, batasEdit: r.batasEdit, pertama: r.pertama };
      simpan();
      pesan.textContent = '';
      renderTerbit();
      tampilHasil(state.terbit, true);
      tandaiLangkah();
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: r.pertama ? 'mandiri-terbit' : 'mandiri-perbarui', title: 'Mandiri terbit', event: true });
      }
    }).catch(function (e) {
      salah(e.name === 'AbortError' ? 'Koneksi terlalu lama. Cek internetmu lalu coba lagi.' :
        (e.message === 'Failed to fetch' ? 'Tidak bisa terhubung. Cek internetmu lalu coba lagi.' : e.message));
    }).then(function () {
      btn.disabled = !!state.terkunci;
      btn.textContent = state.slug ? 'Terbitkan perubahan' : 'Terbitkan portofolio';
    });
  }

  // ===================================================================
  // Masuk (edit portofolio yang sudah terbit)
  // ===================================================================
  function ikatMasuk() {
    var dlg = $('#dlg-masuk'), pesan = $('#pesan-masuk');
    $('#btn-masuk').addEventListener('click', function () {
      pesan.textContent = '';
      $('#kode-masuk').value = state.kode || '';
      dlg.showModal();
    });
    $('#batal-masuk').addEventListener('click', function () { dlg.close(); });
    $('#form-masuk').addEventListener('submit', function (e) {
      e.preventDefault();
      var kode = $('#kode-masuk').value.trim().toUpperCase();
      if (!kode) return;
      if (!CFG.api) { pesan.textContent = 'Fitur ini belum aktif.'; pesan.className = 'note pesan-masuk bad'; return; }
      pesan.className = 'note pesan-masuk';
      pesan.textContent = 'Memuat…';
      fetch(CFG.api + '?aksi=muat&kode=' + encodeURIComponent(kode)).then(function (r) { return r.json(); }).then(function (r) {
        if (!r.ok) throw new Error(r.pesan);
        if (r.isi) {
          var adaDraf = state.isi.nama || state.isi.karya.length;
          if (adaDraf && state.slug !== r.slug && !confirm('Ganti draf di browser ini dengan isi portofolio yang sudah terbit?')) {
            pesan.textContent = ''; return;
          }
          dariServer(r);
        }
        state.kode = kode;
        state.terkunci = !!r.masaEditHabis;
        if (r.url) state.terbit = { url: r.url, batasEdit: r.batasEdit, pertama: false };
        simpan();
        isiKeForm();
        tandaiLangkah();
        muatPreview();
        dlg.close();
        keLangkah(r.isi ? 'profil' : state.langkah, true);
        tulisInfo(r.isi ? 'Portofolio dimuat' : 'Kode valid. Lanjutkan mengisi.');
      }).catch(function (err) {
        pesan.textContent = err.message === 'Failed to fetch' ? 'Tidak bisa terhubung. Cek internetmu.' : err.message;
        pesan.className = 'note pesan-masuk bad';
      });
    });
  }

  function dariServer(r) {
    var x = r.isi, f = function (n) { return n ? 'r:' + n : ''; };
    var s = stateBaru();
    s.desain = r.desain || state.desain;
    s.slug = r.slug;
    s.langkah = state.langkah;
    s.isi.nama = x.nama || ''; s.isi.peran = x.peran || ''; s.isi.pembuka = x.pembuka || ''; s.isi.status = x.status || '';
    s.isi.tema = x.tema === 'gelap' ? 'gelap' : 'terang';
    s.isi.foto = f(x.foto);
    s.isi.tentang = (x.tentang || []).join('\n\n');
    s.isi.tools = (x.tools || []).join(', ');
    KONTAK.forEach(function (k) { s.isi.kontak[k] = (x.kontak && x.kontak[k]) || ''; });
    s.isi.karya = (x.karya || []).map(function (k) {
      var b = karyaBaru();
      b.tipe = k.tipe; b.judul = k.judul || ''; b.keterangan = k.keterangan || ''; b.kategori = k.kategori || '';
      b.gambar = f(k.gambar); b.sampul = f(k.sampul); b.youtube = k.youtube || ''; b.tegak = !!k.tegak; b.tegakDiubah = true;
      b.kutipan = k.kutipan || ''; b.isi = (k.isi || []).join('\n\n');
      return b;
    });
    // Foto lokal lama tidak dipakai lagi
    refFoto().forEach(function (ref) { if (ref.charAt(0) === '@') hapusFoto(ref.slice(1)); });
    state = s;
  }

  // ===================================================================
  // Mulai
  // ===================================================================
  function pulihkan() {
    var simpanan = null;
    try { simpanan = JSON.parse(localStorage.getItem(KUNCI) || 'null'); } catch (e) { simpanan = null; }
    if (!simpanan || simpanan.v !== 1) return Promise.resolve();
    var dasar = stateBaru();
    state = Object.assign(dasar, simpanan);
    state.isi = Object.assign(stateBaru().isi, simpanan.isi || {});
    state.isi.kontak = Object.assign(stateBaru().isi.kontak, (simpanan.isi && simpanan.isi.kontak) || {});
    state.isi.karya = (state.isi.karya || []).map(function (k) { return Object.assign(karyaBaru(), k); });
    if (DESAIN.map(function (d) { return d.id; }).indexOf(state.desain) === -1) state.desain = 'nama-besar';
    if (LANGKAH.indexOf(state.langkah) === -1) state.langkah = 'desain';
    var lokal = refFoto().filter(function (r) { return r.charAt(0) === '@'; });
    return Promise.all(lokal.map(function (ref) {
      var id = ref.slice(1);
      return ambilFoto(id).then(function (blob) {
        if (blob) fotoLokal[id] = { blob: blob, url: URL.createObjectURL(blob) };
      });
    })).then(function () {
      // Referensi ke foto yang sudah tidak ada di browser dikosongkan
      var cek = function (ref) { return ref && ref.charAt(0) === '@' && !fotoLokal[ref.slice(1)] ? '' : ref; };
      state.isi.foto = cek(state.isi.foto);
      state.isi.karya.forEach(function (k) { k.gambar = cek(k.gambar); k.sampul = cek(k.sampul); });
    });
  }

  function mulai() {
    iframe = $('#pratinjau');
    wrap = $('#frame-wrap');
    ikatIsian();
    ikatSlug();
    ikatMasuk();
    $('#tambah-karya').addEventListener('click', function () {
      if (state.isi.karya.length >= MAKS_KARYA) return;
      state.isi.karya.push(karyaBaru());
      renderKarya(); tandaiLangkah(); simpan(); segarkan();
      var kartu = $$('.karya');
      var akhir = kartu[kartu.length - 1];
      if (akhir) { akhir.scrollIntoView({ behavior: HALUS, block: 'center' }); var i = akhir.querySelector('input'); if (i) i.focus({ preventScroll: true }); }
    });
    $$('.steps button').forEach(function (b) { b.addEventListener('click', function () { keLangkah(b.getAttribute('data-ke'), true); }); });
    $('#btn-kembali').addEventListener('click', function () { geser(-1); });
    $('#btn-lanjut').addEventListener('click', function () { geser(1); });
    $('#btn-lanjut-hp').addEventListener('click', function () {
      if (state.langkah === 'terbit') { $('#btn-terbit').scrollIntoView({ behavior: HALUS, block: 'center' }); terbit(); } else geser(1);
    });
    $('#btn-terbit').addEventListener('click', terbit);
    $('#salin-url').addEventListener('click', function () {
      var t = state.terbit && state.terbit.url;
      if (!t) return;
      var b = $('#salin-url');
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
        b.textContent = 'Tersalin!';
        setTimeout(function () { b.textContent = 'Salin alamat'; }, 1800);
      }).catch(function () { prompt('Salin alamat ini:', t); });
    });

    // Preview
    $$('[data-layar]').forEach(function (b) {
      b.addEventListener('click', function () {
        layar = b.getAttribute('data-layar');
        $$('[data-layar]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        pasUkuran();
      });
    });
    iframe.addEventListener('load', function () {
      try { if (gulirTersimpan) iframe.contentWindow.scrollTo(0, gulirTersimpan); } catch (e) { /* abaikan */ }
    });
    $('#buka-preview').addEventListener('click', function () {
      $('#preview-col').classList.add('buka');
      document.body.classList.add('preview-buka');
      requestAnimationFrame(pasUkuran);
    });
    $('#tutup-preview').addEventListener('click', function () {
      $('#preview-col').classList.remove('buka');
      document.body.classList.remove('preview-buka');
    });
    window.addEventListener('resize', pasUkuran);
    if ('ResizeObserver' in window) new ResizeObserver(pasUkuran).observe(wrap);

    pulihkan().then(function () {
      isiKeForm();
      tandaiLangkah();
      keLangkah(state.langkah, false);
      pasUkuran();
      muatPreview();
      if (state.isi.nama || state.isi.karya.length) tulisInfo('Draf dipulihkan');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
  else mulai();
})();
