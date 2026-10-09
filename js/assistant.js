/* مساعد تجريبي محلي: يطابق أسئلة قاعدة المعرفة على هذا الجهاز فقط. */
(function () {
  if (document.getElementById('assistantDock')) return;

  var dock = document.createElement('div');
  dock.className = 'assistant-dock';
  dock.id = 'assistantDock';
  dock.innerHTML =
    '<section class="assistant-panel" id="assistantPanel" aria-label="المساعد المدرسي التجريبي" hidden>' +
      '<div class="assistant-head"><div><b>المساعد المدرسي</b><small>نسخة تجريبية من قاعدة المعرفة المحلية</small></div><button class="assistant-close" type="button" data-chat-close aria-label="إغلاق">×</button></div>' +
      '<div class="assistant-log" id="assistantLog" role="log" aria-live="polite"><div class="assistant-message">أهلًا! أجاوب فقط من الأسئلة والأجوبة التي أُضيفت في لوحة التحكم على هذا الجهاز.</div></div>' +
      '<div class="assistant-suggestions" id="assistantSuggestions"></div>' +
      '<form class="assistant-form" id="assistantForm"><input id="assistantInput" maxlength="400" autocomplete="off" placeholder="اكتب سؤالك..." aria-label="اكتب سؤالك" required><button type="submit">إرسال</button></form>' +
      '<p class="assistant-note">تجريبي فقط: لا تُرسل الرسائل إلى نموذج ذكاء اصطناعي ولا تغادر المتصفح.</p>' +
    '</section>' +
    '<button class="assistant-launcher" type="button" data-chat-toggle aria-label="اسأل المساعد" aria-expanded="false" aria-controls="assistantPanel"><span aria-hidden="true">✦</span><span>اسأل المساعد</span></button>';
  document.body.appendChild(dock);

  var panel = dock.querySelector('#assistantPanel');
  var toggle = dock.querySelector('[data-chat-toggle]');
  var log = dock.querySelector('#assistantLog');
  var form = dock.querySelector('#assistantForm');
  var input = dock.querySelector('#assistantInput');
  var suggestions = dock.querySelector('#assistantSuggestions');

  function close() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
  }
  function readItems() {
    try {
      var value = JSON.parse(localStorage.getItem('mrk_knowledge_demo'));
      return Array.isArray(value) ? value.filter(function (item) {
        return item && typeof item.question === 'string' && typeof item.answer === 'string';
      }) : [];
    } catch (e) { return []; }
  }
  function normalize(value) {
    return String(value || '').toLowerCase()
      .replace(/[ًٌٍَُِّْـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .trim();
  }
  var stopWords = { 'ما': 1, 'ماذا': 1, 'هل': 1, 'كيف': 1, 'متى': 1, 'وين': 1, 'في': 1, 'عن': 1, 'على': 1, 'من': 1, 'الى': 1, 'و': 1, 'او': 1, 'ابي': 1, 'اريد': 1, 'لو': 1, 'سمحت': 1, 'ممكن': 1 };
  function words(value) {
    return normalize(value).split(/\s+/).filter(function (word) {
      return word.length > 1 && !stopWords[word];
    });
  }
  function bestAnswer(question, items) {
    var queryWords = words(question);
    if (!queryWords.length) return null;
    var best = null, bestScore = 0;
    items.forEach(function (item) {
      var questionWords = words(item.question);
      var answerWords = words(item.answer);
      var matches = queryWords.filter(function (word) {
        return questionWords.some(function (candidate) { return candidate.indexOf(word) !== -1 || word.indexOf(candidate) !== -1; }) ||
          answerWords.some(function (candidate) { return candidate.indexOf(word) !== -1; });
      }).length;
      var score = matches / queryWords.length;
      if (score > bestScore) { bestScore = score; best = item; }
    });
    return bestScore >= .34 ? best : null;
  }
  function addMessage(text, type) {
    var node = document.createElement('div');
    node.className = 'assistant-message' + (type === 'user' ? ' user' : '');
    node.textContent = text;
    log.appendChild(node);
    log.scrollTop = log.scrollHeight;
  }
  function refreshSuggestions() {
    suggestions.innerHTML = '';
    readItems().slice(0, 3).forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.question;
      button.addEventListener('click', function () {
        input.value = item.question;
        form.requestSubmit();
      });
      suggestions.appendChild(button);
    });
  }

  toggle.addEventListener('click', function () { panel.hidden ? open() : close(); });
  dock.querySelector('[data-chat-close]').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  document.querySelectorAll('[data-assistant-open]').forEach(function (button) { button.addEventListener('click', open); });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var question = input.value.trim();
    if (!question) return;
    addMessage(question, 'user');
    input.value = '';
    var items = readItems();
    var result = items.length ? bestAnswer(question, items) : null;
    window.setTimeout(function () {
      if (!items.length) {
        addMessage('قاعدة المعرفة التجريبية فارغة. أضف سؤالًا وجوابًا من لوحة التحكم على هذا الجهاز أولًا.');
      } else if (result) {
        addMessage(result.answer);
      } else {
        addMessage('ما لقيت إجابة موثقة لهذا السؤال في قاعدة المعرفة التجريبية. اسأل إدارة الفريق أو أضف سؤالًا معتمدًا من لوحة التحكم.');
      }
      refreshSuggestions();
    }, 160);
  });
  refreshSuggestions();
})();
