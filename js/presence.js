/* presence.js — «ابحث عن وجودك»
   - بحث بالاسم داخل الأعضاء والأخبار وأوصاف الصور
   - بحث بالوجه: تُعالَج صورة الزائر على جهازه فقط (face-api.js) ولا تُرفع لأي خادم
   - يعتمد على window.DATA و esc و avatar و LEVELS و CATS و memberUrl من common.js */
(function () {
  if (window.PresenceAI) return;

  var VER = '1.7.12';
  var CDN = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@' + VER + '/dist/face-api.js';
  var MODELS = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@' + VER + '/model/';
  var TH = 0.5;      // أقصى مسافة لاعتبار الوجهين متطابقين (أقل = أدق)
  var TH_ID = 0.45;  // أقصى مسافة للتعرّف على هوية عضو من صورته الشخصية

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= أدوات عامة ================= */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ').trim();
  }
  function hsh(src) { return String(src).length + ':' + String(src).slice(-20); }
  function enc(d) { return Array.prototype.map.call(d, function (x) { return Math.round(x * 1000) / 1000; }).join(','); }
  function dec(s) { return Float32Array.from(String(s).split(','), Number); }
  function dist(a, b) { var s = 0; for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); }
  function area(r) { var b = r.detection.box; return b.width * b.height; }

  /* قائمة كل الصور القابلة للفهرسة في الموقع */
  function sources(D) {
    var out = [];
    (D.members || []).forEach(function (m) {
      if (m.photo) out.push({ k: 'p:' + m.id, t: 'p', m: m.id, src: m.photo, caption: m.name, label: m.name });
      (m.gallery || []).forEach(function (g, i) {
        out.push({ k: 'g:' + m.id + ':' + i, t: 'g', m: m.id, src: g.src, caption: g.caption || '', label: 'معرض ' + m.name });
      });
    });
    (D.news || []).forEach(function (n) {
      if (n.image) out.push({ k: 'n:' + n.id, t: 'n', n: n.id, src: n.image, caption: n.title, label: 'خبر: ' + n.title });
    });
    return out;
  }

  /* الفهرس المحفوظ (يتجاهل الصور التي تغيّرت بعد بناء الفهرس) */
  function getIndex(D) {
    var ix = D.faceIndex;
    if (!ix || !ix.items || !ix.items.length) return null;
    var map = {};
    sources(D).forEach(function (s) { map[s.k] = s; });
    var items = [];
    ix.items.forEach(function (it) {
      var s = map[it.k];
      if (s && hsh(s.src) === it.h) items.push({ s: s, f: it.f.map(dec) });
    });
    return items;
  }

  function matchFace(q, items) {
    var res = [];
    items.forEach(function (it) {
      var best = 9;
      it.f.forEach(function (d) { var x = dist(q, d); if (x < best) best = x; });
      if (best < TH) res.push({ s: it.s, d: best });
    });
    res.sort(function (a, b) { return a.d - b.d; });
    return res;
  }

  function nameSearch(D, q) {
    var toks = norm(q).split(' ').filter(Boolean);
    if (!toks.length) return null;
    function hit(txt) { var t = norm(txt); return toks.every(function (k) { return t.indexOf(k) > -1; }); }
    var byName = [], byOther = [];
    (D.members || []).forEach(function (m) {
      if (hit(m.name)) byName.push(m);
      else if (hit((m.role || '') + ' ' + (m.skills || []).join(' ') + ' ' + (m.bio || ''))) byOther.push(m);
    });
    var news = (D.news || []).filter(function (n) { return hit(n.title + ' ' + n.text); });
    var photos = sources(D).filter(function (s) { return s.t === 'g' && s.caption && hit(s.caption); });
    return { members: byName.concat(byOther), news: news, photos: photos };
  }

  /* ================= محرّك الذكاء الاصطناعي ================= */
  var apiP = null;
  function loadAI(status) {
    if (apiP) return apiP;
    apiP = new Promise(function (res, rej) {
      if (window.faceapi) return res();
      status && status('تحميل محرّك الذكاء الاصطناعي…');
      var s = document.createElement('script');
      s.src = CDN; s.onload = res;
      s.onerror = function () { rej(new Error('تعذّر تحميل محرّك التعرف على الوجوه. تحقق من الاتصال بالإنترنت.')); };
      document.head.appendChild(s);
    }).then(function () {
      status && status('تحميل نماذج التعرف على الوجه (مرة واحدة فقط)…');
      return Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS)
      ]);
    }).catch(function (e) { apiP = null; throw e; });
    return apiP;
  }

  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { rej(new Error('تعذّر قراءة الصورة')); };
      im.src = src;
    });
  }
  function detect(img) {
    return faceapi.detectAllFaces(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
      .withFaceLandmarks().withFaceDescriptors();
  }
  async function analyze(s) {
    var im = await loadImg(s.src);
    var r = await detect(im);
    r.sort(function (a, b) { return area(b) - area(a); });
    if (s.t === 'p') r = r.slice(0, 1);       // الصورة الشخصية: أكبر وجه فقط
    return r.map(function (x) { return x.descriptor; });
  }

  /* بناء الفهرس (يُستخدم من لوحة التحكم) */
  async function buildIndex(D, onP) {
    onP = onP || function () {};
    await loadAI(function (m) { onP({ status: m }); });
    var list = sources(D), items = [], faces = 0;
    for (var i = 0; i < list.length; i++) {
      var s = list[i], f = [];
      try { f = (await analyze(s)).map(enc); } catch (e) { f = []; }
      faces += f.length;
      items.push({ k: s.k, h: hsh(s.src), f: f });
      onP({ i: i + 1, n: list.length, faces: faces });
      await sleep(0);
    }
    return { v: 1, built: Date.now(), items: items };
  }

  function stats(D) {
    var list = sources(D), ix = getIndex(D) || [];
    var faces = 0; ix.forEach(function (it) { faces += it.f.length; });
    return { photos: list.length, indexed: ix.length, faces: faces, built: D.faceIndex && D.faceIndex.built, stale: list.length - ix.length };
  }

  /* مسح مباشر عند عدم وجود فهرس (أبطأ) */
  var live = null;
  async function liveItems(D, onP) {
    var sig = sources(D).map(function (s) { return s.k + hsh(s.src); }).join('|');
    if (live && live.sig === sig) return live.items;
    var list = sources(D), items = [];
    for (var i = 0; i < list.length; i++) {
      var f = []; try { f = await analyze(list[i]); } catch (e) {}
      items.push({ s: list[i], f: f });
      onP && onP(i + 1, list.length);
      await sleep(0);
    }
    live = { sig: sig, items: items };
    return items;
  }

  window.PresenceAI = { buildIndex: buildIndex, stats: stats, _t: { norm: norm, nameSearch: nameSearch, matchFace: matchFace, dec: dec, enc: enc, sources: sources, getIndex: getIndex, dist: dist } };

  /* ================= الواجهة ================= */
  var dlg, st = { faces: [], im: null, items: null, busy: false };

  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = 'presenceDlg'; dlg.className = 'pz';
    dlg.setAttribute('aria-labelledby', 'pzTitle');
    dlg.innerHTML =
      '<div class="pz-in">' +
      '<button class="pz-x" type="button" aria-label="إغلاق">×</button>' +
      '<header class="pz-head"><h2 id="pzTitle">ابحث عن وجودك</h2><p>اعثر على صورك وحضورك في فعاليات وأنشطة فريق مصادر التعلم</p></header>' +
      '<div class="pz-tabs" role="tablist">' +
      '<button role="tab" data-p="name" aria-selected="true">بالاسم</button>' +
      '<button role="tab" data-p="face" aria-selected="false">بالصورة (تعرّف على الوجه)</button></div>' +

      '<section class="pz-panel" data-p="name">' +
      '<form class="pz-form" id="pzNameForm"><input id="pzQ" type="search" placeholder="اكتب اسمك أو جزءاً منه…" autocomplete="off"><button class="btn">بحث</button></form>' +
      '</section>' +

      '<section class="pz-panel" data-p="face" hidden>' +
      '<div class="pz-drop" id="pzDrop" tabindex="0" role="button" aria-label="ارفع صورة وجهك">' +
      '<div class="pz-ring"></div><div class="pz-drop-t"><b>اسحب صورتك هنا</b><span>أو اضغط لاختيار صورة واضحة للوجه</span></div>' +
      '<input type="file" id="pzFile" accept="image/*" hidden></div>' +
      '<div class="pz-stage" id="pzStage" hidden>' +
      '<div class="pz-frame"><img id="pzImg" alt="الصورة التي رفعتها"><div class="pz-scan"><i></i></div><div class="pz-boxes" id="pzBoxes"></div>' +
      '<span class="pz-c tl"></span><span class="pz-c tr"></span><span class="pz-c bl"></span><span class="pz-c br"></span></div>' +
      '<div class="pz-status" id="pzStatus" role="status" aria-live="polite"></div>' +
      '<div class="pz-bar"><i id="pzBar"></i></div></div>' +
      '<p class="pz-note">🔒 تتم المعالجة على جهازك فقط، ولا تُرفع صورتك إلى أي خادم ولا تُحفظ.</p>' +
      '</section>' +

      '<div id="pzOut" class="pz-out" aria-live="polite"></div>' +
      '<div class="pz-lb" id="pzLb" hidden></div></div>';
    document.body.appendChild(dlg);

    $('.pz-x', dlg).onclick = function () { dlg.close(); };
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    $('.pz-tabs', dlg).onclick = function (e) {
      var b = e.target.closest('button[data-p]'); if (!b) return;
      dlg.querySelectorAll('.pz-tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      dlg.querySelectorAll('.pz-panel').forEach(function (p) { p.hidden = p.dataset.p !== b.dataset.p; });
      $('#pzOut', dlg).innerHTML = '';
    };
    $('#pzNameForm', dlg).onsubmit = function (e) { e.preventDefault(); runName($('#pzQ', dlg).value); };

    var drop = $('#pzDrop', dlg), file = $('#pzFile', dlg);
    drop.onclick = function () { file.click(); };
    drop.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
    file.onchange = function () { if (file.files[0]) runFace(file.files[0]); file.value = ''; };
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) runFace(f); });

    $('#pzOut', dlg).addEventListener('click', onOutClick);
    return dlg;
  }

  function open() {
    ensureDialog();
    if (!dlg.open) dlg.showModal();
    setTimeout(function () { var q = $('#pzQ', dlg); if (q && !q.closest('[hidden]')) q.focus(); }, 80);
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#presenceOpen')) open(); });
  if (location.hash === '#presence') open();

  /* ---------- مساعدات العرض ---------- */
  function setStatus(t) { var s = $('#pzStatus', dlg); if (s) s.innerHTML = '<span class="pz-dots"><i></i><i></i><i></i></span>' + esc(t); }
  function setBar(p) { var b = $('#pzBar', dlg); if (b) b.style.width = Math.max(0, Math.min(100, p)) + '%'; }
  function member(id) { return (DATA.members || []).filter(function (m) { return m.id === id; })[0]; }

  function conf(d) { return d < 0.38 ? 'تطابق عالٍ جداً' : d < 0.45 ? 'تطابق عالٍ' : 'تطابق محتمل'; }

  function photoBtn(s, i) {
    return '<button class="pz-ph" data-k="' + esc(s.k) + '" style="--i:' + i + '"><img src="' + s.src + '" alt="' + esc(s.caption || s.label) + '" loading="lazy"><small>' + esc(s.caption && s.t === 'g' ? s.caption : s.label) + '</small></button>';
  }
  function uniq(list) { var seen = {}; return list.filter(function (s) { if (seen[s.k]) return false; seen[s.k] = 1; return true; }); }

  function photosForMember(m, items) {
    var own = sources(DATA).filter(function (s) { return s.t === 'g' && s.m === m.id; });
    var found = [];
    if (items) {
      var me = items.filter(function (it) { return it.s.k === 'p:' + m.id && it.f.length; })[0];
      if (me) found = matchFace(me.f[0], items).filter(function (r) { return r.s.t !== 'p'; }).map(function (r) { return r.s; });
    }
    return uniq(found.concat(own));
  }

  function shareBar(m) {
    var url = m ? memberUrl(m.id) : ((DATA.settings.siteUrl || '').trim() || (location.origin + location.pathname.replace(/[^\/]*$/, '')));
    var text = 'ألبومي في فريق مصادر التعلم';
    var h = '<div class="pz-share" data-url="' + esc(url) + '" data-text="' + esc(text) + '"><span>شارك ألبومي:</span>';
    if (navigator.share) h += '<button data-sh="native">مشاركة</button>';
    h += '<button data-sh="wa">واتساب</button><button data-sh="x">إكس</button><button data-sh="copy">نسخ الرابط</button></div>';
    return h;
  }

  function personBlock(m, photos, c) {
    return '<article class="pz-person"><img src="' + avatar(m) + '" alt=""><div class="pz-pi"><b>' + esc(m.name) + '</b><span>' + esc(m.role || '') + ' — ' + esc(LEVELS[m.level] || '') + '</span>' +
      '<a href="member.html?id=' + encodeURIComponent(m.id) + '">صفحتي الشخصية</a></div>' + (c ? '<em class="pz-conf">' + esc(c) + '</em>' : '') + '</article>' +
      (photos.length ? '<div class="pz-count"><b>' + photos.length + '</b> صورة وجدناها لك</div><div class="pz-gal">' + photos.map(photoBtn).join('') + '</div>' : '<p class="pz-empty">لا توجد صور مرفوعة لهذا العضو بعد.</p>') +
      shareBar(m);
  }

  /* ---------- البحث بالاسم ---------- */
  function runName(q) {
    var out = $('#pzOut', dlg);
    var r = nameSearch(DATA, q);
    if (!r) { out.innerHTML = '<p class="pz-empty">اكتب اسماً للبحث.</p>'; return; }
    if (!r.members.length && !r.news.length && !r.photos.length) {
      out.innerHTML = '<p class="pz-empty">ما لقينا نتيجة لـ «' + esc(q) + '». جرّب جزءاً آخر من الاسم، أو ابحث بصورتك.</p>'; return;
    }
    var items = getIndex(DATA), h = '';
    r.members.slice(0, 5).forEach(function (m) { h += '<section class="pz-res">' + personBlock(m, photosForMember(m, items), '') + '</section>'; });
    if (r.photos.length) h += '<section class="pz-res"><div class="pz-count">صور وُصفت بهذا الاسم</div><div class="pz-gal">' + r.photos.map(photoBtn).join('') + '</div></section>';
    if (r.news.length) h += '<section class="pz-res"><div class="pz-count">ورد في الأخبار والفعاليات</div>' + r.news.map(function (n) {
      return '<a class="pz-news" href="index.html#news"><b>' + esc(n.title) + '</b><small>' + esc(CATS[n.cat] || '') + ' — ' + esc(fmtDate(n.date)) + '</small></a>';
    }).join('') + '</section>';
    out.innerHTML = h;
  }

  /* ---------- البحث بالصورة ---------- */
  function shrink(file, max) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onerror = function () { rej(new Error('تعذّر قراءة الملف')); };
      fr.onload = function () {
        var im = new Image();
        im.onerror = function () { rej(new Error('الملف ليس صورة صالحة')); };
        im.onload = function () {
          var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
          c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.9));
        };
        im.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }

  function drawBoxes() {
    var wrap = $('#pzBoxes', dlg), W = st.im.naturalWidth, H = st.im.naturalHeight;
    wrap.innerHTML = st.faces.map(function (f, i) {
      var b = f.detection.box;
      return '<button type="button" class="pz-face' + (i === st.pick ? ' on' : '') + '" data-f="' + i + '" aria-label="الوجه ' + (i + 1) + '" style="left:' + (b.x / W * 100) + '%;top:' + (b.y / H * 100) + '%;width:' + (b.width / W * 100) + '%;height:' + (b.height / H * 100) + '%;--d:' + (i * 120) + 'ms">' + (st.faces.length > 1 ? '<span>' + (i + 1) + '</span>' : '') + '</button>';
    }).join('');
  }

  async function runFace(file) {
    if (st.busy) return;
    st.busy = true;
    var out = $('#pzOut', dlg), stage = $('#pzStage', dlg);
    out.innerHTML = ''; stage.hidden = false; stage.className = 'pz-stage scanning'; $('#pzBoxes', dlg).innerHTML = ''; setBar(4);
    try {
      var url = await shrink(file, 900);
      $('#pzImg', dlg).src = url;
      st.im = await loadImg(url);
      await loadAI(setStatus); setBar(30);
      setStatus('الذكاء الاصطناعي يحلّل ملامح الوجه…');
      var faces = await detect(st.im);
      faces.sort(function (a, b) { return area(b) - area(a); });
      st.faces = faces; st.pick = 0;
      if (!faces.length) {
        stage.classList.remove('scanning'); setBar(0);
        $('#pzStatus', dlg).textContent = '';
        out.innerHTML = '<p class="pz-empty">ما قدرنا نكتشف وجهاً واضحاً. جرّب صورة أمامية بإضاءة جيدة وبدون نظارة شمسية.</p>';
        st.busy = false; return;
      }
      drawBoxes(); setBar(45);
      await searchWith(faces[0].descriptor);
    } catch (e) {
      stage.classList.remove('scanning'); $('#pzStatus', dlg).textContent = '';
      out.innerHTML = '<p class="pz-empty">' + esc(e.message || 'حدث خطأ غير متوقع') + '</p>';
    }
    st.busy = false;
  }

  async function searchWith(desc) {
    var out = $('#pzOut', dlg), stage = $('#pzStage', dlg);
    stage.classList.add('scanning'); out.innerHTML = '';
    var items = getIndex(DATA), usedLive = false;
    if (!items) {
      usedLive = true;
      setStatus('لا يوجد فهرس جاهز، سنمسح صور الموقع الآن (قد يستغرق وقتاً)…');
      items = await liveItems(DATA, function (i, n) { setBar(45 + 50 * i / n); setStatus('مسح الصور ' + i + ' / ' + n + '…'); });
    }
    var total = items.length;
    setStatus('مطابقة وجهك مع ' + total + ' صورة…'); setBar(96);
    if (!reduce) await sleep(700);
    var res = matchFace(desc, items);
    setBar(100);
    stage.classList.remove('scanning'); stage.classList.add('done');
    $('#pzStatus', dlg).textContent = '';

    var idRes = res.filter(function (r) { return r.s.t === 'p' && r.d < TH_ID; })[0];
    var who = idRes ? member(idRes.s.m) : null;
    var photos = res.filter(function (r) { return r.s.t !== 'p'; }).map(function (r) { return r.s; });

    if (who) {
      photos = uniq(photos.concat(sources(DATA).filter(function (s) { return s.t === 'g' && s.m === who.id; })));
      out.innerHTML = '<section class="pz-res">' + personBlock(who, photos, conf(idRes.d)) + '</section>';
    } else if (photos.length) {
      out.innerHTML = '<section class="pz-res"><div class="pz-count"><b>' + photos.length + '</b> صورة ظهر فيها وجه مشابه لوجهك</div><div class="pz-gal">' + photos.map(photoBtn).join('') + '</div>' + shareBar(null) + '</section>';
    } else {
      out.innerHTML = '<p class="pz-empty">ما لقينا لك صوراً حتى الآن. ربما لم تُرفع صورك بعد، أو يحتاج الفهرس إلى تحديث من قائد الفريق.</p>';
    }
    if (usedLive) out.innerHTML += '<p class="pz-note">ملاحظة: تم المسح مباشرة. يمكن لقائد الفريق بناء «فهرس الوجوه» من لوحة التحكم لتصبح النتائج فورية.</p>';
  }

  /* ---------- أحداث النتائج ---------- */
  function onOutClick(e) {
    var ph = e.target.closest('.pz-ph');
    if (ph) {
      var s = sources(DATA).filter(function (x) { return x.k === ph.dataset.k; })[0]; if (!s) return;
      var lb = $('#pzLb', dlg);
      lb.innerHTML = '<img src="' + s.src + '" alt="' + esc(s.caption || '') + '"><p>' + esc(s.caption || s.label) + '</p><button type="button" class="btn ghost sm">إغلاق</button>';
      lb.hidden = false;
      lb.onclick = function (ev) { if (ev.target === lb || ev.target.tagName === 'BUTTON') lb.hidden = true; };
      return;
    }
    var sh = e.target.closest('[data-sh]');
    if (sh) {
      var box = sh.closest('.pz-share'), url = box.dataset.url, text = box.dataset.text, t = sh.dataset.sh;
      if (t === 'native') navigator.share({ title: text, text: text, url: url }).catch(function () {});
      else if (t === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n' + url), '_blank', 'noopener');
      else if (t === 'x') window.open('https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url), '_blank', 'noopener');
      else if (t === 'copy') {
        var done = function () { sh.textContent = 'تم النسخ ✓'; setTimeout(function () { sh.textContent = 'نسخ الرابط'; }, 1800); };
        if (navigator.clipboard) navigator.clipboard.writeText(url).then(done); else { prompt('انسخ الرابط:', url); }
      }
    }
  }

  /* اختيار وجه آخر من الصورة عند وجود أكثر من وجه */
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('.pz-face');
    if (!f || !dlg || st.busy) return;
    st.pick = +f.dataset.f; drawBoxes();
    st.busy = true;
    searchWith(st.faces[st.pick].descriptor).catch(function (er) { $('#pzOut', dlg).innerHTML = '<p class="pz-empty">' + esc(er.message) + '</p>'; }).then(function () { st.busy = false; });
  });
})();
