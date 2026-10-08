chrome('home');
document.getElementById('aboutText').textContent = DATA.settings.about;

var cat = 'latest', idx = 0, timer = null;
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
      '<div class="dots">' + list.map(function (_, i) { return '<button aria-label="شريحة ' + (i + 1) + '" data-i="' + i + '"' + (i === idx ? ' aria-current="true"' : '') + '></button>'; }).join('') + '</div>' : '');
}

function go(d) {
  var n = slidesOf(cat).length;
  if (!n) return;
  idx = (idx + d + n) % n;
  renderSlider();
}
function play() {
  clearInterval(timer);
  if (reduce) return;
  timer = setInterval(function () { go(1); }, 6500);
}

tabsEl.addEventListener('click', function (e) {
  var b = e.target.closest('button[data-cat]');
  if (!b) return;
  cat = b.dataset.cat; idx = 0;
  renderTabs(); renderSlider(); play();
});
sliderEl.addEventListener('click', function (e) {
  if (e.target.closest('.prev')) { go(-1); play(); }
  else if (e.target.closest('.next')) { go(1); play(); }
  else if (e.target.dataset.i) { idx = +e.target.dataset.i; renderSlider(); play(); }
});
sliderEl.addEventListener('mouseenter', function () { clearInterval(timer); });
sliderEl.addEventListener('mouseleave', play);

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
