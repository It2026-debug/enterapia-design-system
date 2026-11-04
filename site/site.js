(function () {
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} },
  };

  // Theme: system -> light -> dark
  var themeButton = document.getElementById('theme');
  function currentTheme() { var t = root.getAttribute('data-theme'); return t === 'light' || t === 'dark' ? t : 'system'; }
  var themeNames = { system: 'sistema', light: 'claro', dark: 'oscuro' };
  function paintTheme() { if (themeButton) themeButton.textContent = 'Tema: ' + themeNames[currentTheme()]; }
  if (themeButton) {
    themeButton.addEventListener('click', function () {
      var next = { system: 'light', light: 'dark', dark: 'system' }[currentTheme()];
      if (next === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', next);
      store.set('ds-theme', next === 'system' ? null : next);
      paintTheme();
    });
    paintTheme();
  }

  // Sidebar (mobile): closes with Escape and gives the focus back to the menu button
  var menu = document.getElementById('menu');
  function closeMenu() {
    document.body.classList.remove('nav-open');
    if (menu) menu.setAttribute('aria-expanded', 'false');
  }
  if (menu) {
    menu.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      menu.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && document.body.classList.contains('nav-open')) { closeMenu(); menu.focus(); }
    });
  }
  var current = document.querySelector('.sidebar a[aria-current="page"]');
  if (current && current.scrollIntoView) current.scrollIntoView({ block: 'nearest' });

  // Token filter
  var q = document.getElementById('q');
  var status = document.getElementById('status');
  if (q) {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-search]'));
    q.addEventListener('input', function () {
      var terms = q.value.toLowerCase().split(/\s+/).filter(Boolean);
      var shown = 0;
      items.forEach(function (el) {
        var ok = terms.every(function (t) { return el.getAttribute('data-search').indexOf(t) !== -1; });
        el.hidden = !ok;
        if (ok) shown++;
      });
      document.querySelectorAll('main .category, main .group').forEach(function (s) {
        s.hidden = !s.querySelector('[data-search]:not([hidden])');
      });
      if (status) status.textContent = terms.length ? shown + ' de ' + items.length + ' tokens' : '';
    });
  }

  // Copy CSS variable / code
  document.addEventListener('click', function (event) {
    var el = event.target.closest('[data-copy]');
    if (!el) return;
    var text = el.getAttribute('data-copy');
    var out = status || document.getElementById('toast-copy');
    try {
      navigator.clipboard.writeText(text).then(
        function () { if (out) out.textContent = 'Copiado: ' + text; },
        function () { if (out) out.textContent = 'No se pudo copiar. Usa: ' + text; }
      );
    } catch (e) { if (out) out.textContent = 'Copia manual: ' + text; }
  });

  function applyIndeterminate(scope) {
    scope.querySelectorAll('input[data-indeterminate]').forEach(function (input) { input.indeterminate = true; });
  }

  // Component playground: pick a variant by its axis values
  document.querySelectorAll('[data-playground]').forEach(function (box) {
    var stage = box.querySelector('[data-stage]');
    var code = box.querySelector('[data-code]');
    var selects = box.querySelectorAll('select[data-axis]');
    var variants = box.querySelectorAll('template[data-variant]');
    function update() {
      var want = {};
      selects.forEach(function (s) { want[s.getAttribute('data-axis')] = s.value; });
      var key = JSON.stringify(want);
      var found = null;
      variants.forEach(function (t) { if (t.getAttribute('data-variant') === key) found = t; });
      if (!stage) return;
      if (found) {
        stage.innerHTML = found.innerHTML;
        applyIndeterminate(stage);
        if (code) code.textContent = found.getAttribute('data-html');
        stage.removeAttribute('data-missing');
      } else {
        stage.innerHTML = '<span class="cap">Esta combinación no existe en Figma.</span>';
        if (code) code.textContent = '';
      }
    }
    selects.forEach(function (s) { s.addEventListener('change', update); });
    update();
  });

  // Regions that scroll sideways must be reachable with the keyboard, but only when they really scroll.
  var scrollers = Array.prototype.slice.call(document.querySelectorAll('.table-wrap, .matrix, .stage'));
  function markScrollers() {
    scrollers.forEach(function (el) {
      var scrolls = el.scrollWidth > el.clientWidth + 1;
      if (scrolls) { el.setAttribute('tabindex', '0'); el.setAttribute('data-scroll', ''); }
      else { el.removeAttribute('tabindex'); el.removeAttribute('data-scroll'); }
    });
  }
  markScrollers();
  window.addEventListener('resize', markScrollers);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(markScrollers);

  // Indeterminate checkboxes cannot be declared in HTML: the documentation marks them with an attribute.
  applyIndeterminate(document);
})();
