// Interaksi template Layar: kursor, angka berjalan, slider sebelum/sesudah,
// navigasi case study, dan prototype aplikasi yang bisa diklik.
// Tidak perlu diubah.
(function () {
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }

  // ----- Kursor berlabel di hero (desktop) -----
  var hero = document.querySelector('.hero');
  var cursor = document.querySelector('.cursor');
  if (hero && cursor && !calm && window.matchMedia('(hover: hover)').matches) {
    var idle = null;
    function wander() {
      var r = hero.getBoundingClientRect();
      var x = r.width * (0.55 + Math.random() * 0.35), y = r.height * (0.25 + Math.random() * 0.5);
      cursor.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }
    cursor.style.transition = 'transform 1.4s cubic-bezier(.4,0,.2,1)';
    wander(); idle = setInterval(wander, 2200);
    hero.addEventListener('mousemove', function (e) {
      if (idle) { clearInterval(idle); idle = null; cursor.style.transition = 'transform .18s ease-out'; }
      var r = hero.getBoundingClientRect();
      cursor.style.transform = 'translate(' + (e.clientX - r.left + 14) + 'px,' + (e.clientY - r.top + 12) + 'px)';
    });
    hero.addEventListener('mouseleave', function () {
      if (!idle) { cursor.style.transition = 'transform 1.4s cubic-bezier(.4,0,.2,1)'; idle = setInterval(wander, 2200); }
    });
  }

  // ----- Angka berjalan -----
  function fmt(n) { return Math.round(n).toLocaleString('id-ID'); }
  function run(el) {
    var to = parseFloat(el.dataset.to);
    if (calm || !to) { el.textContent = fmt(to); return; }
    var t0 = null;
    function step(t) {
      if (!t0) t0 = t;
      var p = Math.min((t - t0) / 1100, 1);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    el.textContent = '0';
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
    }, { threshold: 0.6 });
    each('.count', function (el) { cio.observe(el); });
  }

  // ----- Slider sebelum/sesudah -----
  each('[data-ba]', function (box) {
    var range = box.querySelector('.ba-range');
    function set() { box.style.setProperty('--pos', range.value + '%'); }
    range.addEventListener('input', set); set();
  });

  // ----- Navigasi case study yang menyala sesuai bagian yang dibaca -----
  var links = {};
  each('.cs-nav a', function (a) { links[a.getAttribute('href').slice(1)] = a; });
  if ('IntersectionObserver' in window && Object.keys(links).length) {
    var nio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting && links[e.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === e.target.id); });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    each('.cs-part', function (s) { nio.observe(s); });
  }

  // ----- Prototype aplikasi -----
  each('[data-proto]', function (app) {
    var screens = {};
    each('.screen', function (s) { screens[s.dataset.screen] = s; }, app);
    var side = app.closest('.proto') && app.closest('.proto').querySelector('.proto-side');
    var order = ['home', 'jadwal', 'konfirmasi', 'tiket'];
    var current = 'home', timer = null;

    function steps(name) {
      if (!side) return;
      var idx = order.indexOf(name);
      each('.proto-steps li', function (li) {
        var i = order.indexOf(li.dataset.step);
        li.classList.toggle('on', i === idx);
        li.classList.toggle('done', i < idx);
      }, side);
    }

    function startTicket() {
      var s = screens.tiket;
      var serving = 19, mine = 24;
      var num = s.querySelector('.a-serving'), bar = s.querySelector('.a-bar span'), eta = s.querySelector('.a-eta-text'), toast = s.querySelector('.a-toast');
      function paint() {
        num.textContent = 'A-0' + serving;
        var left = mine - serving;
        bar.style.width = Math.round(((serving - 14) / (mine - 14)) * 100) + '%';
        eta.textContent = left > 0 ? 'Giliranmu ± ' + left * 5 + ' menit lagi' : 'Giliranmu sekarang. Silakan masuk ke Poli Umum.';
      }
      clearInterval(timer);
      paint();
      setTimeout(function () { toast.classList.add('show'); }, 500);
      setTimeout(function () { toast.classList.remove('show'); }, 3600);
      timer = setInterval(function () {
        if (serving >= mine) { clearInterval(timer); return; }
        serving++; paint();
      }, 2600);
    }

    function go(name) {
      if (!screens[name] || name === current) return;
      var from = screens[current], to = screens[name];
      var back = order.indexOf(name) < order.indexOf(current);
      from.classList.remove('on');
      from.classList.toggle('off-left', !back);
      to.classList.remove('off-left');
      to.classList.add('on');
      current = name;
      steps(name);
      if (name === 'tiket') startTicket(); else clearInterval(timer);
    }

    app.addEventListener('click', function (e) {
      var date = e.target.closest('.a-date');
      if (date) { each('.a-date', function (d) { d.classList.toggle('sel', d === date); }, date.parentNode); return; }
      var slot = e.target.closest('.a-slot');
      if (slot) { each('.a-slot', function (d) { d.classList.toggle('sel', d === slot); }, slot.parentNode); return; }
      var sw = e.target.closest('.a-switch');
      if (sw) { sw.setAttribute('aria-checked', String(sw.getAttribute('aria-checked') !== 'true')); return; }
      var btn = e.target.closest('[data-go]');
      if (!btn) return;
      if (btn.dataset.load) {
        var label = btn.textContent;
        btn.classList.add('loading'); btn.textContent = 'Mengambil nomor…';
        setTimeout(function () { btn.classList.remove('loading'); btn.textContent = label; go(btn.dataset.go); }, 700);
      } else {
        go(btn.dataset.go);
      }
    });

    if (side) {
      var reset = side.querySelector('.proto-reset');
      if (reset) reset.addEventListener('click', function () { go('home'); });
    }
    steps('home');
  });
})();
