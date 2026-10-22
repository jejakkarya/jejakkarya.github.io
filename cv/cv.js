// CV ATS builder – Jejak Karya
// Semua data hanya disimpan di browser pengguna (localStorage).
(function () {
  'use strict';

  var KEY = 'jejakkarya-cv-v1';
  // URL aplikasi web Apps Script (berakhiran /exec). Kosongkan untuk mematikan pengiriman data.
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbwKU_mik8J_XhqV1fOAodY9W1ote-q9sGpze7Pa7WXaRC2lcN_O5B8HhJlc9cEnRPqo/exec';
  var SENT_KEY = 'jejakkarya-cv-sent';
  var LISTS = ['experience', 'organization', 'education', 'certification'];
  var TPL = { experience: 'tpl-experience', organization: 'tpl-experience', education: 'tpl-education', certification: 'tpl-certification' };
  var ITEM_TITLE = { experience: 'Pengalaman', organization: 'Organisasi atau proyek', education: 'Pendidikan', certification: 'Sertifikasi' };
  var SIMPLE = ['name', 'headline', 'email', 'phone', 'city', 'linkedin', 'website', 'summary', 'skills', 'tools', 'languages'];
  var lastScore = 0;

  var LABELS = {
    id: { summary: 'Ringkasan', experience: 'Pengalaman Kerja', organization: 'Pengalaman Organisasi dan Proyek', education: 'Pendidikan',
          skills: 'Keahlian', skillsMain: 'Keahlian teknis', tools: 'Tools', languages: 'Bahasa', certification: 'Sertifikasi dan Pelatihan',
          present: 'Sekarang', gpa: 'IPK', months: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] },
    en: { summary: 'Summary', experience: 'Work Experience', organization: 'Organizations and Projects', education: 'Education',
          skills: 'Skills', skillsMain: 'Technical skills', tools: 'Tools', languages: 'Languages', certification: 'Certifications and Training',
          present: 'Present', gpa: 'GPA', months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }
  };

  var SAMPLE = {
    lang: 'id',
    name: 'Raka Pratama', headline: 'Video Editor', email: 'raka.pratama@email.com', phone: '0812-3456-7890',
    city: 'Jakarta Selatan', linkedin: 'linkedin.com/in/rakapratama', website: 'rakapratama.github.io',
    summary: 'Video editor dengan 2 tahun pengalaman membuat konten short-form dan YouTube untuk UMKM dan kreator. Terbiasa mengolah footage seadanya menjadi video yang ditonton sampai habis, dengan rata-rata retensi naik 17 poin. Mencari posisi Video Editor di creative agency.',
    skills: 'Video editing, Color grading, Sound design, Motion graphic, Storyboard, Scriptwriting',
    tools: 'Adobe Premiere Pro, After Effects, DaVinci Resolve, CapCut, Figma',
    languages: 'Indonesia (native), Inggris (profesional)',
    experience: [
      { role: 'Video Editor', org: 'Freelance untuk UMKM dan kreator', city: 'Jakarta', type: '', start: '2024-08', end: '', current: true,
        points: 'Mengedit 30+ video short-form per bulan untuk 5 klien UMKM dan kreator\nMeningkatkan rata-rata retensi video YouTube klien dari 31% menjadi 48% dalam 3 bulan\nMenyusun template editing yang memangkas waktu produksi per video dari 3 jam menjadi 1 jam' },
      { role: 'Content Editor Intern', org: 'PT Kreasi Media Nusantara', city: 'Jakarta', type: 'Magang', start: '2023-09', end: '2024-02', current: false,
        points: 'Mengedit 12 video kampanye untuk 3 brand lokal di bawah arahan senior editor\nMembuat 40 aset motion graphic untuk Instagram Reels dan TikTok' }
    ],
    organization: [
      { role: 'Koordinator Dokumentasi', org: 'Himpunan Mahasiswa DKV', city: 'Bandung', type: '', start: '2022-03', end: '2023-03', current: false,
        points: 'Memimpin tim 6 orang untuk dokumentasi 15 acara kampus\nMenaikkan pengikut Instagram himpunan dari 1.200 menjadi 4.500' }
    ],
    education: [
      { degree: 'S1 Desain Komunikasi Visual', school: 'Universitas Pasundan', city: 'Bandung', year: '2024', gpa: '3,52/4,00', note: 'Skripsi: Strategi konten video pendek untuk UMKM' }
    ],
    certification: [
      { name: 'Adobe Certified Professional: Premiere Pro', issuer: 'Adobe', year: '2024' },
      { name: 'Google Digital Marketing & E-commerce', issuer: 'Google', year: '2023' }
    ]
  };

  var form = document.getElementById('panel-form');
  var cv = document.getElementById('cv');
  var state = load() || blank();

  function blank() {
    var s = { lang: 'id', experience: [{}], organization: [], education: [{}], certification: [] };
    SIMPLE.forEach(function (k) { s[k] = ''; });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  var saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try { localStorage.setItem(KEY, JSON.stringify(state)); flash('Draf tersimpan otomatis di browser ini.'); }
      catch (e) { flash('Draf tidak bisa disimpan di browser ini. Unduh PDF sebelum menutup halaman.'); }
    }, 400);
  }
  function flash(t) { var el = document.getElementById('saved'); el.textContent = t; }

  // ---------- Form <-> state ----------
  function fillForm() {
    SIMPLE.forEach(function (k) { var el = document.getElementById('f-' + k); if (el) el.value = state[k] || ''; });
    LISTS.forEach(function (list) {
      var box = form.querySelector('[data-list="' + list + '"]');
      box.innerHTML = '';
      (state[list] || []).forEach(function (item) { box.appendChild(makeItem(list, item)); });
    });
    document.querySelectorAll('.seg-btn').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)); });
    var c = document.getElementById('f-consent'); if (c) c.checked = !!state.consent;
    updateCount();
  }

  function makeItem(list, data) {
    var node = document.getElementById(TPL[list]).content.firstElementChild.cloneNode(true);
    node.dataset.list = list;
    node.querySelector('.item-title').textContent = ITEM_TITLE[list];
    if (list === 'organization') {
      node.querySelector('[data-k="role"]').placeholder = 'Ketua Divisi Acara';
      node.querySelector('[data-k="org"]').placeholder = 'BEM Fakultas';
      var type = node.querySelector('[data-k="type"]');
      if (type) type.closest('.field').remove();
    }
    node.querySelectorAll('[data-k]').forEach(function (el) {
      var v = data[el.dataset.k];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v || '';
    });
    syncCurrent(node);
    return node;
  }

  function readForm() {
    SIMPLE.forEach(function (k) { var el = document.getElementById('f-' + k); if (el) state[k] = el.value; });
    var c = document.getElementById('f-consent'); if (c) state.consent = c.checked;
    LISTS.forEach(function (list) {
      state[list] = Array.prototype.map.call(form.querySelectorAll('[data-list="' + list + '"] > .item'), function (node) {
        var o = {};
        node.querySelectorAll('[data-k]').forEach(function (el) { o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; });
        return o;
      });
    });
  }

  function syncCurrent(node) {
    var cur = node.querySelector('[data-k="current"]'), end = node.querySelector('[data-k="end"]');
    if (cur && end) { end.disabled = cur.checked; if (cur.checked) end.value = ''; }
  }

  function updateCount() {
    document.getElementById('summary-count').textContent = (document.getElementById('f-summary').value || '').length;
  }

  // ---------- Render CV ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clean(s) { return (s || '').trim(); }
  function split(s) { return clean(s).split(',').map(clean).filter(Boolean); }
  function lines(s) { return (s || '').split('\n').map(function (l) { return l.replace(/^[\s•\-–*]+/, '').trim(); }).filter(Boolean); }
  function month(v, L) {
    var m = /^(\d{4})-(\d{2})$/.exec(v || '');
    return m ? L.months[+m[2] - 1] + ' ' + m[1] : clean(v);
  }
  function range(it, L) {
    var a = month(it.start, L), b = it.current ? L.present : month(it.end, L);
    if (a && b) return a + ' – ' + b;
    return a || b || '';
  }
  function section(title) {
    var s = el('section', 'cv-sec');
    s.appendChild(el('h2', 'cv-h', title));
    return s;
  }
  function entry(left, right, sub) {
    var wrap = el('div', 'cv-entry');
    var row = el('div', 'cv-row');
    row.appendChild(el('h3', 'cv-title', left));
    if (right) row.appendChild(el('span', 'cv-date', right));
    wrap.appendChild(row);
    if (sub) wrap.appendChild(el('p', 'cv-sub', sub));
    return wrap;
  }

  function render() {
    var L = LABELS[state.lang] || LABELS.id;
    cv.innerHTML = '';
    cv.lang = state.lang === 'en' ? 'en' : 'id';

    var head = el('header', 'cv-head');
    head.appendChild(el('h1', 'cv-name', clean(state.name) || 'Nama Lengkap'));
    if (clean(state.headline)) head.appendChild(el('p', 'cv-headline', clean(state.headline)));
    var contact = [state.city, state.phone, state.email, state.linkedin, state.website].map(clean).filter(Boolean);
    if (contact.length) head.appendChild(el('p', 'cv-contact', contact.join('  |  ')));
    cv.appendChild(head);

    if (clean(state.summary)) {
      var s = section(L.summary);
      s.appendChild(el('p', 'cv-text', clean(state.summary)));
      cv.appendChild(s);
    }

    [['experience', L.experience], ['organization', L.organization]].forEach(function (pair) {
      var items = (state[pair[0]] || []).filter(function (it) { return clean(it.role) || clean(it.org); });
      if (!items.length) return;
      var sec = section(pair[1]);
      items.forEach(function (it) {
        var sub = [clean(it.org), clean(it.city), clean(it.type)].filter(Boolean).join(', ');
        var e = entry(clean(it.role) || clean(it.org), range(it, L), clean(it.role) ? sub : [clean(it.city), clean(it.type)].filter(Boolean).join(', '));
        var pts = lines(it.points);
        if (pts.length) {
          var ul = el('ul', 'cv-list');
          pts.forEach(function (p) { ul.appendChild(el('li', null, p)); });
          e.appendChild(ul);
        }
        sec.appendChild(e);
      });
      cv.appendChild(sec);
    });

    var edu = (state.education || []).filter(function (it) { return clean(it.degree) || clean(it.school); });
    if (edu.length) {
      var es = section(L.education);
      edu.forEach(function (it) {
        var sub = [clean(it.school), clean(it.city)].filter(Boolean).join(', ');
        var e = entry(clean(it.degree) || clean(it.school), clean(it.year), clean(it.degree) ? sub : clean(it.city));
        var extra = [];
        if (clean(it.gpa)) extra.push(L.gpa + ' ' + clean(it.gpa));
        if (clean(it.note)) extra.push(clean(it.note));
        if (extra.length) e.appendChild(el('p', 'cv-text', extra.join('. ')));
        es.appendChild(e);
      });
      cv.appendChild(es);
    }

    var skills = split(state.skills), tools = split(state.tools), langs = clean(state.languages);
    if (skills.length || tools.length || langs) {
      var ks = section(L.skills);
      [[L.skillsMain, skills.join(', ')], [L.tools, tools.join(', ')], [L.languages, langs]].forEach(function (r) {
        if (!r[1]) return;
        var p = el('p', 'cv-text cv-skill');
        p.appendChild(el('strong', null, r[0] + ': '));
        p.appendChild(document.createTextNode(r[1]));
        ks.appendChild(p);
      });
      cv.appendChild(ks);
    }

    var certs = (state.certification || []).filter(function (it) { return clean(it.name); });
    if (certs.length) {
      var cs = section(L.certification);
      var ul = el('ul', 'cv-list');
      certs.forEach(function (it) {
        ul.appendChild(el('li', null, [clean(it.name), clean(it.issuer), clean(it.year)].filter(Boolean).join(', ')));
      });
      cs.appendChild(ul);
      cv.appendChild(cs);
    }

    renderChecks();
  }

  // ---------- Checklist ATS ----------
  function renderChecks() {
    var exp = (state.experience || []).concat(state.organization || []).filter(function (it) { return clean(it.role) || clean(it.org); });
    var allPts = exp.map(function (it) { return it.points || ''; }).join('\n');
    var checks = [
      ['Nama, email, dan nomor HP terisi', clean(state.name) && /\S+@\S+\.\S+/.test(state.email || '') && clean(state.phone).replace(/\D/g, '').length >= 9],
      ['Posisi yang dilamar diisi', !!clean(state.headline)],
      ['Ringkasan 2–4 kalimat', clean(state.summary).length >= 120],
      ['Minimal satu pengalaman dengan poin pencapaian', exp.some(function (it) { return lines(it.points).length > 0; })],
      ['Ada angka di pencapaian (jumlah, persen, waktu)', /\d/.test(allPts)],
      ['Pendidikan terisi', (state.education || []).some(function (it) { return clean(it.degree) || clean(it.school); })],
      ['Minimal 5 keahlian atau tools', split(state.skills).length + split(state.tools).length >= 5]
    ];
    var done = checks.filter(function (c) { return c[1]; }).length;
    var pct = Math.round(done / checks.length * 100);
    lastScore = pct;
    document.getElementById('meter-fill').style.width = pct + '%';
    document.getElementById('score-text').textContent = pct + '%';
    var ul = document.getElementById('checklist');
    ul.innerHTML = '';
    checks.forEach(function (c) {
      var li = el('li', c[1] ? 'ok' : '', c[0]);
      ul.appendChild(li);
    });
  }

  // ---------- Events ----------
  function changed() { readForm(); render(); save(); updateCount(); }

  form.addEventListener('input', changed);
  form.addEventListener('change', function (e) {
    var item = e.target.closest('.item');
    if (item && e.target.dataset.k === 'current') syncCurrent(item);
    changed();
  });

  form.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    if (add) {
      var list = add.dataset.add;
      var node = makeItem(list, {});
      form.querySelector('[data-list="' + list + '"]').appendChild(node);
      var first = node.querySelector('input, textarea');
      if (first) first.focus();
      changed();
      return;
    }
    var rm = e.target.closest('[data-remove]');
    if (rm) { rm.closest('.item').remove(); changed(); return; }
    var mv = e.target.closest('[data-move]');
    if (mv) {
      var it = mv.closest('.item');
      if (mv.dataset.move === '-1' && it.previousElementSibling) it.parentNode.insertBefore(it, it.previousElementSibling);
      if (mv.dataset.move === '1' && it.nextElementSibling) it.parentNode.insertBefore(it.nextElementSibling, it);
      mv.focus();
      changed();
    }
  });

  document.querySelectorAll('.seg-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      state.lang = b.dataset.lang;
      document.querySelectorAll('.seg-btn').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      render(); save();
    });
  });

  document.getElementById('fill-sample').addEventListener('click', function () {
    state = JSON.parse(JSON.stringify(SAMPLE));
    fillForm(); render(); save();
    flash('Contoh terisi. Ganti dengan data kamu sendiri.');
  });

  var confirmBox = document.getElementById('confirm-clear');
  document.getElementById('clear-all').addEventListener('click', function () { confirmBox.hidden = false; document.getElementById('confirm-no').focus(); });
  document.getElementById('confirm-no').addEventListener('click', function () { confirmBox.hidden = true; });
  document.getElementById('confirm-yes').addEventListener('click', function () {
    state = blank(); confirmBox.hidden = true;
    fillForm(); render(); save();
    flash('Semua isian dihapus.');
  });

  function download() {
    readForm(); render();
    if (!clean(state.name)) {
      showTab('form');
      var n = document.getElementById('f-name');
      n.focus();
      flash('Isi nama lengkap dulu sebelum mengunduh.');
      return;
    }
    sendLead();
    var old = document.title;
    document.title = 'CV ' + clean(state.name) + (clean(state.headline) ? ' - ' + clean(state.headline) : '');
    window.print();
    setTimeout(function () { document.title = old; }, 1000);
  }
  // ---------- Kirim data kontak ke Jejak Karya (sekali per data yang sama) ----------
  function sendLead() {
    if (!ENDPOINT) return;
    var data = {
      name: clean(state.name), email: clean(state.email), phone: clean(state.phone), headline: clean(state.headline),
      city: clean(state.city), linkedin: clean(state.linkedin), website: clean(state.website),
      score: lastScore, lang: state.lang, consent: !!state.consent
    };
    if (!/\S+@\S+\.\S+/.test(data.email)) return;
    var sig = [data.name, data.email, data.phone, data.headline, data.consent].join('|');
    try { if (localStorage.getItem(SENT_KEY) === sig) return; } catch (e) {}
    try {
      fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data), keepalive: true })
        .then(function () { try { localStorage.setItem(SENT_KEY, sig); } catch (e) {} })
        .catch(function () {});
    } catch (e) {}
  }

  // Teks privasi menyesuaikan apakah pengiriman data aktif
  (function privacyText() {
    var on = !!ENDPOINT;
    document.querySelectorAll('[data-privacy]').forEach(function (n) {
      n.textContent = on ? n.dataset.on : n.dataset.off;
    });
    document.querySelectorAll('[data-if-endpoint]').forEach(function (n) { n.hidden = !on; });
  })();

  document.getElementById('download').addEventListener('click', download);
  document.getElementById('download-mobile').addEventListener('click', download);

  // Tab HP
  function showTab(which) {
    var f = which === 'form';
    document.getElementById('tab-form').setAttribute('aria-selected', String(f));
    document.getElementById('tab-preview').setAttribute('aria-selected', String(!f));
    document.body.dataset.view = which;
    window.scrollTo({ top: document.querySelector('.mobile-tabs').offsetTop - 8 });
  }
  document.getElementById('tab-form').addEventListener('click', function () { showTab('form'); });
  document.getElementById('tab-preview').addEventListener('click', function () { showTab('preview'); });
  document.body.dataset.view = 'form';

  fillForm();
  render();
})();
