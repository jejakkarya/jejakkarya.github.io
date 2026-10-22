// Cek kecocokan CV dengan lowongan – Jejak Karya
// Semua proses berjalan di browser, tidak ada data yang dikirim.
(function () {
  'use strict';

  // Istilah yang umum dicari di lowongan kreatif dan digital.
  var DICT = [
    'adobe premiere pro', 'premiere pro', 'after effects', 'davinci resolve', 'final cut pro', 'capcut', 'adobe photoshop', 'photoshop',
    'adobe illustrator', 'illustrator', 'indesign', 'lightroom', 'figma', 'canva', 'coreldraw', 'blender', 'cinema 4d', 'adobe audition',
    'video editing', 'editing video', 'color grading', 'color correction', 'sound design', 'audio mixing', 'motion graphic', 'motion graphics',
    'animasi', 'animation', '3d', 'storyboard', 'storytelling', 'scriptwriting', 'naskah', 'copywriting', 'copywriter', 'content writing',
    'seo', 'sem', 'content planning', 'content plan', 'content calendar', 'kalender konten', 'social media', 'media sosial', 'instagram', 'tiktok',
    'youtube', 'reels', 'short-form', 'long-form', 'facebook ads', 'meta ads', 'google ads', 'tiktok ads', 'google analytics', 'insight',
    'analytics', 'engagement', 'brand guideline', 'brand identity', 'branding', 'identitas visual', 'logo', 'tipografi', 'typography', 'layout',
    'packaging', 'kemasan', 'ilustrasi', 'illustration', 'ui/ux', 'ui design', 'ux', 'wireframe', 'prototype', 'design system', 'fotografi',
    'photography', 'videografi', 'videography', 'shooting', 'lighting', 'campaign', 'kampanye', 'brief', 'moodboard', 'konsep kreatif',
    'creative concept', 'art direction', 'presentasi', 'presentation', 'riset', 'research', 'trend', 'tren', 'deadline', 'multitasking',
    'kerja tim', 'teamwork', 'komunikasi', 'communication', 'time management', 'manajemen waktu', 'kreatif', 'detail', 'portofolio', 'portfolio',
    'bahasa inggris', 'english', 'microsoft office', 'excel', 'google workspace', 'notion', 'trello', 'kol', 'influencer', 'live streaming',
    'e-commerce', 'shopee', 'tokopedia', 'marketplace', 'affiliate', 'fmcg', 'agency', 'freelance', 'magang', 'internship', 'fresh graduate'
  ];

  var STOP = ('yang dan di ke dari untuk dengan atau pada dalam akan ini itu adalah sebagai juga serta oleh bisa dapat kami kamu anda kita ' +
    'mereka para setiap minimal maksimal memiliki mempunyai mampu bersedia menjadi lebih sangat sudah belum tidak bukan harus wajib ' +
    'diutamakan nilai plus tahun bulan hari kerja bekerja pekerjaan perusahaan posisi kandidat pelamar calon lowongan dibutuhkan ' +
    'kualifikasi persyaratan syarat tanggung jawab jawab deskripsi job description requirement requirements responsibilities ' +
    'the and for with to of in on a an or is are be as at by from this that will you your our we have has can able must should ' +
    'experience years year work working candidate position strong good excellent knowledge skills skill ability least min ' +
    'terkait baik serta melakukan membuat mengerjakan membantu sesuai hal lain lainnya secara agar sehingga karena jika atau ' +
    'pt cv tbk kota jakarta bandung surabaya indonesia lokasi gaji benefit kirim email apply melalui via sebelum tanggal').split(/\s+/);
  var STOPSET = {};
  STOP.forEach(function (w) { STOPSET[w] = 1; });

  var SAMPLE_JOB = 'Lowongan Video Editor (Full-time, Jakarta)\n\nTanggung jawab:\n- Mengedit video short-form untuk TikTok, Instagram Reels, dan YouTube Shorts\n- Mengedit video YouTube long-form termasuk color grading dan sound design\n- Membuat motion graphic sederhana untuk kebutuhan kampanye\n- Berkoordinasi dengan tim konten untuk menyusun storyboard\n\nKualifikasi:\n- Minimal 1 tahun pengalaman sebagai video editor\n- Menguasai Adobe Premiere Pro dan After Effects, nilai plus DaVinci Resolve\n- Memahami tren konten TikTok dan Instagram\n- Mampu bekerja dengan deadline dan memiliki portofolio\n- Komunikasi dan kerja tim yang baik';

  var $ = function (id) { return document.getElementById(id); };
  var job = $('job'), cv = $('cvtext');

  function norm(s) {
    return ' ' + (s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9à-ÿ+#/.\-\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  }
  function has(text, kw) {
    var k = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp('(^|[^a-z0-9])' + k + '([^a-z0-9]|$)').test(text);
  }

  function keywords(jobText) {
    var t = norm(jobText);
    var found = [];
    // 1) Istilah dari kamus
    DICT.forEach(function (k) { if (has(t, k)) found.push(k); });
    // Buang istilah pendek yang sudah tercakup istilah panjang (premiere pro vs adobe premiere pro)
    found = found.filter(function (k) {
      return !found.some(function (o) { return o !== k && o.length > k.length && o.indexOf(k) !== -1; });
    });
    // 2) Kata yang sering muncul di lowongan (minimal 2 kali)
    var counts = {};
    t.split(' ').forEach(function (w) {
      w = w.replace(/^[.\-/]+|[.\-/]+$/g, '');
      if (w.length < 4 || STOPSET[w] || /^\d+$/.test(w)) return;
      counts[w] = (counts[w] || 0) + 1;
    });
    Object.keys(counts).filter(function (w) { return counts[w] >= 2; })
      .sort(function (a, b) { return counts[b] - counts[a]; })
      .forEach(function (w) {
        if (found.length >= 30) return;
        if (!found.some(function (k) { return k.indexOf(w) !== -1; })) found.push(w);
      });
    return found;
  }

  function cvFromStorage() {
    try {
      var s = JSON.parse(localStorage.getItem('jejakkarya-cv-v1') || 'null');
      if (!s || !s.name) return '';
      var out = [s.name, s.headline, [s.city, s.phone, s.email, s.linkedin, s.website].filter(Boolean).join(' | '), s.summary, s.skills, s.tools, s.languages];
      ['experience', 'organization'].forEach(function (k) {
        (s[k] || []).forEach(function (it) { out.push(it.role, it.org, it.points); });
      });
      (s.education || []).forEach(function (it) { out.push(it.degree, it.school, it.note); });
      (s.certification || []).forEach(function (it) { out.push(it.name, it.issuer); });
      return out.filter(Boolean).join('\n');
    } catch (e) { return ''; }
  }

  function chip(text, cls) {
    var li = document.createElement('li');
    li.className = 'chip ' + cls;
    li.textContent = text;
    return li;
  }

  function check() {
    var j = job.value.trim(), c = cv.value.trim();
    if (j.length < 80) { $('msg').textContent = 'Teks lowongan terlalu pendek. Salin seluruh isi lowongannya.'; job.focus(); return; }
    if (c.length < 150) { $('msg').textContent = 'Teks CV terlalu pendek. Tempel seluruh isi CV kamu.'; cv.focus(); return; }
    $('msg').textContent = '';

    var kws = keywords(j), ct = norm(c);
    if (!kws.length) { $('msg').textContent = 'Belum menemukan kata kunci yang jelas di lowongan ini. Coba tempel versi yang lebih lengkap.'; return; }
    var hit = [], miss = [];
    kws.forEach(function (k) { (has(ct, k) ? hit : miss).push(k); });
    var pct = Math.round(hit.length / kws.length * 100);

    var ring = $('ring');
    ring.style.setProperty('--p', pct);
    ring.style.setProperty('--ring', pct >= 70 ? 'var(--ok)' : pct >= 45 ? 'var(--warn)' : 'var(--bad)');
    $('pct').textContent = pct + '%';
    $('verdict').textContent = pct >= 70 ? 'Cocok. CV kamu sudah sejalan dengan lowongan ini.' : pct >= 45 ? 'Lumayan, tapi masih bisa ditingkatkan.' : 'Kurang cocok untuk lowongan ini.';
    $('verdict-sub').textContent = hit.length + ' dari ' + kws.length + ' kata kunci lowongan ditemukan di CV kamu.' +
      (pct < 70 ? ' Tambahkan kata kunci yang relevan dan memang kamu kuasai.' : '');

    var M = $('missing'), F = $('found');
    M.innerHTML = ''; F.innerHTML = '';
    miss.forEach(function (k) { M.appendChild(chip(k, 'chip-bad')); });
    hit.forEach(function (k) { F.appendChild(chip(k, 'chip-ok')); });
    if (!miss.length) M.appendChild(chip('Tidak ada, mantap!', 'chip-ok'));
    $('miss-n').textContent = '(' + miss.length + ')';
    $('have-n').textContent = '(' + hit.length + ')';

    var words = c.split(/\s+/).length;
    var checks = [
      [/\S+@\S+\.\S+/.test(c), 'Email tercantum di CV', 'Email belum terlihat di CV. Cantumkan di bagian atas.'],
      [/(\+62|08)[\d\s\-]{7,}/.test(c), 'Nomor HP tercantum', 'Nomor HP belum terlihat. Tambahkan di bagian kontak.'],
      [/\d+\s?%|\d+[\.,]?\d*\s?(rb|ribu|jt|juta|k|views|video|klien|proyek|konten|orang)/i.test(c), 'Ada pencapaian dengan angka', 'Belum ada angka di pencapaian. HRD lebih percaya hasil terukur, misalnya "30 video per bulan" atau "engagement naik 40%".'],
      [words >= 200 && words <= 900, 'Panjang CV wajar (' + words + ' kata)', words < 200 ? 'CV terlalu singkat (' + words + ' kata). Tambahkan ringkasan dan poin pengalaman.' : 'CV cukup panjang (' + words + ' kata). Pertimbangkan meringkas ke poin paling relevan.'],
      [/portofolio|portfolio|behance|dribbble|github\.io|\.com|\.id/i.test(c), 'Ada link portofolio atau website', 'Belum ada link portofolio. Untuk posisi kreatif, ini hampir selalu diminta.']
    ];
    var ul = $('checks'); ul.innerHTML = '';
    checks.forEach(function (x) {
      var li = document.createElement('li');
      li.className = x[0] ? 'ok' : 'bad';
      li.textContent = x[0] ? x[1] : x[2];
      ul.appendChild(li);
    });

    $('result').hidden = false;
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('check').addEventListener('click', check);
  $('sample-job').addEventListener('click', function () { job.value = SAMPLE_JOB; job.focus(); });
  var stored = cvFromStorage();
  if (stored) {
    $('from-cv').hidden = false;
    $('make-cv').hidden = true;
    $('from-cv').addEventListener('click', function () { cv.value = stored; cv.focus(); });
  }
})();
