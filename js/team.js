chrome('team');
function card(m) {
  return '<a class="mcard ' + m.level + '" href="member.html?id=' + encodeURIComponent(m.id) + '">' +
    '<img src="' + avatar(m) + '" alt="' + esc(m.name) + '" loading="lazy"><b>' + esc(m.name) + '</b><span>' + esc(m.role) + '</span></a>';
}
function by(l) { return DATA.members.filter(function (m) { return m.level === l; }); }
var rows = [
  [by('leader'), ''],
  [by('head').concat(by('deputy')), ''],
  [by('member'), 'الأعضاء']
].filter(function (r) { return r[0].length; });
document.getElementById('tree').innerHTML = rows.map(function (r) {
  return '<div class="level">' + (r[1] ? '<div class="level-label">' + r[1] + '</div>' : '') + r[0].map(card).join('') + '</div>';
}).join('') || '<p>لم تتم إضافة أعضاء بعد.</p>';
