chrome('home');
document.getElementById('aboutText').textContent = DATA.settings.about;

var cat = 'latest', idx = 0, timer = null, paused = false;
var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var tabsEl = document.getElementById('tabs'), sliderEl = document.getElementById('slider');

function sorted(list) {
  return list.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
}
function slidesOf(c) { return sorted(DATA.news.filter(function (n) { return n.cat === c; })); }

function bg(n) {
  if (!n.image) return '';
  return 'background-image:linear-gradient(270deg,rgba(11,37,69,.92),rgba(11,37,69,.3)),url(' + n.image + ')';
}

function renderTabs() {
  tabsEl.innerHTML = Object.keys(CATS).map(function (k) {
    return '<button role="tab" data-cat="' + k + '" aria-selected="' + (k === cat) + '">' + CATS[k] + '</button>';
  }).join('');
}

function renderSlider() {
  var list = slidesOf(cat);
  if (!list.length) {
    sliderEl.innerHTML = '<div class="empty">لا توجد عناصر في هذا القسم حالياً.</div>';
    return;
  }
  if (idx >= list.length) idx = 0;
  sliderEl.innerHTML =
    list.map(function (n, i) {
      return '<article class="slide' + (i === idx ? ' active' : '') + '" style="' + bg(n) + '" aria-hidden="' + (i !== idx) + '">' +
        '<div class="txt"><span class="tag">' + CATS[n.cat] + '</span><h2>' + esc(n.title) + '</h2><p>' + esc(n.text) + '</p><time>' + fmtDate(n.date) + '</time></div></article>';
    }).join('') +
    (list.length > 1 ? '<button class="arrow prev" aria-label="السابق">›</button><button class="arrow next" aria-label="التالي">‹</button>' +
      '<div class="dots">' + list.map(function (_, i) { return '<button aria-label="شريحة ' + (i + 1) + '" data-i="' + i + '"' + (i === idx ? ' aria-current="true"' : '') + '></button>'; }).join('') + '</div>' +
      '<button class="pause-slider" type="button" data-autoplay aria-pressed="' + paused + '">' + (paused ? 'استئناف العرض' : 'إيقاف العرض') + '</button>' : '');
}

function go(d) {
  var n = slidesOf(cat).length;
  if (!n) return;
  idx = (idx + d + n) % n;
  renderSlider();
}
function play() {
  clearInterval(timer);
  if (reduce || paused || document.hidden) return;
  timer = setInterval(function () { go(1); }, 6500);
}

tabsEl.addEventListener('click', function (e) {
  var b = e.target.closest('button[data-cat]');
  if (!b) return;
  cat = b.dataset.cat; idx = 0;
  renderTabs(); renderSlider(); play();
});
sliderEl.addEventListener('click', function (e) {
  if (e.target.closest('[data-autoplay]')) {
    paused = !paused;
    renderSlider();
    play();
  }
  else if (e.target.closest('.prev')) { go(-1); play(); }
  else if (e.target.closest('.next')) { go(1); play(); }
  else if (e.target.dataset.i) { idx = +e.target.dataset.i; renderSlider(); play(); }
});
sliderEl.addEventListener('mouseenter', function () { clearInterval(timer); });
sliderEl.addEventListener('mouseleave', play);
document.addEventListener('visibilitychange', function () { if (document.hidden) clearInterval(timer); else play(); });
var touchStartX = null;
sliderEl.addEventListener('pointerdown', function (e) {
  if (e.target.closest('button')) return;
  touchStartX = e.clientX;
});
sliderEl.addEventListener('pointerup', function (e) {
  if (touchStartX == null) return;
  var distance = e.clientX - touchStartX;
  touchStartX = null;
  if (Math.abs(distance) < 45) return;
  go(distance < 0 ? 1 : -1);
  play();
});
sliderEl.addEventListener('pointercancel', function () { touchStartX = null; });

renderTabs(); renderSlider(); play();

// شبكة الأخبار
var all = sorted(DATA.news);
document.getElementById('newsGrid').innerHTML = all.length ? all.map(function (n) {
  return '<button class="ncard" data-id="' + esc(n.id) + '">' +
    '<div class="pic"' + (n.image ? ' style="background-image:url(' + n.image + ')"' : '') + '></div>' +
    '<div class="body"><span class="cat">' + CATS[n.cat] + '</span><h3>' + esc(n.title) + '</h3><p>' + esc(n.text) + '</p><time>' + fmtDate(n.date) + '</time></div></button>';
}).join('') : '<p>لا توجد أخبار بعد.</p>';

document.getElementById('newsGrid').addEventListener('click', function (e) {
  var c = e.target.closest('.ncard');
  if (!c) return;
  var n = DATA.news.filter(function (x) { return x.id === c.dataset.id; })[0];
  if (!n) return;
  openDialog((n.image ? '<div class="pic" style="background-image:url(' + n.image + ')"></div>' : '') +
    '<span class="cat" style="color:#C8102E;font-weight:700">' + CATS[n.cat] + '</span><h2>' + esc(n.title) + '</h2><p>' + esc(n.text) + '</p><time>' + fmtDate(n.date) + '</time>');
});

// بحث فعلي في الأسماء والأخبار المنشورة فقط؛ لا يستخدم التعرف على الوجوه.
var eventSearch = document.getElementById('eventSearch');
var eventSearchResults = document.getElementById('eventSearchResults');
function normalizeSearch(value) {
  return String(value || '').toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
}
function searchCard(title, subtitle, href, image, label) {
  return '<a class="search-result" href="' + esc(href) + '">' +
    (image ? '<img src="' + esc(image) + '" alt="" loading="lazy">' : '<span class="search-result-mark" aria-hidden="true">✦</span>') +
    '<span class="search-result-copy"><small>' + esc(label) + '</small><b>' + esc(title) + '</b><span>' + esc(subtitle) + '</span></span>' +
    '<span class="service-arrow" aria-hidden="true">←</span></a>';
}
function renderEventSearch() {
  if (!eventSearch || !eventSearchResults) return;
  var query = normalizeSearch(eventSearch.value);
  if (!query) {
    eventSearchResults.innerHTML = '<p class="search-hint">ابدأ بالبحث لعرض النتائج من محتوى الموقع المنشور.</p>';
    return;
  }
  var tokens = query.split(/\s+/).filter(Boolean);
  function matches(value) {
    var text = normalizeSearch(value);
    return tokens.every(function (token) { return text.indexOf(token) !== -1; });
  }
  var newsMatches = sorted(DATA.news.filter(function (n) {
    return matches([n.title, n.text, CATS[n.cat]].join(' '));
  })).slice(0, 6);
  var memberMatches = DATA.members.filter(function (m) {
    return matches([m.name, m.role, m.bio, (m.skills || []).join(' ')].join(' '));
  }).slice(0, 6);
  var cards = newsMatches.map(function (n) {
    return searchCard(n.title, fmtDate(n.date), '#news', n.image || '', CATS[n.cat] || 'خبر');
  }).concat(memberMatches.map(function (m) {
    return searchCard(m.name, m.role, 'member.html?id=' + encodeURIComponent(m.id), avatar(m), 'عضو في الفريق');
  }));
  eventSearchResults.innerHTML = cards.length ?
    '<div class="search-result-grid">' + cards.join('') + '</div>' :
    '<p class="search-hint">ما لقينا نتيجة مطابقة. جرّب كلمة أقصر أو اسمًا مختلفًا.</p>';
}
if (eventSearch) eventSearch.addEventListener('input', renderEventSearch);
if (eventSearch) eventSearch.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { eventSearch.value = ''; renderEventSearch(); }
});
