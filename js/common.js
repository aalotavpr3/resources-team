/* common.js — تحميل البيانات + الترويسة والتذييل + دوال مشتركة */
(function () {
  var def = window.SITE_DEFAULT;

  // البيانات المحفوظة من لوحة التحكم على هذا الجهاز تتغلّب فقط إذا كانت أحدث من data.js
  function load() {
    try {
      var l = JSON.parse(localStorage.getItem('mrk_data'));
      if (l && l.updated > (def.updated || 0)) return l;
    } catch (e) {}
    return JSON.parse(JSON.stringify(def));
  }
  window.DATA = load();

  window.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  window.fmtDate = function (d) {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString('ar-BH-u-ca-gregory-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return d; }
  };

  // صورة افتراضية (الحرف الأول من الاسم) عند عدم وجود صورة
  window.avatar = function (m) {
    if (m.photo) return m.photo;
    var ch = esc((m.name || '؟').trim().charAt(0));
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2A4FA3"/><stop offset="1" stop-color="#4FB3CF"/></linearGradient></defs><rect width="200" height="200" fill="url(#g)"/><text x="100" y="128" font-size="90" font-family="Cairo,Arial" font-weight="800" fill="#fff" text-anchor="middle">' + ch + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };

  window.CATS = { latest: 'آخر الأخبار', resources: 'أخبار المصادر', achievements: 'إنجازاتنا' };
  window.LEVELS = { leader: 'قائد الفريق', head: 'الرئيس', deputy: 'النائب', member: 'عضو' };

  // رابط صفحة العضو (يُستخدم في QR) — يفضَّل ضبط siteUrl من لوحة التحكم
  window.memberUrl = function (id) {
    var base = (DATA.settings.siteUrl || '').trim();
    if (base) return base.replace(/\/+$/, '') + '/member.html?id=' + encodeURIComponent(id);
    return new URL('member.html?id=' + encodeURIComponent(id), location.href).href;
  };

  window.chrome = function (active) {
    var s = DATA.settings;
    var links = [
      ['home', 'index.html', 'الرئيسية'],
      ['news', 'index.html#news', 'الأخبار'],
      ['team', 'team.html', 'فريقنا'],
      ['about', 'index.html#about', 'من نحن'],
      ['contact', '#contact', 'تواصل معنا']
    ];
    var h = document.getElementById('site-header');
    if (h) {
      h.innerHTML =
        '<header>' +
        '<div class="brandrow wrap">' +
        '<a class="brand-school" href="index.html"><img src="assets/school-logo.jpg" alt="' + esc(s.schoolName) + ' — وزارة التربية والتعليم"></a>' +
        '<a class="brand-team" href="index.html"><img src="assets/team-logo.png" alt="شعار الفريق"><span>' + esc(s.teamName) + '<small>' + esc(s.schoolName) + '</small></span></a>' +
        '</div>' +
        '<nav class="nav" aria-label="القائمة الرئيسية"><div class="wrap navin">' +
        '<button class="burger" aria-expanded="false" aria-controls="menu">القائمة ☰</button>' +
        '<ul id="menu">' + links.map(function (l) {
          return '<li><a href="' + l[1] + '"' + (l[0] === active ? ' class="on" aria-current="page"' : '') + '>' + l[2] + '</a></li>';
        }).join('') + '</ul></div></nav></header>';
      var b = h.querySelector('.burger'), m = h.querySelector('#menu');
      b.addEventListener('click', function () {
        var o = m.classList.toggle('open');
        b.setAttribute('aria-expanded', o);
      });
      m.addEventListener('click', function (e) { if (e.target.tagName === 'A') m.classList.remove('open'); });
    }

    var f = document.getElementById('site-footer');
    if (f) {
      var soc = [];
      if (s.whatsapp) soc.push('<a href="https://wa.me/' + esc(s.whatsapp.replace(/\D/g, '')) + '" target="_blank" rel="noopener">واتساب</a>');
      if (s.instagram) soc.push('<a href="' + esc(s.instagram) + '" target="_blank" rel="noopener">إنستغرام</a>');
      if (s.x) soc.push('<a href="' + esc(s.x) + '" target="_blank" rel="noopener">إكس (تويتر)</a>');
      if (s.tiktok) soc.push('<a href="' + esc(s.tiktok) + '" target="_blank" rel="noopener">تيك توك</a>');
      if (s.email) soc.push('<a href="mailto:' + esc(s.email) + '">البريد الإلكتروني</a>');
      f.innerHTML =
        '<footer class="foot" id="contact"><div class="zig" style="transform:scaleY(-1)"></div>' +
        '<div class="wrap cols">' +
        '<div><h4>' + esc(s.teamName) + '</h4><p>' + esc(s.about) + '</p></div>' +
        '<div><h4>روابط سريعة</h4><ul>' +
        '<li><a href="index.html">الرئيسية</a></li><li><a href="index.html#news">الأخبار والإنجازات</a></li><li><a href="team.html">فريقنا</a></li><li><a href="index.html#about">من نحن</a></li></ul></div>' +
        '<div><h4>تواصل معنا</h4>' +
        (soc.length ? '<div class="soc">' + soc.join('') + '</div>' : '<p>ستظهر وسائل التواصل هنا بعد إضافتها من لوحة التحكم.</p>') +
        '</div></div>' +
        '<div class="copy">جميع الحقوق محفوظة لطاقم فريق مصادر التعلم</div></footer>';
    }
    document.title = (document.title ? document.title + ' | ' : '') + s.teamName;
  };

  // نافذة منبثقة بسيطة
  window.openDialog = function (html) {
    var d = document.getElementById('dlg');
    d.innerHTML = '<div class="dlg-in">' + html + '<p style="margin:16px 0 0"><button class="btn ghost sm" id="dlgClose">إغلاق</button></p></div>';
    d.querySelector('#dlgClose').onclick = function () { d.close(); };
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); }, { once: true });
    d.showModal();
  };
})();
