chrome('');
var app = document.getElementById('app');
var D = DATA, tab = 'members';
var $ = function (s, r) { return (r || document).querySelector(s); };

function toast(t) {
  var e = document.createElement('div'); e.className = 'toast'; e.textContent = t;
  document.body.appendChild(e); setTimeout(function () { e.remove(); }, 2600);
}
function save() {
  D.updated = Date.now();
  try { localStorage.setItem('mrk_data', JSON.stringify(D)); toast('تم الحفظ على هذا الجهاز ✓'); }
  catch (e) { toast('المساحة ممتلئة: قلّل عدد الصور أو حجمها'); }
}
function uid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 4); }

// ضغط الصور قبل حفظها لتبقى خفيفة
function fileToData(file, max) {
  return new Promise(function (res, rej) {
    var r = new FileReader();
    r.onload = function () {
      var im = new Image();
      im.onload = function () {
        var k = Math.min(1, max / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      im.onerror = rej; im.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------- الدخول ---------- */
function login() {
  app.innerHTML = '<div class="login"><h2>لوحة التحكم</h2><form class="f" id="lf"><label>كلمة المرور<input type="password" id="pw" autocomplete="current-password" autofocus></label><button class="btn">دخول</button></form></div>';
  $('#lf').onsubmit = function (e) {
    e.preventDefault();
    if ($('#pw').value === D.settings.adminPassword) { sessionStorage.setItem('mrk_admin', '1'); shell(); }
    else toast('كلمة المرور غير صحيحة');
  };
}

/* ---------- الهيكل ---------- */
function shell() {
  var T = [['members', 'الأعضاء'], ['news', 'الأخبار والإنجازات'], ['settings', 'إعدادات الموقع'], ['faces', 'فهرس الوجوه'], ['publish', 'النشر']];
  app.innerHTML = '<h1>لوحة التحكم</h1><div class="adm-tabs" role="tablist">' + T.map(function (t) {
    return '<button role="tab" data-t="' + t[0] + '" aria-selected="' + (t[0] === tab) + '">' + t[1] + '</button>';
  }).join('') + '</div><div id="view"></div>';
  $('.adm-tabs').onclick = function (e) { var b = e.target.closest('button'); if (b) { tab = b.dataset.t; shell(); } };
  ({ members: viewMembers, news: viewNews, settings: viewSettings, faces: viewFaces, publish: viewPublish })[tab]();
}

/* ---------- الأعضاء ---------- */
function viewMembers() {
  $('#view').innerHTML = '<p><button class="btn" id="add">+ إضافة عضو</button></p>' +
    D.members.map(function (m, i) {
      return '<div class="row" data-i="' + i + '"><img src="' + avatar(m) + '" alt=""><div class="grow"><b>' + esc(m.name) + '</b><small>' + esc(m.role) + ' — ' + LEVELS[m.level] + '</small></div>' +
        '<button class="btn sm ghost" data-a="up">↑</button><button class="btn sm ghost" data-a="down">↓</button>' +
        '<button class="btn sm" data-a="edit">تعديل</button><a class="btn sm ghost" target="_blank" href="member.html?id=' + encodeURIComponent(m.id) + '#card">بطاقة QR</a>' +
        '<button class="btn sm danger" data-a="del">حذف</button></div>';
    }).join('');
  $('#add').onclick = function () { editMember(null); };
  $('#view').onclick = function (e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var i = +b.closest('.row').dataset.i, a = b.dataset.a;
    if (a === 'edit') editMember(i);
    else if (a === 'del') { if (confirm('حذف "' + D.members[i].name + '" نهائياً؟')) { D.members.splice(i, 1); save(); viewMembers(); } }
    else {
      var j = a === 'up' ? i - 1 : i + 1;
      if (j >= 0 && j < D.members.length) { var t = D.members[i]; D.members[i] = D.members[j]; D.members[j] = t; save(); viewMembers(); }
    }
  };
}

function editMember(i) {
  var m = i == null ? { id: uid('m'), name: '', role: 'عضو', level: 'member', photo: '', bio: '', skills: [], gallery: [] } : JSON.parse(JSON.stringify(D.members[i]));
  var d = $('#dlg');
  function draw() {
    d.innerHTML = '<div class="dlg-in"><h2>' + (i == null ? 'إضافة عضو' : 'تعديل عضو') + '</h2><form class="f" id="mf">' +
      '<div class="two"><label>الاسم<input id="f_name" required value="' + esc(m.name) + '"></label><label>الصفة / الدور<input id="f_role" value="' + esc(m.role) + '"></label></div>' +
      '<label>الموقع في الهيكل<select id="f_level">' + Object.keys(LEVELS).map(function (k) { return '<option value="' + k + '"' + (m.level === k ? ' selected' : '') + '>' + LEVELS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label>النبذة التعريفية<textarea id="f_bio">' + esc(m.bio) + '</textarea></label>' +
      '<label>المهارات (افصل بينها بفاصلة ،)<input id="f_skills" value="' + esc((m.skills || []).join('، ')) + '"></label>' +
      '<label>الصورة الشخصية<input type="file" id="f_photo" accept="image/*"></label>' +
      (m.photo ? '<div class="thumbs"><div class="t"><img src="' + m.photo + '" alt=""><button type="button" class="btn sm danger" id="rmPhoto">إزالة</button></div></div>' : '') +
      '<label>صور المعرض (يمكن اختيار عدة صور)<input type="file" id="f_gal" accept="image/*" multiple></label>' +
      '<div class="thumbs">' + (m.gallery || []).map(function (x, k) {
        return '<div class="t"><img src="' + x.src + '" alt=""><input data-cap="' + k + '" placeholder="وصف الصورة" value="' + esc(x.caption || '') + '"><button type="button" class="btn sm danger" data-rg="' + k + '">حذف</button></div>';
      }).join('') + '</div>' +
      '<div><button class="btn">حفظ</button> <button type="button" class="btn ghost" id="cancel">إلغاء</button></div></form></div>';
    $('#cancel', d).onclick = function () { d.close(); };
    var rp = $('#rmPhoto', d); if (rp) rp.onclick = function () { grab(); m.photo = ''; draw(); };
    d.querySelectorAll('[data-rg]').forEach(function (b) { b.onclick = function () { grab(); m.gallery.splice(+b.dataset.rg, 1); draw(); }; });
    $('#f_photo', d).onchange = function (e) { var f = e.target.files[0]; if (!f) return; grab(); fileToData(f, 500).then(function (u) { m.photo = u; draw(); }); };
    $('#f_gal', d).onchange = function (e) {
      var fs = Array.prototype.slice.call(e.target.files); if (!fs.length) return; grab();
      Promise.all(fs.map(function (f) { return fileToData(f, 900); })).then(function (us) { us.forEach(function (u) { m.gallery.push({ src: u, caption: '' }); }); draw(); });
    };
    $('#mf', d).onsubmit = function (e) {
      e.preventDefault(); grab();
      if (i == null) D.members.push(m); else D.members[i] = m;
      save(); d.close(); viewMembers();
    };
  }
  function grab() {
    m.name = $('#f_name', d).value.trim(); m.role = $('#f_role', d).value.trim();
    m.level = $('#f_level', d).value; m.bio = $('#f_bio', d).value;
    m.skills = $('#f_skills', d).value.split(/[,،]/).map(function (s) { return s.trim(); }).filter(Boolean);
    d.querySelectorAll('[data-cap]').forEach(function (inp) { m.gallery[+inp.dataset.cap].caption = inp.value; });
  }
  draw(); d.showModal();
}

/* ---------- الأخبار ---------- */
function viewNews() {
  var list = D.news.map(function (n, i) { return { n: n, i: i }; }).sort(function (a, b) { return (b.n.date || '').localeCompare(a.n.date || ''); });
  $('#view').innerHTML = '<p><button class="btn" id="add">+ إضافة خبر أو إنجاز</button></p>' + list.map(function (o) {
    return '<div class="row" data-i="' + o.i + '"><div class="grow"><b>' + esc(o.n.title) + '</b><small>' + CATS[o.n.cat] + ' — ' + fmtDate(o.n.date) + '</small></div>' +
      '<button class="btn sm" data-a="edit">تعديل</button><button class="btn sm danger" data-a="del">حذف</button></div>';
  }).join('');
  $('#add').onclick = function () { editNews(null); };
  $('#view').onclick = function (e) {
    var b = e.target.closest('button[data-a]'); if (!b) return;
    var i = +b.closest('.row').dataset.i;
    if (b.dataset.a === 'edit') editNews(i);
    else if (confirm('حذف هذا العنصر؟')) { D.news.splice(i, 1); save(); viewNews(); }
  };
}
function editNews(i) {
  var n = i == null ? { id: uid('n'), cat: 'latest', title: '', text: '', date: new Date().toISOString().slice(0, 10), image: '' } : JSON.parse(JSON.stringify(D.news[i]));
  var d = $('#dlg');
  function draw() {
    d.innerHTML = '<div class="dlg-in"><h2>' + (i == null ? 'إضافة' : 'تعديل') + '</h2><form class="f" id="nf">' +
      '<label>العنوان<input id="n_title" required value="' + esc(n.title) + '"></label>' +
      '<div class="two"><label>القسم<select id="n_cat">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (n.cat === k ? ' selected' : '') + '>' + CATS[k] + '</option>'; }).join('') + '</select></label>' +
      '<label>التاريخ<input type="date" id="n_date" value="' + esc(n.date) + '"></label></div>' +
      '<label>النص<textarea id="n_text">' + esc(n.text) + '</textarea></label>' +
      '<label>صورة (اختياري)<input type="file" id="n_img" accept="image/*"></label>' +
      (n.image ? '<div class="thumbs"><div class="t"><img src="' + n.image + '" alt=""><button type="button" class="btn sm danger" id="rmImg">إزالة</button></div></div>' : '') +
      '<div><button class="btn">حفظ</button> <button type="button" class="btn ghost" id="cancel">إلغاء</button></div></form></div>';
    $('#cancel', d).onclick = function () { d.close(); };
    var r = $('#rmImg', d); if (r) r.onclick = function () { grab(); n.image = ''; draw(); };
    $('#n_img', d).onchange = function (e) { var f = e.target.files[0]; if (!f) return; grab(); fileToData(f, 1200).then(function (u) { n.image = u; draw(); }); };
    $('#nf', d).onsubmit = function (e) {
      e.preventDefault(); grab();
      if (i == null) D.news.push(n); else D.news[i] = n;
      save(); d.close(); viewNews();
    };
  }
  function grab() { n.title = $('#n_title', d).value.trim(); n.cat = $('#n_cat', d).value; n.date = $('#n_date', d).value; n.text = $('#n_text', d).value; }
  draw(); d.showModal();
}

/* ---------- الإعدادات ---------- */
function viewSettings() {
  var s = D.settings;
  var F = [['teamName', 'اسم الفريق'], ['schoolName', 'اسم المدرسة'], ['siteUrl', 'رابط الموقع النهائي (مهم لرمز QR) مثال: https://name.github.io/site'],
    ['adminPassword', 'كلمة مرور لوحة التحكم'], ['whatsapp', 'رقم واتساب (مع رمز الدولة، مثال 973XXXXXXXX)'], ['instagram', 'رابط إنستغرام'],
    ['x', 'رابط إكس (تويتر)'], ['tiktok', 'رابط تيك توك'], ['email', 'البريد الإلكتروني']];
  $('#view').innerHTML = '<form class="f" id="sf">' + F.map(function (f) {
    return '<label>' + f[1] + '<input data-k="' + f[0] + '" value="' + esc(s[f[0]]) + '"></label>';
  }).join('') + '<label>نبذة عن الفريق<textarea data-k="about">' + esc(s.about) + '</textarea></label><div><button class="btn">حفظ الإعدادات</button></div></form>';
  $('#sf').onsubmit = function (e) {
    e.preventDefault();
    document.querySelectorAll('#sf [data-k]').forEach(function (el) { s[el.dataset.k] = el.value.trim(); });
    save();
  };
}

/* ---------- النشر ---------- */
function viewPublish() {
  $('#view').innerHTML =
    '<div class="note-box"><b>لماذا هذه الخطوة؟</b><p style="margin:.3em 0 0">كل تعديلاتك تُحفظ تلقائياً على هذا الجهاز فقط، فتظهر لك أنت. لتظهر لجميع الزوّار: صدّر الملف ثم ارفعه إلى GitHub بدل الملف القديم.</p></div>' +
    '<div class="note-box"><ol><li>اضغط «تصدير data.js» وسيُحمَّل الملف.</li><li>افتح مستودع الموقع في GitHub ← اضغط على ملف <b>data.js</b> ← أيقونة القلم ← الصق المحتوى (أو Add file ← Upload files وارفع الملف بنفس الاسم).</li><li>اضغط Commit، وبعد دقيقة يتحدّث الموقع للجميع.</li></ol></div>' +
    '<p><button class="btn" id="exp">تصدير data.js</button> <button class="btn danger" id="rst">التراجع عن تعديلات هذا الجهاز</button> <button class="btn ghost" id="out">تسجيل الخروج</button></p>';
  $('#exp').onclick = function () {
    D.updated = Date.now();
    var blob = new Blob(['window.SITE_DEFAULT = ' + JSON.stringify(D, null, 1) + ';\n'], { type: 'text/javascript' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'data.js'; a.click();
  };
  $('#rst').onclick = function () { if (confirm('سيتم مسح التعديلات المحفوظة على هذا الجهاز والعودة لمحتوى data.js المنشور. متأكد؟')) { localStorage.removeItem('mrk_data'); location.reload(); } };
  $('#out').onclick = function () { sessionStorage.removeItem('mrk_admin'); login(); };
}

/* ---------- فهرس الوجوه (ميزة ابحث عن وجودك) ---------- */
function viewFaces() {
  var P = window.PresenceAI;
  var st = P ? P.stats(D) : null;
  var built = st && st.built ? new Date(st.built).toLocaleString('ar-BH') : 'لم يُبنَ بعد';
  $('#view').innerHTML =
    '<div class="note-box"><b>ما هو فهرس الوجوه؟</b><p style="margin:.3em 0 0">لتعمل ميزة «ابحث عن وجودك» بسرعة، يقرأ الذكاء الاصطناعي كل صور الموقع (الصور الشخصية، معارض الأعضاء، صور الأخبار) ويحفظ بصمة رقمية لكل وجه. لا تُحفظ صور جديدة، ولا يمكن إعادة بناء الوجه من البصمة.</p></div>' +
    '<div class="note-box"><ol><li>اضغط «بناء الفهرس» وانتظر حتى ينتهي (يعمل على جهازك).</li><li>من تبويب «النشر» اضغط «تصدير data.js» وارفعه إلى GitHub.</li><li>أعد بناء الفهرس كلما أضفت أو غيّرت صوراً.</li></ol></div>' +
    (st ? '<div class="note-box"><b>الحالة:</b><p style="margin:.3em 0 0">الصور في الموقع: <b>' + st.photos + '</b> — المفهرسة: <b>' + st.indexed + '</b> — الوجوه المكتشفة: <b>' + st.faces + '</b> — صور تحتاج تحديثاً: <b>' + st.stale + '</b><br>آخر بناء: ' + built + '</p></div>' : '<div class="note-box">جارٍ تحميل الميزة… أعد فتح هذا التبويب بعد ثوانٍ.</div>') +
    '<p><button class="btn" id="fbuild">بناء / تحديث الفهرس</button> <button class="btn danger" id="fdel">حذف الفهرس</button></p>' +
    '<div class="pz-status" id="fst"></div><div class="pz-bar"><i id="fbar"></i></div>';
  $('#fdel').onclick = function () {
    if (!D.faceIndex) return toast('لا يوجد فهرس');
    if (confirm('حذف فهرس الوجوه؟ سيعمل البحث بالصورة بمسح مباشر أبطأ حتى تعيد بناءه.')) { delete D.faceIndex; save(); viewFaces(); }
  };
  $('#fbuild').onclick = function () {
    if (!P) return toast('الميزة لم تُحمَّل بعد، حاول بعد ثوانٍ');
    var btn = this; btn.disabled = true;
    P.buildIndex(D, function (p) {
      if (p.status) $('#fst').textContent = p.status;
      if (p.n) { $('#fst').textContent = 'تحليل الصورة ' + p.i + ' من ' + p.n + ' — وجوه مكتشفة: ' + p.faces; $('#fbar').style.width = (p.i / p.n * 100) + '%'; }
    }).then(function (ix) { D.faceIndex = ix; save(); viewFaces(); })
      .catch(function (e) { toast(e.message || 'فشل بناء الفهرس'); btn.disabled = false; });
  };
}

if (sessionStorage.getItem('mrk_admin')) shell(); else login();
