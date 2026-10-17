// Filter katalog template
(function () {
  var tabs = document.querySelectorAll('.tab');
  var groups = document.querySelectorAll('.tpl-group');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var show = tab.dataset.show;
      tabs.forEach(function (t) { t.setAttribute('aria-pressed', String(t === tab)); });
      groups.forEach(function (g) { g.hidden = !(show === 'semua' || g.dataset.paket === show); });
    });
  });
})();
