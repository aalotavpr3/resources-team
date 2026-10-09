chrome('team');
var id = new URLSearchParams(location.search).get('id');
var m = DATA.members.filter(function (x) { return x.id === id; })[0];
var main = document.getElementById('main');

if (!m) {
  main.innerHTML = '<div class="sec"><h2>لم يتم العثور على العضو</h2><p>قد يكون الرابط غير صحيح أو أن العضو لم يعد ضمن الفريق.</p><a class="btn" href="team.html">العودة لصفحة الفريق</a></div>';
} else {
  document.title = m.name;
  var g = (m.gallery || []);
  main.innerHTML =
    '<div class="profile"><div>' +
    '<div class="p-head"><img src="' + avatar(m) + '" alt="' + esc(m.name) + '"><div><span class="badge">' + esc(LEVELS[m.level] || '') + '</span><h1>' + esc(m.name) + '</h1><div>' + esc(m.role) + '</div></div></div>' +
    '<h2>نبذة تعريفية</h2><p>' + esc(m.bio).replace(/\n/g, '<br>') + '</p>' +
    ((m.skills || []).length ? '<h2>المهارات</h2><div class="chips">' + m.skills.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('') + '</div>' : '') +
    '<h2>معرض الأعمال والمشاركات</h2>' +
    (g.length ? '<div class="gallery">' + g.map(function (x, i) {
      return '<button data-i="' + i + '"><img src="' + x.src + '" alt="' + esc(x.caption || 'صورة من أعمال العضو') + '" loading="lazy"><small>' + esc(x.caption || '') + '</small></button>';
    }).join('') + '</div>' : '<p style="color:var(--muted)">لم تتم إضافة صور بعد.</p>') +
    '<p style="margin-top:30px"><a class="btn ghost" href="team.html">← العودة لفريقنا</a></p></div>' +
    '<aside><div class="idcard" id="card">' +
    '<div class="top"><span>بطاقة عضوية معتمدة</span><img src="assets/logo.jpg" alt=""></div>' +
    '<img class="ph" src="' + avatar(m) + '" alt=""><h3>' + esc(m.name) + '</h3><div class="r">' + esc(m.role) + '</div>' +
    '<div class="qr" id="qr"></div>' +
    '<div class="no">MRK-' + esc(m.id.toUpperCase()) + '</div>' +
    '<div class="note">امسح الرمز للتحقق من أصالة البطاقة</div></div>' +
    '</aside></div>';

  try {
    new QRCode(document.getElementById('qr'), { text: memberUrl(m.id), width: 140, height: 140, correctLevel: QRCode.CorrectLevel.M });
  } catch (e) {
    document.getElementById('qr').textContent = 'تعذّر تحميل مولّد QR (تحقق من الاتصال بالإنترنت).';
  }
  if (location.hash === '#card') document.getElementById('card').scrollIntoView();

  main.addEventListener('click', function (e) {
    var b = e.target.closest('.gallery button');
    if (!b) return;
    var x = g[+b.dataset.i], d = document.getElementById('dlg');
    d.innerHTML = '<img src="' + x.src + '" alt="' + esc(x.caption || '') + '"><div style="padding:12px 18px">' + esc(x.caption || '') + ' <button class="btn ghost sm" id="lbClose">إغلاق</button></div>';
    d.querySelector('#lbClose').onclick = function () { d.close(); };
    d.onclick = function (ev) { if (ev.target === d) d.close(); };
    d.showModal();
  });
}
