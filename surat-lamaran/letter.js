// Generator surat & email lamaran – Jejak Karya
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'jejakkarya-lamaran-v1';
  var FIELDS = ['position', 'company', 'recipient', 'source', 'name', 'city', 'email', 'phone', 'exp', 'field', 'skills', 'win', 'link'];
  var opt = { kind: 'email', lang: 'id', tone: 'formal' };

  var SAMPLE = { position: 'Video Editor', company: 'PT Kreasi Media', recipient: 'Ibu Sinta', source: 'LinkedIn', name: 'Raka Pratama',
    city: 'Jakarta', email: 'raka.pratama@email.com', phone: '0812-3456-7890', exp: '2', field: 'editing video short-form dan YouTube',
    skills: 'Premiere Pro, color grading, motion graphic', win: 'meningkatkan rata-rata retensi video klien dari 31% menjadi 48% dalam 3 bulan',
    link: 'rakapratama.github.io' };

  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SRC_EN = { 'website perusahaan': 'your company website', 'rekomendasi rekan': "a colleague's recommendation" };

  function v(id) { return ($(id).value || '').trim(); }
  function ph(val, label) { return val || '[' + label + ']'; }
  function list(items, and) {
    items = items.filter(Boolean);
    if (items.length <= 1) return items[0] || '';
    return items.slice(0, -1).join(', ') + (items.length > 2 ? ', ' : ' ') + and + ' ' + items[items.length - 1];
  }

  function build() {
    var d = {}; FIELDS.forEach(function (k) { d[k] = v(k); });
    var en = opt.lang === 'en', casual = opt.tone === 'casual', letter = opt.kind === 'letter';
    var skills = list(d.skills.split(',').map(function (s) { return s.trim(); }), en ? 'and' : 'dan');
    var now = new Date();
    var L = [];
    var subject;

    if (!en) {
      var to = d.recipient || ('Tim Rekrutmen ' + ph(d.company, 'nama perusahaan'));
      var exp = d.exp === 'fresh' ? 'lulusan baru yang fokus' : (d.exp === '5' ? 'dengan lebih dari 5 tahun pengalaman' : 'dengan ' + d.exp + ' tahun pengalaman');
      subject = 'Lamaran Posisi ' + ph(d.position, 'posisi') + ' - ' + ph(d.name, 'nama kamu');
      if (letter) {
        L.push(ph(d.city, 'kota') + ', ' + now.getDate() + ' ' + BULAN[now.getMonth()] + ' ' + now.getFullYear(), '');
        L.push('Kepada Yth.', d.recipient || 'Bagian HRD', ph(d.company, 'nama perusahaan'), 'di tempat', '');
        L.push('Perihal: Lamaran Posisi ' + ph(d.position, 'posisi'), '');
      }
      L.push(casual ? 'Halo ' + to + ',' : (letter ? 'Dengan hormat,' : 'Yth. ' + to + ',\n\nDengan hormat,'), '');
      L.push((casual ? 'Perkenalkan, saya ' : 'Saya ') + ph(d.name, 'nama kamu') + ', ' + exp + ' di bidang ' + ph(d.field, 'bidang keahlian') + '. ' +
        (casual ? 'Saya tertarik bergabung sebagai ' : 'Melalui ' + (letter ? 'surat' : 'email') + ' ini, saya ingin melamar posisi ') +
        ph(d.position, 'posisi') + ' di ' + ph(d.company, 'nama perusahaan') +
        (d.source ? (casual ? ' setelah melihat lowongannya di ' : ' yang saya ketahui melalui ') + d.source : '') + '.', '');
      L.push((casual ? 'Sehari-hari saya terbiasa dengan ' : 'Saya menguasai ') + ph(skills, 'keahlian') + '. ' +
        'Salah satu pencapaian saya adalah ' + ph(d.win, 'pencapaian terbaik') + '. ' +
        (casual ? 'Saya ingin membawa hasil serupa untuk tim ' : 'Saya yakin pengalaman ini dapat berkontribusi bagi tim ') + ph(d.company, 'nama perusahaan') + '.', '');
      L.push((d.link ? 'Contoh karya saya dapat dilihat di ' + d.link + '. ' : '') + 'CV saya lampirkan bersama ' + (letter ? 'surat' : 'email') + ' ini.', '');
      L.push(casual ? 'Terima kasih sudah membaca. Semoga kita bisa ngobrol lebih lanjut.'
                    : 'Terima kasih atas waktu dan perhatian Bapak/Ibu. Saya berharap dapat berdiskusi lebih lanjut dalam sesi wawancara.', '');
      L.push(casual ? 'Salam,' : 'Hormat saya,');
    } else {
      var toE = d.recipient || ('Hiring Team at ' + ph(d.company, 'company name'));
      var expE = d.exp === 'fresh' ? 'a recent graduate focused on' : (d.exp === '5' ? 'with more than 5 years of experience in' : 'with ' + d.exp + ' year' + (d.exp === '1' ? '' : 's') + ' of experience in');
      var src = d.source ? (SRC_EN[d.source] || d.source) : '';
      subject = 'Application for ' + ph(d.position, 'position') + ' - ' + ph(d.name, 'your name');
      if (letter) {
        L.push(ph(d.city, 'city') + ', ' + MONTH[now.getMonth()] + ' ' + now.getDate() + ', ' + now.getFullYear(), '');
        L.push(d.recipient || 'Hiring Manager', ph(d.company, 'company name'), '');
        L.push('Re: Application for ' + ph(d.position, 'position'), '');
      }
      L.push((casual ? 'Hi ' : 'Dear ') + toE + ',', '');
      L.push((casual ? "I'm " : 'My name is ') + ph(d.name, 'your name') + ', ' + expE + ' ' + ph(d.field, 'your field') + '. ' +
        (casual ? "I'd love to join " + ph(d.company, 'company name') + ' as ' : 'I am writing to apply for the ') +
        ph(d.position, 'position') + (casual ? '' : ' position at ' + ph(d.company, 'company name')) +
        (src ? (casual ? ' after seeing the opening on ' : ', which I found on ') + src : '') + '.', '');
      L.push((casual ? 'I work daily with ' : 'I am skilled in ') + ph(skills, 'skills') + '. ' +
        'One of my recent achievements was ' + ph(d.win, 'best achievement') + '. ' +
        (casual ? "I'd be excited to bring similar results to your team." : 'I am confident I can bring the same results to your team.'), '');
      L.push((d.link ? 'You can see my work at ' + d.link + '. ' : '') + 'My CV is attached for your review.', '');
      L.push(casual ? 'Thanks for reading, and I hope we can chat soon.'
                    : 'Thank you for your time and consideration. I look forward to the opportunity to discuss how I can contribute.', '');
      L.push(casual ? 'Best regards,' : 'Sincerely,');
    }
    L.push(ph(d.name, en ? 'your name' : 'nama kamu'));
    var contact = [d.phone, d.email].filter(Boolean).join(' | ');
    if (contact) L.push(contact);

    $('subject').textContent = subject;
    $('subject-row').hidden = letter;
    $('out').textContent = L.join('\n');
    $('mailto').hidden = letter;
    $('mailto').href = 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(L.join('\n'));
    save();
  }

  function text() {
    var body = $('out').innerText.replace(/\n{3,}/g, '\n\n').trim();
    return opt.kind === 'email' ? 'Subjek: ' + $('subject').innerText.trim() + '\n\n' + body : body;
  }
  function toast(t) { $('toast').textContent = t; setTimeout(function () { $('toast').textContent = ''; }, 2500); }

  function save() {
    var s = { opt: opt };
    FIELDS.forEach(function (k) { s[k] = $(k).value; });
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (s) {
      FIELDS.forEach(function (k) { if (s[k] != null) $(k).value = s[k]; });
      if (s.opt) opt = s.opt;
      return;
    }
    // Belum pernah dipakai: isi otomatis dari CV ATS kalau ada
    try {
      var cv = JSON.parse(localStorage.getItem('jejakkarya-cv-v1') || 'null');
      if (cv && cv.name) {
        $('name').value = cv.name || ''; $('email').value = cv.email || ''; $('phone').value = cv.phone || '';
        $('city').value = (cv.city || '').split(',')[0]; $('position').value = cv.headline || ''; $('link').value = cv.website || '';
        $('skills').value = (cv.skills || '').split(',').slice(0, 3).map(function (x) { return x.trim(); }).filter(Boolean).join(', ');
      }
    } catch (e) {}
  }
  function syncSegs() {
    document.querySelectorAll('.seg[data-opt]').forEach(function (seg) {
      seg.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === opt[seg.dataset.opt])); });
    });
  }

  $('lform').addEventListener('input', build);
  $('lform').addEventListener('change', build);
  $('lform').addEventListener('submit', function (e) { e.preventDefault(); });
  document.querySelectorAll('.seg[data-opt]').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      opt[seg.dataset.opt] = b.dataset.v; syncSegs(); build();
    });
  });
  $('sample').addEventListener('click', function () { Object.keys(SAMPLE).forEach(function (k) { $(k).value = SAMPLE[k]; }); build(); });

  $('copy').addEventListener('click', function () {
    var t = text();
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { toast('Teks tersalin.'); }, function () { toast('Tidak bisa menyalin otomatis. Pilih teks lalu salin manual.'); });
    else toast('Tidak bisa menyalin otomatis. Pilih teks lalu salin manual.');
  });

  function pdfSafe(s) {
    return (s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7E -ÿ\n]/g, '');
  }
  $('pdf').addEventListener('click', function () {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('Pembuat PDF belum termuat. Coba muat ulang halaman.'); return; }
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 60, y = 64, size = 11, lh = size * 1.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(size);
    var body = pdfSafe($('out').innerText.replace(/\n{3,}/g, '\n\n').trim());
    body.split('\n').forEach(function (para) {
      var lines = para ? doc.splitTextToSize(para, W - M * 2) : [''];
      lines.forEach(function (line) {
        if (y + lh > H - 60) { doc.addPage(); y = 64; }
        doc.text(line, M, y); y += lh;
      });
    });
    var name = v('name') || 'Lamaran', pos = v('position');
    doc.setProperties({ title: 'Surat Lamaran ' + pdfSafe(name), author: pdfSafe(name), creator: 'Jejak Karya' });
    doc.save(('Surat Lamaran - ' + name + (pos ? ' - ' + pos : '')).replace(/[\\/:*?"<>|]+/g, '') + '.pdf');
    toast('PDF terunduh.');
    if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: 'unduh-surat-lamaran', title: 'Unduh surat lamaran PDF', event: true });
  });

  load(); syncSegs(); build();
})();
