// Kalkulator tarif freelance – Jejak Karya
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var KEY = 'jejakkarya-tarif-v1';
  var FIELDS = ['target', 'cost', 'days', 'hours', 'off', 'buffer', 'pname', 'phours'];

  function num(v) { return parseFloat(String(v).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '')) || 0; }
  function rp(n) { return 'Rp' + Math.round(n).toLocaleString('id-ID'); }
  function roundUp(n, step) { return Math.ceil(n / step) * step; }
  function fmtInput(el) {
    var pos = el.value.length - el.selectionStart;
    var n = num(el.value);
    el.value = n ? n.toLocaleString('id-ID') : '';
    try { var p = Math.max(0, el.value.length - pos); el.setSelectionRange(p, p); } catch (e) {}
  }

  var last = {};
  // Ringkasan menempel di bawah layar (HP)
  var sumBar = document.createElement('a');
  sumBar.className = 'mobile-sum';
  sumBar.href = '#r-hour';
  sumBar.setAttribute('aria-label', 'Lihat hasil hitungan');
  document.body.appendChild(sumBar);
  function calc() {
    var target = num($('target').value), cost = num($('cost').value);
    var days = Math.min(7, Math.max(1, num($('days').value) || 1));
    var hours = Math.min(12, Math.max(0.5, num($('hours').value) || 1));
    var off = Math.min(20, Math.max(0, num($('off').value)));
    var buffer = num($('buffer').value) / 100;
    var phours = Math.max(0.5, num($('phours').value) || 1);

    var yearNeed = (target + cost) * 12 / (1 - buffer);
    var billable = (52 - off) * days * hours;
    var hour = billable ? roundUp(yearNeed / billable, 5000) : 0;
    var day = hour * hours;
    var project = roundUp(hour * phours, 10000);
    var monthGross = yearNeed / 12;
    var projectsPerMonth = project ? monthGross / project : 0;

    $('r-hour').textContent = rp(hour);
    $('r-day').textContent = rp(day);
    $('r-project').textContent = rp(project);
    $('r-pname-label').textContent = 'Per proyek: ' + ($('pname').value.trim() || 'proyek');
    $('b-year').textContent = rp(yearNeed);
    $('b-hours').textContent = Math.round(billable).toLocaleString('id-ID') + ' jam';
    $('b-month').textContent = rp(monthGross);
    $('b-projects').textContent = projectsPerMonth ? (Math.ceil(projectsPerMonth * 10) / 10).toLocaleString('id-ID') + ' proyek' : '-';

    sumBar.innerHTML = '';
    var a = document.createElement('span'); a.textContent = 'Per jam '; var b = document.createElement('b'); b.textContent = rp(hour); a.appendChild(b);
    var c = document.createElement('span'); c.textContent = 'Per proyek '; var d = document.createElement('b'); d.textContent = rp(project); c.appendChild(d);
    sumBar.appendChild(a); sumBar.appendChild(c);
    last = { hour: hour, day: day, project: project, pname: $('pname').value.trim() || 'proyek', phours: phours, target: target, monthGross: monthGross };
    save();
  }

  function save() {
    var s = {};
    FIELDS.forEach(function (k) { s[k] = $(k).value; });
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }
  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s) FIELDS.forEach(function (k) { if (s[k] != null && s[k] !== '') $(k).value = s[k]; });
    } catch (e) {}
  }

  var form = $('calc');
  form.addEventListener('input', function (e) {
    if (e.target.id === 'target' || e.target.id === 'cost') fmtInput(e.target);
    if (e.target.id === 'pname' || e.target.id === 'phours') markPreset();
    calc();
  });
  form.addEventListener('change', calc);
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  function markPreset() {
    document.querySelectorAll('#presets .chip').forEach(function (c) {
      c.setAttribute('aria-pressed', String(c.dataset.n === $('pname').value && c.dataset.h === $('phours').value));
    });
  }
  document.querySelectorAll('#presets .chip').forEach(function (c) {
    c.setAttribute('aria-pressed', 'false');
    c.addEventListener('click', function () {
      $('pname').value = c.dataset.n; $('phours').value = c.dataset.h;
      markPreset(); calc();
    });
  });

  $('copy').addEventListener('click', function () {
    var t = 'Hitungan tarif freelance saya (Jejak Karya):\n' +
      '- Target bersih per bulan: ' + rp(last.target) + '\n' +
      '- Tarif minimum per jam: ' + rp(last.hour) + '\n' +
      '- Tarif per hari: ' + rp(last.day) + '\n' +
      '- ' + last.pname + ' (' + String(last.phours).replace('.', ',') + ' jam): ' + rp(last.project) + '\n' +
      'Hitung punyamu: jejakkarya.github.io/kalkulator-tarif/';
    var done = function (ok) { $('copied').textContent = ok ? 'Tersalin.' : 'Tidak bisa menyalin otomatis. Pilih teks hasil secara manual.'; setTimeout(function () { $('copied').textContent = ''; }, 2500); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });

  load();
  ['target', 'cost'].forEach(function (id) { fmtInput($(id)); });
  markPreset();
  calc();
})();
