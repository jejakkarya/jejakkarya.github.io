// Jejak Karya – interaksi landing page
(function () {
  var mobile = window.matchMedia('(max-width: 820px)');

  // ----- Filter katalog template -----
  var tabs = document.querySelectorAll('.tab');
  var groups = document.querySelectorAll('.tpl-group');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var show = tab.dataset.show;
      tabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t === tab)); });
      groups.forEach(function (g) { g.hidden = !(show === 'semua' || g.dataset.paket === show); });
    });
  });

  // ----- Menu garis tiga -----
  var nav = document.querySelector('.nav');
  var btn = document.querySelector('.menu-btn');
  var menu = document.getElementById('menu');
  function setMenu(open) {
    nav.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  }
  if (btn && menu) {
    btn.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    menu.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('click', function (e) { if (nav.classList.contains('open') && !nav.contains(e.target)) setMenu(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); btn.focus(); } });
    mobile.addEventListener('change', function () { if (!mobile.matches) setMenu(false); });
  }

  // ----- Carousel geser (HP) -----
  document.querySelectorAll('[data-carousel]').forEach(function (track) {
    var items = Array.prototype.slice.call(track.children);
    var label = track.classList.contains('plans') ? 'paket' : 'template';
    var hint = document.createElement('p');
    hint.className = 'swipe-hint';
    hint.textContent = 'Geser untuk melihat ' + items.length + ' ' + label + ' →';
    track.parentNode.insertBefore(hint, track);
    var dots = document.createElement('div');
    dots.className = 'dots';
    dots.setAttribute('aria-label', 'Posisi ' + label);
    items.forEach(function (it, i) {
      var d = document.createElement('button');
      d.type = 'button'; d.className = 'dot';
      d.setAttribute('aria-label', label.charAt(0).toUpperCase() + label.slice(1) + ' ' + (i + 1) + ' dari ' + items.length);
      d.addEventListener('click', function () { go(i, true); });
      dots.appendChild(d);
    });
    track.parentNode.insertBefore(dots, track.nextSibling);

    function go(i, smooth) {
      var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
      var left = items[i].getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft - pad;
      track.scrollTo({ left: left, behavior: smooth ? 'smooth' : 'auto' });
    }
    function update() {
      var base = track.getBoundingClientRect().left;
      var best = 0, bestD = Infinity;
      items.forEach(function (it, i) {
        var d = Math.abs(it.getBoundingClientRect().left - base - (parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0));
        if (d < bestD) { bestD = d; best = i; }
      });
      Array.prototype.forEach.call(dots.children, function (d, i) { d.setAttribute('aria-current', String(i === best)); });
    }
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);

    var start = track.dataset.start && track.querySelector(track.dataset.start);
    if (start && mobile.matches) {
      window.requestAnimationFrame(function () {
        var pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
        track.scrollLeft = start.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft - pad;
        update();
      });
    }
    update();
  });
})();

// Pita info CV ATS gratis: bisa ditutup, diingat di browser ini
(function () {
  var bar = document.getElementById('topbar');
  var close = bar && bar.querySelector('.topbar-close');
  if (!close) return;
  close.addEventListener('click', function () {
    bar.hidden = true;
    try { localStorage.setItem('jk-topbar', 'tutup'); } catch (e) {}
  });
})();

// Kartu paket: "Lihat detail" membuka daftar lengkap di tempat
(function () {
  document.querySelectorAll('.more-btn').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    var label = btn.querySelector('.more-label');
    var count = btn.querySelector('.more-count');
    if (!panel) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      panel.classList.toggle('open', open);
      label.textContent = open ? 'Sembunyikan detail' : 'Lihat detail';
      if (count) count.hidden = open;
    });
  });
})();
