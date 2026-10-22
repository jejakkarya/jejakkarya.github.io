// Kuis cek kesiapan portofolio – Jejak Karya
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var AREAS = {
    akses: 'Akses dan tampilan',
    kurasi: 'Pilihan karya',
    cerita: 'Cerita dan hasil',
    profil: 'Profil dan kontak'
  };

  // Tiap jawaban bernilai 2 (bagus), 1 (cukup), atau 0 (perlu dibenahi).
  var Q = [
    { area: 'akses', q: 'Di mana karya kamu sekarang?',
      a: [['Satu link rapi (website atau halaman portofolio)', 2], ['Tersebar di Google Drive, Instagram, atau YouTube', 1], ['Belum dikumpulkan', 0]],
      fix: 'Kumpulkan karya di satu link. HRD jarang mau membuka banyak tautan terpisah.' },
    { area: 'kurasi', q: 'Berapa karya yang kamu tampilkan?',
      a: [['6–12 karya terbaik yang sudah dipilih', 2], ['Lebih dari 20, semua dimasukkan', 1], ['Kurang dari 5', 0]],
      fix: 'Pilih 6–12 karya terbaik. Lebih sedikit tapi kuat lebih baik daripada banyak tapi campur aduk.' },
    { area: 'kurasi', q: 'Apakah karya disusun sesuai posisi yang kamu lamar?',
      a: [['Ya, karya paling relevan ada di urutan atas', 2], ['Sebagian', 1], ['Tidak, urutannya acak', 0]],
      fix: 'Taruh karya yang paling sesuai dengan posisi incaran di urutan teratas, dan kelompokkan per kategori.' },
    { area: 'cerita', q: 'Apakah ada cerita proses di balik karya (case study)?',
      a: [['Ada, minimal 2 karya', 2], ['Ada 1', 1], ['Belum ada, hanya hasil akhir', 0]],
      fix: 'Tulis minimal 2 case study: konteks, tantangan, proses, dan hasil. Ini yang paling membedakan kamu di mata HRD agency.' },
    { area: 'cerita', q: 'Apakah ada hasil terukur dari karyamu?',
      a: [['Ada angka (views, engagement, penjualan, waktu)', 2], ['Hanya testimoni atau kesan', 1], ['Tidak ada', 0]],
      fix: 'Cantumkan angka hasil, misalnya views, kenaikan engagement, atau waktu produksi yang dipangkas.' },
    { area: 'akses', q: 'Bisakah portofolio dibuka tanpa minta akses atau login?',
      a: [['Ya, semua langsung terbuka', 2], ['Sebagian masih perlu izin', 1], ['Harus minta akses dulu', 0]],
      fix: 'Pastikan semua link bisa dibuka tanpa minta izin. Banyak HRD langsung menutup link yang meminta akses.' },
    { area: 'akses', q: 'Apakah portofoliomu nyaman dibuka di HP?',
      a: [['Sudah saya cek, tampil rapi', 2], ['Belum yakin', 1], ['Tidak, berantakan di HP', 0]],
      fix: 'Cek tampilan di HP. Banyak perekrut membuka link pertama kali dari ponsel.' },
    { area: 'profil', q: 'Apakah ada profil singkat dan posisi yang kamu incar?',
      a: [['Ada dan jelas', 2], ['Ada, tapi masih umum', 1], ['Tidak ada', 0]],
      fix: 'Tambahkan 2–3 kalimat profil: siapa kamu, keahlian utama, dan posisi yang kamu cari.' },
    { area: 'profil', q: 'Apakah kontak dan CV mudah ditemukan?',
      a: [['Ya, email, WhatsApp, dan CV ada', 2], ['Hanya salah satu', 1], ['Belum ada', 0]],
      fix: 'Pasang email, WhatsApp, dan tombol unduh CV di tempat yang mudah terlihat.' },
    { area: 'kurasi', q: 'Kapan terakhir portofoliomu diperbarui?',
      a: [['Dalam 3 bulan terakhir', 2], ['Tahun ini', 1], ['Lebih dari setahun lalu', 0]],
      fix: 'Perbarui dengan karya terbaru. Karya lama memberi kesan kamu kurang aktif.' }
  ];

  var answers = new Array(Q.length).fill(null);
  var i = 0;

  function renderQ() {
    var item = Q[i];
    $('q-count').textContent = 'Pertanyaan ' + (i + 1) + ' dari ' + Q.length;
    $('q-bar').style.width = ((i) / Q.length * 100) + '%';
    $('q-text').textContent = item.q;
    var box = $('answers'); box.innerHTML = '';
    item.a.forEach(function (opt, k) {
      var id = 'a' + i + '-' + k;
      var label = document.createElement('label');
      label.className = 'answer';
      label.setAttribute('for', id);
      var input = document.createElement('input');
      input.type = 'radio'; input.name = 'q' + i; input.id = id; input.value = k;
      if (answers[i] === k) input.checked = true;
      input.addEventListener('change', function () {
        answers[i] = k; $('next').disabled = false;
        setTimeout(function () { if (answers[i] === k) next(); }, 260);
      });
      var span = document.createElement('span'); span.textContent = opt[0];
      label.appendChild(input); label.appendChild(span);
      box.appendChild(label);
    });
    $('back').disabled = i === 0;
    $('next').disabled = answers[i] === null;
    $('next').textContent = i === Q.length - 1 ? 'Lihat hasil' : 'Lanjut';
    var first = box.querySelector('input:checked') || box.querySelector('input');
    if (first && document.activeElement && document.activeElement.closest && document.activeElement.closest('#quiz')) first.focus();
  }

  function next() {
    if (answers[i] === null) return;
    if (i < Q.length - 1) { i++; renderQ(); }
    else showResult();
  }

  function showResult() {
    var total = 0, per = {};
    Object.keys(AREAS).forEach(function (a) { per[a] = { got: 0, max: 0 }; });
    Q.forEach(function (item, k) {
      var pts = item.a[answers[k]][1];
      total += pts; per[item.area].got += pts; per[item.area].max += 2;
    });
    var score = Math.round(total / (Q.length * 2) * 100);
    var level, headline, summary, color;
    if (score >= 80) { level = 'Siap dilirik'; color = 'var(--ok)'; headline = 'Portofoliomu sudah kuat.'; summary = 'Tinggal poles detail kecil supaya makin menonjol dibanding kandidat lain.'; }
    else if (score >= 50) { level = 'Hampir siap'; color = 'var(--warn)'; headline = 'Fondasinya ada, tapi masih ada yang bikin HRD ragu.'; summary = 'Perbaiki poin di bawah, terutama bagian dengan skor terendah.'; }
    else { level = 'Belum siap'; color = 'var(--bad)'; headline = 'Portofoliomu berisiko dilewati HRD.'; summary = 'Kabar baiknya, sebagian besar masalah ini bisa dibereskan dalam beberapa hari.'; }

    $('quiz').hidden = true;
    var res = $('result'); res.hidden = false;
    var ring = $('ring'); ring.style.setProperty('--ring', color);
    $('level').textContent = level; $('level').style.color = color;
    $('headline').textContent = headline; $('summary').textContent = summary;
    animate(score);

    var areas = $('areas'); areas.innerHTML = '';
    Object.keys(AREAS).forEach(function (a) {
      var p = Math.round(per[a].got / per[a].max * 100);
      var div = document.createElement('div'); div.className = 'card area';
      var h = document.createElement('p'); h.className = 'area-name'; h.textContent = AREAS[a];
      var n = document.createElement('p'); n.className = 'area-num'; n.textContent = p + '%';
      var bar = document.createElement('div'); bar.className = 'area-bar';
      var fill = document.createElement('span'); fill.style.width = p + '%';
      fill.style.background = p >= 75 ? 'var(--ok)' : p >= 50 ? 'var(--warn)' : 'var(--bad)';
      bar.appendChild(fill); div.appendChild(h); div.appendChild(n); div.appendChild(bar);
      areas.appendChild(div);
    });

    var weak = Q.map(function (item, k) { return { item: item, pts: item.a[answers[k]][1] }; })
      .filter(function (x) { return x.pts < 2; })
      .sort(function (a, b) { return a.pts - b.pts; });
    var ol = $('fixes'); ol.innerHTML = '';
    if (!weak.length) { var li0 = document.createElement('li'); li0.textContent = 'Tidak ada yang mendesak. Pertahankan dengan rutin memperbarui karya.'; ol.appendChild(li0); }
    weak.slice(0, 5).forEach(function (x) {
      var li = document.createElement('li');
      var b = document.createElement('b'); b.textContent = AREAS[x.item.area] + ': ';
      li.appendChild(b); li.appendChild(document.createTextNode(x.item.fix));
      ol.appendChild(li);
    });

    var needStory = per.cerita.got < per.cerita.max;
    var pkg = score >= 80 && !needStory ? 'Basic' : 'Serius';
    var rec = $('rec'); rec.innerHTML = '';
    var h2 = document.createElement('h2');
    h2.textContent = pkg === 'Serius' ? 'Mau dibantu membereskannya?' : 'Mau tampil lebih rapi lagi?';
    var p = document.createElement('p');
    p.textContent = pkg === 'Serius'
      ? 'Paket Serius Jejak Karya membuatkan website portofolio interaktif lengkap dengan 2 case study yang kami tulis dari jawabanmu. Ini menjawab kekurangan terbesar di hasil kuis kamu.'
      : 'Paket Basic Jejak Karya mengemas karyamu yang sudah kuat dalam satu website rapi yang nyaman dibuka di HP dan laptop.';
    var a = document.createElement('a'); a.className = 'btn btn-light'; a.target = '_blank'; a.rel = 'noopener';
    a.href = 'https://wa.me/6285183027929?text=' + encodeURIComponent('Halo Jejak Karya, skor kesiapan portofolio saya ' + score + '/100. Saya mau tanya paket ' + pkg + '.');
    a.textContent = 'Konsultasi paket ' + pkg + ' gratis';
    var a2 = document.createElement('a'); a2.className = 'rec-link'; a2.href = '../#paket'; a2.textContent = 'Lihat semua paket';
    rec.appendChild(h2); rec.appendChild(p); var row = document.createElement('div'); row.className = 'row-actions'; row.appendChild(a); row.appendChild(a2); rec.appendChild(row);

    window.__score = score;
    res.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function animate(score) {
    var ring = $('ring'), out = $('score');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { ring.style.setProperty('--p', score); out.textContent = score; return; }
    var start = null;
    function step(t) {
      if (!start) start = t;
      var k = Math.min(1, (t - start) / 900), e = 1 - Math.pow(1 - k, 3), v = Math.round(score * e);
      ring.style.setProperty('--p', v); out.textContent = v;
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  $('next').addEventListener('click', next);
  $('back').addEventListener('click', function () { if (i > 0) { i--; renderQ(); } });
  $('again').addEventListener('click', function () {
    answers = new Array(Q.length).fill(null); i = 0;
    $('result').hidden = true; $('quiz').hidden = false; renderQ();
    $('quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('share').addEventListener('click', function () {
    var t = 'Skor kesiapan portofolio saya: ' + window.__score + '/100 (' + $('level').textContent + '). Cek punyamu di jejakkarya.github.io/cek-portofolio/';
    var toast = function (m) { $('toast').textContent = m; setTimeout(function () { $('toast').textContent = ''; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('Hasil tersalin, siap dibagikan.'); }, function () { toast('Tidak bisa menyalin otomatis.'); });
    else toast('Tidak bisa menyalin otomatis.');
  });

  renderQ();
})();
