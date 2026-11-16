/* Gym Tracker – standalone module, no dependencies.
 *
 *   const gym = GymTracker.mount(document.getElementById('gym'), {
 *     storageKey: 'mainquest.gym',            // optional
 *     storage: { get(key), set(key, value) },  // optional, defaults to localStorage
 *     onEvent(type, payload) {}                // 'workout:finish' | 'set:done' | 'pr'
 *   });
 *   gym.getStats(); gym.getState(); gym.destroy();
 *
 * The same events are dispatched on the mount element as CustomEvents
 * ("gymtracker:workout:finish" etc., payload in event.detail).
 */
(function (root) {
  'use strict';

  var ex = function (name, sets, reps, rest, bar) {
    return { id: uid(), name: name, sets: sets, reps: reps, rest: rest, bar: !!bar };
  };
  function defaultPlan() {
    return [
      { id: uid(), name: 'Push', exercises: [
        ex('Bankdrücken', 3, '6-10', 150, true), ex('Schrägbank Kurzhantel', 3, '8-12', 120),
        ex('Schulterdrücken', 3, '8-12', 120), ex('Seitheben', 3, '12-15', 75),
        ex('Trizepsdrücken Kabel', 3, '10-15', 75)] },
      { id: uid(), name: 'Pull', exercises: [
        ex('Klimmzüge', 3, '6-10', 150), ex('Langhantelrudern', 3, '8-10', 120, true),
        ex('Latzug', 3, '10-12', 105), ex('Face Pulls', 3, '12-15', 75),
        ex('Bizepscurls', 3, '10-12', 75)] },
      { id: uid(), name: 'Beine', exercises: [
        ex('Kniebeuge', 3, '6-10', 180, true), ex('Rumänisches Kreuzheben', 3, '8-10', 150, true),
        ex('Beinpresse', 3, '10-12', 120), ex('Beinbeuger', 3, '10-15', 90),
        ex('Wadenheben', 3, '12-15', 60)] }
    ];
  }

  var ICON = {
    home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    hist: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chart: '<svg viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 15l4-5 3 3 4-6"/></svg>',
    plan: '<svg viewBox="0 0 24 24"><path d="M2 12h2M20 12h2M6 7v10M18 7v10M6 12h12M9.5 9v6M14.5 9v6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z" fill="currentColor"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>'
  };
  var PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
  var DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  /* ---------- helpers ---------- */
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function num(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) && n >= 0 ? n : 0;
  }
  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString('de-DE'); }
  function fmtVol(kg) { return kg >= 10000 ? fmt(Math.round(kg / 100) / 10) + ' t' : fmt(Math.round(kg)) + ' kg'; }
  function key(name) { return String(name).trim().toLowerCase(); }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function weekStart(t) {
    var d = new Date(t); d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime();
  }
  function clock(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  // Epley estimate; bodyweight sets (0 kg) are scored by reps
  function score(set) { var w = num(set.w), r = num(set.r); return w > 0 ? (r > 1 ? w * (1 + r / 30) : w) : r; }
  function volume(session) {
    var v = 0;
    session.entries.forEach(function (e) { e.sets.forEach(function (s) { if (s.done) v += num(s.w) * num(s.r); }); });
    return v;
  }
  function doneSets(session) {
    var n = 0;
    session.entries.forEach(function (e) { e.sets.forEach(function (s) { if (s.done) n++; }); });
    return n;
  }
  function platesFor(w) {
    var side = (num(w) - 20) / 2, out = [];
    if (side <= 0) return out;
    PLATES.forEach(function (p) { while (side >= p - 1e-9) { out.push(p); side -= p; } });
    return out;
  }
  // Text → plan. Headings start a workout, "Name 3x8-12" lines add exercises.
  function parsePlan(text) {
    var plan = [], cur = null;
    String(text).split(/\r?\n/).forEach(function (raw) {
      var line = raw.replace(/[*_#`|]/g, ' ').trim();
      if (!line) return;
      var m = line.match(/^[-•–\s]*(?:\d+[.)]\s*)?(.+?)[\s:,–-]+(\d+)\s*[x×]\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
      if (m) {
        if (!cur) { cur = { id: uid(), name: 'Training ' + (plan.length + 1), exercises: [] }; plan.push(cur); }
        cur.exercises.push(ex(m[1].trim(), Math.min(10, +m[2] || 3), m[3].replace(/\s/g, '').replace('–', '-'), 120,
          /langhantel|bankdr|kniebeuge|kreuzheben|squat|bench|deadlift/i.test(m[1])));
      } else {
        cur = { id: uid(), name: line.replace(/[:\s]+$/, '').slice(0, 40), exercises: [] }; plan.push(cur);
      }
    });
    return plan.filter(function (w) { return w.exercises.length; });
  }

  /* ---------- mount ---------- */
  function mount(el, opts) {
    opts = opts || {};
    var KEY = opts.storageKey || 'gymtracker.v1';
    var store = opts.storage || {
      get: function (k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
    };
    var state = load();
    var ui = { tab: 'home', workoutOpen: !!state.active, open: {}, edit: null, progKey: null, sheet: null, summary: null, toast: null };
    var toastTimer = null, wakeLock = null;

    function load() {
      var s = null;
      try { s = JSON.parse(store.get(KEY) || 'null'); } catch (e) { s = null; }
      if (!s || !Array.isArray(s.plan)) s = { v: 1, plan: defaultPlan(), sessions: [], active: null };
      s.sessions = s.sessions || [];
      return s;
    }
    function save() { store.set(KEY, JSON.stringify(state)); }
    function emit(type, payload) {
      if (typeof opts.onEvent === 'function') { try { opts.onEvent(type, payload); } catch (e) { console.error(e); } }
      el.dispatchEvent(new CustomEvent('gymtracker:' + type, { detail: payload, bubbles: true }));
    }
    function toast(msg) {
      ui.toast = msg; clearTimeout(toastTimer); renderToast();
      toastTimer = setTimeout(function () { ui.toast = null; renderToast(); }, 2400);
    }

    /* ---------- derived data ---------- */
    function lastEntry(k) {
      for (var i = state.sessions.length - 1; i >= 0; i--) {
        var e = state.sessions[i].entries.filter(function (x) { return key(x.name) === k; })[0];
        if (e && e.sets.length) return e;
      }
      return null;
    }
    function bestBefore(k) {
      var best = 0;
      state.sessions.forEach(function (s) {
        s.entries.forEach(function (e) { if (key(e.name) === k) e.sets.forEach(function (x) { best = Math.max(best, score(x)); }); });
      });
      return best;
    }
    function nextWorkout() {
      if (!state.plan.length) return null;
      var last = state.sessions[state.sessions.length - 1];
      var i = last ? state.plan.findIndex(function (w) { return w.id === last.workoutId; }) : -1;
      return state.plan[(i + 1) % state.plan.length];
    }
    function getStats() {
      var now = Date.now(), ws = weekStart(now), weeks = {};
      var week = state.sessions.filter(function (s) { return s.start >= ws; });
      state.sessions.forEach(function (s) { weeks[weekStart(s.start)] = 1; });
      var streak = 0, w = new Date(ws);
      if (!weeks[ws]) w.setDate(w.getDate() - 7);
      while (weeks[weekStart(w.getTime())]) { streak++; w.setDate(w.getDate() - 7); }
      return {
        totalSessions: state.sessions.length, weekSessions: week.length, streakWeeks: streak,
        weekVolume: week.reduce(function (a, s) { return a + volume(s); }, 0),
        lastWorkoutAt: state.sessions.length ? state.sessions[state.sessions.length - 1].end : null
      };
    }

    /* ---------- actions ---------- */
    function startWorkout(wid) {
      var w = state.plan.filter(function (x) { return x.id === wid; })[0];
      if (!w) return;
      if (state.active) { ui.workoutOpen = true; return render(); }
      state.active = {
        id: uid(), workoutId: w.id, name: w.name, start: Date.now(), restEnd: 0, restTotal: 0,
        entries: w.exercises.map(function (x) { return newEntry(x.name, x.sets, x.reps, x.rest, x.bar); })
      };
      ui.workoutOpen = true; save(); render(); keepAwake();
    }
    function newEntry(name, sets, reps, rest, bar) {
      var prev = lastEntry(key(name)), out = [];
      for (var i = 0; i < sets; i++) {
        var p = prev && (prev.sets[i] || prev.sets[prev.sets.length - 1]);
        out.push({ w: p ? p.w : '', r: p ? p.r : '', done: false });
      }
      return { name: name, reps: reps, rest: rest, bar: !!bar, sets: out };
    }
    function toggleSet(ei, si) {
      var a = state.active, e = a.entries[ei], s = e.sets[si];
      if (!s.done && !num(s.r)) return toast('Wiederholungen eintragen');
      s.done = !s.done;
      if (s.done) {
        var rest = +e.rest || 120;
        a.restEnd = Date.now() + rest * 1000; a.restTotal = rest;
        var before = bestBefore(key(e.name)), sc = score(s);
        s.pr = before > 0 && sc > before && !e.sets.some(function (o, i) { return i !== si && o.done && score(o) >= sc; });
        emit('set:done', { exercise: e.name, weight: num(s.w), reps: num(s.r), pr: !!s.pr });
        if (s.pr) emit('pr', { exercise: e.name, weight: num(s.w), reps: num(s.r) });
      } else { s.pr = false; a.restEnd = 0; }
      save(); render();
    }
    function finishWorkout() {
      var a = state.active;
      if (!doneSets(a)) return toast('Noch kein Satz abgehakt');
      var prs = [];
      a.entries.forEach(function (e) {
        e.sets = e.sets.filter(function (s) { return s.done; });
        if (e.sets.some(function (s) { return s.pr; })) prs.push(e.name);
      });
      a.entries = a.entries.filter(function (e) { return e.sets.length; });
      a.end = Date.now(); delete a.restEnd; delete a.restTotal;
      state.sessions.push(a); state.active = null; save();
      var payload = {
        session: a, name: a.name, durationMin: Math.max(1, Math.round((a.end - a.start) / 60000)),
        volume: volume(a), sets: doneSets(a), prs: prs, stats: getStats()
      };
      ui.workoutOpen = false; ui.summary = payload; releaseAwake(); render();
      emit('workout:finish', payload);
    }
    function keepAwake() {
      try {
        if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; }, function () {});
      } catch (e) { /* optional */ }
    }
    function releaseAwake() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* optional */ } wakeLock = null; }
    function findW(id) { return state.plan.filter(function (w) { return w.id === id; })[0]; }

    var actions = {
      tab: function (d) { ui.tab = d.tab; render(true); },
      start: function (d) { startWorkout(d.wid); },
      resume: function () { ui.workoutOpen = true; render(); keepAwake(); },
      minimize: function () { ui.workoutOpen = false; render(); },
      'toggle-set': function (d) { toggleSet(+d.ei, +d.si); },
      'add-set': function (d) {
        var sets = state.active.entries[+d.ei].sets, l = sets[sets.length - 1];
        sets.push({ w: l ? l.w : '', r: l ? l.r : '', done: false }); save(); render();
      },
      'del-set': function (d) {
        var e = state.active.entries[+d.ei];
        if (e.sets.length > 1) e.sets.pop(); else state.active.entries.splice(+d.ei, 1);
        save(); render();
      },
      'add-ex': function () {
        var inp = el.querySelector('.js-new-ex'), name = inp.value.trim();
        if (!name) return inp.focus();
        state.active.entries.push(newEntry(name, 3, '', 120, false)); save(); render();
      },
      finish: finishWorkout,
      discard: function () { state.active = null; ui.workoutOpen = false; releaseAwake(); save(); render(); toast('Training verworfen'); },
      'rest-add': function () { var a = state.active; a.restEnd += 15000; a.restTotal += 15; save(); tick(); },
      'rest-skip': function () { state.active.restEnd = 0; save(); tick(); },
      'close-sheet': function () { ui.sheet = null; ui.summary = null; render(); },
      'hist-toggle': function (d) { ui.open[d.id] = !ui.open[d.id]; render(); },
      'hist-del': function (d) {
        state.sessions = state.sessions.filter(function (s) { return s.id !== d.id; }); save(); render();
      },
      'prog-ex': function (d) { ui.progKey = d.k; render(); },
      'w-edit': function (d) { ui.edit = ui.edit === d.wid ? null : d.wid; render(); },
      'w-add': function () {
        var w = { id: uid(), name: 'Neues Training', exercises: [] };
        state.plan.push(w); ui.edit = w.id; save(); render();
      },
      'w-del': function (d) { state.plan = state.plan.filter(function (w) { return w.id !== d.wid; }); ui.edit = null; save(); render(); },
      'ex-add': function (d) { findW(d.wid).exercises.push(ex('Neue Übung', 3, '8-12', 120)); save(); render(); },
      'ex-del': function (d) { findW(d.wid).exercises.splice(+d.i, 1); save(); render(); },
      'ex-move': function (d) {
        var list = findW(d.wid).exercises, i = +d.i, j = i + +d.dir;
        if (j < 0 || j >= list.length) return;
        list.splice(j, 0, list.splice(i, 1)[0]); save(); render();
      },
      sheet: function (d) { ui.sheet = d.sheet; render(); },
      'plan-apply': function () {
        var plan = parsePlan(el.querySelector('.js-plan-text').value);
        if (!plan.length) return toast('Keine Übungen erkannt (Format: Name 3x10)');
        state.plan = plan; ui.sheet = null; ui.edit = null; save(); render();
        toast(plan.length + ' Trainings übernommen');
      },
      'data-copy': function () {
        var ta = el.querySelector('.js-data-text'); ta.value = JSON.stringify(state);
        var done = function () { toast('Backup kopiert'); };
        try { navigator.clipboard.writeText(ta.value).then(done, function () { ta.select(); toast('Text markiert – jetzt kopieren'); }); }
        catch (e) { ta.select(); toast('Text markiert – jetzt kopieren'); }
      },
      'data-apply': function () {
        try {
          var s = JSON.parse(el.querySelector('.js-data-text').value);
          if (!Array.isArray(s.plan) || !Array.isArray(s.sessions)) throw 0;
          state = s; ui.sheet = null; save(); render(); toast('Backup eingespielt');
        } catch (e) { toast('Das ist kein gültiges Backup'); }
      }
    };

    function onClick(e) {
      var t = e.target.closest('[data-act]');
      if (!t || !el.contains(t)) {
        if (e.target.classList && e.target.classList.contains('gt-scrim')) actions['close-sheet']();
        return;
      }
      if (t.hasAttribute('data-confirm') && !t.classList.contains('is-armed')) {
        var html = t.innerHTML;
        t.classList.add('is-armed');
        if (!t.classList.contains('gt-icon-btn')) t.textContent = 'Sicher?';
        setTimeout(function () { if (t.isConnected) { t.classList.remove('is-armed'); t.innerHTML = html; } }, 3000);
        return;
      }
      var fn = actions[t.dataset.act];
      if (fn) fn(t.dataset, t);
    }
    // Field edits save straight to state without re-rendering, so focus is never lost.
    function onInput(e) {
      var t = e.target, d = t.dataset;
      if (!d.f) return;
      if (d.f === 'w' || d.f === 'r') {
        if (!state.active) return;
        state.active.entries[+d.ei].sets[+d.si][d.f] = t.value.trim() === '' ? '' : num(t.value);
        var p = el.querySelector('.js-plates[data-ei="' + d.ei + '"]');
        if (p) p.innerHTML = platesHtml(state.active.entries[+d.ei]);
      } else {
        var w = findW(d.wid); if (!w) return;
        if (d.f === 'w-name') w.name = t.value;
        else {
          var x = w.exercises[+d.i];
          if (d.f === 'name') x.name = t.value;
          if (d.f === 'sets') x.sets = Math.max(1, Math.min(10, Math.round(num(t.value)) || 1));
          if (d.f === 'reps') x.reps = t.value.trim();
          if (d.f === 'rest') x.rest = Math.max(0, Math.round(num(t.value)));
          if (d.f === 'bar') x.bar = t.checked;
        }
      }
      save();
    }
    function onKey(e) {
      if (e.key === 'Enter' && e.target.classList.contains('js-new-ex')) actions['add-ex']();
      else if (e.key === 'Enter' && e.target.classList.contains('gt-in')) e.target.blur();
    }

    /* ---------- views ---------- */
    function viewHome() {
      var st = getStats(), now = Date.now(), ws = weekStart(now), next = nextWorkout();
      var trained = {};
      state.sessions.forEach(function (s) { trained[dayKey(s.start)] = 1; });
      var days = DAYS.map(function (n, i) {
        var d = new Date(ws); d.setDate(d.getDate() + i);
        var k = dayKey(d.getTime());
        return '<div class="gt-day' + (trained[k] ? ' is-done' : '') + (k === dayKey(now) ? ' is-today' : '') + '"><i>' + ICON.check + '</i>' + n + '</div>';
      }).join('');
      var h = '<header><p class="gt-eyebrow">' + esc(new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })) +
        '</p><h1 class="gt-h1">Training</h1></header>';
      if (state.active && !ui.workoutOpen) {
        h += '<button class="gt-resume" data-act="resume"><span class="gt-pulse"></span><span class="gt-grow"><span class="gt-item-title">' +
          esc(state.active.name) + ' läuft</span><br><span class="gt-item-sub js-elapsed">' + clock((now - state.active.start) / 1000) +
          '</span></span>' + ICON.right + '</button>';
      }
      h += '<div class="gt-week">' + days + '</div>';
      h += '<div class="gt-stats"><div class="gt-stat"><b>' + st.weekSessions + '</b><span>Einheiten</span></div>' +
        '<div class="gt-stat"><b>' + st.streakWeeks + '</b><span>Wochen in Folge</span></div>' +
        '<div class="gt-stat"><b>' + fmtVol(st.weekVolume) + '</b><span>Wochenvolumen</span></div></div>';
      if (!next) {
        return h + '<div class="gt-empty"><b>Kein Plan</b>Lege im Tab „Plan“ dein erstes Training an.</div>';
      }
      if (!state.active) {
        h += '<section class="gt-hero"><div><p class="gt-eyebrow">Als Nächstes dran</p><h2 class="gt-hero-title">' + esc(next.name) + '</h2></div>' +
          '<ul class="gt-exlist">' + next.exercises.map(function (x) {
            return '<li><span>' + esc(x.name) + '</span><span>' + x.sets + ' × ' + esc(x.reps) + '</span></li>';
          }).join('') + '</ul>' +
          '<button class="gt-btn gt-btn-accent gt-btn-big" data-act="start" data-wid="' + next.id + '">' + ICON.play + 'Training starten</button></section>';
      }
      var others = state.plan.filter(function (w) { return state.active || w.id !== next.id; });
      if (others.length) {
        h += '<section class="gt-section"><h2 class="gt-h2">' + (state.active ? 'Dein Plan' : 'Oder heute lieber') + '</h2><div class="gt-list">' +
          others.map(function (w) {
            return '<button class="gt-item" data-act="start" data-wid="' + w.id + '"><span class="gt-grow"><span class="gt-item-title">' + esc(w.name) +
              '</span><br><span class="gt-item-sub">' + w.exercises.length + ' Übungen</span></span><span class="gt-icon-btn">' + ICON.right + '</span></button>';
          }).join('') + '</div></section>';
      }
      return h;
    }

    function platesHtml(e) {
      var s = e.sets.filter(function (x) { return !x.done; })[0] || e.sets[e.sets.length - 1];
      var p = s ? platesFor(s.w) : [];
      if (!p.length) return 'Stange 20 kg';
      return 'Pro Seite ' + p.map(function (x) { return '<span class="gt-plate" data-p="' + x + '">' + fmt(x) + '</span>'; }).join('');
    }

    function viewWorkout() {
      var a = state.active, total = 0, done = 0;
      a.entries.forEach(function (e) { total += e.sets.length; e.sets.forEach(function (s) { if (s.done) done++; }); });
      var h = '<div class="gt-wo"><header class="gt-wo-head"><button class="gt-icon-btn" data-act="minimize" aria-label="Training minimieren">' + ICON.down +
        '</button><div class="gt-grow"><div class="gt-wo-name">' + esc(a.name) + '</div><div class="gt-wo-time"><span class="js-elapsed">' +
        clock((Date.now() - a.start) / 1000) + '</span> · ' + done + ' von ' + total + ' Sätzen</div></div>' +
        '<button class="gt-btn gt-btn-accent" data-act="finish">Beenden</button></header>' +
        '<div class="gt-bar"><i style="width:' + (total ? done / total * 100 : 0) + '%"></i></div><div class="gt-wo-body">';
      a.entries.forEach(function (e, ei) {
        var prev = lastEntry(key(e.name));
        h += '<section class="gt-ex"><div><h3 class="gt-ex-name">' + esc(e.name) + '</h3><div class="gt-ex-meta">' +
          (e.reps ? 'Ziel ' + e.sets.length + ' × ' + esc(e.reps) + ' · ' : '') + 'Pause ' + clock(e.rest || 120) + '</div></div>' +
          (e.bar ? '<div class="gt-plates js-plates" data-ei="' + ei + '">' + platesHtml(e) + '</div>' : '') +
          '<div class="gt-sets"><div class="gt-set-head"><span>#</span><span>Letztes Mal</span><span>kg</span><span>Wdh</span><span></span></div>';
        e.sets.forEach(function (s, si) {
          var p = prev && prev.sets[si];
          h += '<div class="gt-set' + (s.done ? ' is-done' : '') + '"><span class="gt-set-n">' + (si + 1) + '</span>' +
            '<span class="gt-set-prev">' + (s.pr ? '<span class="gt-badge">REKORD</span>' : p ? fmt(num(p.w)) + ' × ' + fmt(num(p.r)) : '–') + '</span>' +
            '<input class="gt-in" id="gt-w-' + ei + '-' + si + '" inputmode="decimal" enterkeyhint="done" aria-label="Gewicht in kg, Satz ' + (si + 1) +
            '" placeholder="kg" data-f="w" data-ei="' + ei + '" data-si="' + si + '" value="' + (s.w === '' ? '' : fmt(num(s.w))) + '">' +
            '<input class="gt-in" id="gt-r-' + ei + '-' + si + '" inputmode="numeric" enterkeyhint="done" aria-label="Wiederholungen, Satz ' + (si + 1) +
            '" placeholder="' + esc(String(e.reps || '').split('-')[0] || '0') + '" data-f="r" data-ei="' + ei + '" data-si="' + si + '" value="' + (s.r === '' ? '' : fmt(num(s.r))) + '">' +
            '<button class="gt-check" data-act="toggle-set" data-ei="' + ei + '" data-si="' + si + '" aria-label="Satz ' + (si + 1) + (s.done ? ' zurücknehmen' : ' abhaken') + '" aria-pressed="' + !!s.done + '">' + ICON.check + '</button></div>';
        });
        h += '</div><div class="gt-ex-foot"><button class="gt-btn gt-btn-ghost gt-btn-sm" data-act="add-set" data-ei="' + ei + '">+ Satz</button>' +
          '<button class="gt-btn gt-btn-ghost gt-btn-sm" data-act="del-set" data-ei="' + ei + '">− Satz</button></div></section>';
      });
      h += '<div class="gt-addrow"><input class="gt-text js-new-ex" id="gt-new-ex" placeholder="Weitere Übung" aria-label="Weitere Übung hinzufügen" enterkeyhint="done">' +
        '<button class="gt-btn" data-act="add-ex">Hinzufügen</button></div>' +
        '<button class="gt-btn gt-btn-danger" data-act="discard" data-confirm>Training verwerfen</button></div>' +
        '<div class="gt-rest js-rest" hidden><i class="gt-rest-fill js-rest-fill"></i><div class="gt-grow"><div class="gt-rest-label">Pause</div>' +
        '<div class="gt-rest-time js-rest-time">0:00</div></div><button class="gt-btn gt-btn-sm" data-act="rest-add">+15 s</button>' +
        '<button class="gt-btn gt-btn-sm" data-act="rest-skip">Weiter</button></div></div>';
      return h;
    }

    function viewHistory() {
      var h = '<header><h1 class="gt-h1">Verlauf</h1></header>';
      if (!state.sessions.length) return h + '<div class="gt-empty"><b>Noch nichts geloggt</b>Abgeschlossene Trainings erscheinen hier mit allen Sätzen.</div>';
      var month = '';
      state.sessions.slice().reverse().forEach(function (s) {
        var m = new Date(s.start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
        if (m !== month) { h += '<h2 class="gt-h2">' + esc(m) + '</h2>'; month = m; }
        var open = ui.open[s.id];
        h += '<article class="gt-card"><button class="gt-item" data-act="hist-toggle" data-id="' + s.id + '" aria-expanded="' + !!open + '"><span class="gt-grow"><span class="gt-item-title">' +
          esc(s.name) + '</span><br><span class="gt-item-sub">' + esc(new Date(s.start).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })) +
          ' · ' + Math.max(1, Math.round((s.end - s.start) / 60000)) + ' min · ' + fmtVol(volume(s)) + '</span></span><span class="gt-icon-btn">' + (open ? ICON.up : ICON.down) + '</span></button>';
        if (open) {
          h += '<div class="gt-hist-body">' + s.entries.map(function (e) {
            return '<div class="gt-hist-ex"><b>' + esc(e.name) + '</b><span>' + e.sets.map(function (x) {
              return (num(x.w) ? fmt(num(x.w)) + ' × ' : '') + fmt(num(x.r));
            }).join('  ·  ') + '</span></div>';
          }).join('') + '<button class="gt-btn gt-btn-danger gt-btn-sm" data-act="hist-del" data-id="' + s.id + '" data-confirm>Eintrag löschen</button></div>';
        }
        h += '</article>';
      });
      return h;
    }

    function chart(pts, unit) {
      var W = 320, H = 150, L = 34, R = 12, T = 12, B = 22;
      var vals = pts.map(function (p) { return p.v; }), lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
      var x = function (i) { return pts.length === 1 ? (L + W - R) / 2 : L + i * (W - L - R) / (pts.length - 1); };
      var y = function (v) { return T + (hi - v) * (H - T - B) / (hi - lo); };
      var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Verlauf in ' + unit + '">';
      [lo, (lo + hi) / 2, hi].forEach(function (v) {
        s += '<line class="g" x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '"/><text x="' + (L - 6) + '" y="' + (y(v) + 3) + '" text-anchor="end">' + fmt(Math.round(v * 10) / 10) + '</text>';
      });
      var line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
      if (pts.length > 1) {
        s += '<path class="a" d="' + line + ' L' + x(pts.length - 1) + ' ' + (H - B) + ' L' + x(0) + ' ' + (H - B) + ' Z"/><path class="l" d="' + line + '"/>';
      }
      pts.forEach(function (p, i) {
        var last = i === pts.length - 1;
        if (pts.length <= 16 || last) s += '<circle class="' + (last ? 'e' : 'd') + '" cx="' + x(i) + '" cy="' + y(p.v) + '" r="' + (last ? 5 : 3) + '"/>';
      });
      var dl = function (t) { return new Date(t).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }); };
      s += '<text x="' + L + '" y="' + (H - 6) + '">' + dl(pts[0].t) + '</text>';
      if (pts.length > 1) s += '<text x="' + (W - R) + '" y="' + (H - 6) + '" text-anchor="end">' + dl(pts[pts.length - 1].t) + '</text>';
      return s + '</svg>';
    }

    function viewProgress() {
      var h = '<header><h1 class="gt-h1">Fortschritt</h1></header>', names = {}, order = [];
      state.sessions.forEach(function (s) { s.entries.forEach(function (e) { var k = key(e.name); if (!names[k]) order.push(k); names[k] = e.name; }); });
      if (!order.length) return h + '<div class="gt-empty"><b>Noch keine Daten</b>Nach deinem ersten Training siehst du hier pro Übung, wie deine Kraft sich entwickelt.</div>';
      var k = names[ui.progKey] ? ui.progKey : order[0];
      h += '<div class="gt-chips">' + order.map(function (o) {
        return '<button class="gt-chip' + (o === k ? ' is-on' : '') + '" data-act="prog-ex" data-k="' + esc(o) + '">' + esc(names[o]) + '</button>';
      }).join('') + '</div>';
      var pts = [], topW = 0, topSet = null, count = 0, weighted = false;
      state.sessions.forEach(function (s) {
        s.entries.forEach(function (e) {
          if (key(e.name) !== k) return;
          count++;
          e.sets.forEach(function (x) { if (num(x.w) > 0) weighted = true; if (num(x.w) > topW || !topSet) { if (num(x.w) >= topW) { topW = num(x.w); topSet = x; } } });
          pts.push({ t: s.start, v: Math.max.apply(null, e.sets.map(score)) });
        });
      });
      var unit = weighted ? 'kg' : 'Wdh', best = Math.max.apply(null, pts.map(function (p) { return p.v; }));
      var delta = pts.length > 1 ? pts[pts.length - 1].v - pts[0].v : 0;
      h += '<div class="gt-stats"><div class="gt-stat"><b>' + fmt(Math.round(best * 10) / 10) + '</b><span>' + (weighted ? 'kg 1RM geschätzt' : 'Wdh Bestwert') + '</span></div>' +
        '<div class="gt-stat"><b>' + (weighted ? fmt(topW) + ' × ' + fmt(num(topSet.r)) : count) + '</b><span>' + (weighted ? 'schwerster Satz' : 'Einheiten') + '</span></div>' +
        '<div class="gt-stat"><b>' + (delta > 0 ? '+' : '') + fmt(Math.round(delta * 10) / 10) + '</b><span>' + unit + ' seit Start</span></div></div>';
      h += '<section class="gt-section"><h2 class="gt-h2">' + (weighted ? 'Geschätztes 1RM pro Einheit (kg)' : 'Beste Wiederholungen pro Einheit') + '</h2><div class="gt-chart">' + chart(pts, unit) + '</div></section>';
      return h;
    }

    function viewPlan() {
      var h = '<header><h1 class="gt-h1">Plan</h1></header>';
      state.plan.forEach(function (w) {
        var edit = ui.edit === w.id;
        h += '<article class="gt-card"><div class="gt-plan-head"><div class="gt-grow"><div class="gt-plan-title">' + esc(w.name || 'Ohne Namen') + '</div><div class="gt-item-sub">' +
          w.exercises.length + ' Übungen</div></div><button class="gt-btn gt-btn-sm' + (edit ? ' gt-btn-accent' : '') + '" data-act="w-edit" data-wid="' + w.id + '">' + (edit ? 'Fertig' : 'Bearbeiten') + '</button></div>';
        if (!edit) {
          h += '<ul class="gt-exlist" style="padding:0 16px 8px">' + w.exercises.map(function (x) {
            return '<li><span>' + esc(x.name) + '</span><span>' + x.sets + ' × ' + esc(x.reps) + '</span></li>';
          }).join('') + '</ul>';
        } else {
          var a = ' data-wid="' + w.id + '"';
          h += '<div class="gt-edit"><label class="gt-field">Name<input class="gt-text" id="gt-wn-' + w.id + '" data-f="w-name"' + a + ' value="' + esc(w.name) + '"></label>';
          w.exercises.forEach(function (x, i) {
            var b = a + ' data-i="' + i + '"', id = 'gt-e-' + x.id;
            h += '<div class="gt-edit-ex"><div class="gt-row"><input class="gt-text gt-grow" id="' + id + '-n" aria-label="Name der Übung" data-f="name"' + b + ' value="' + esc(x.name) + '">' +
              '<button class="gt-icon-btn" data-act="ex-move" data-dir="-1"' + b + ' aria-label="Nach oben">' + ICON.up + '</button>' +
              '<button class="gt-icon-btn" data-act="ex-move" data-dir="1"' + b + ' aria-label="Nach unten">' + ICON.down + '</button></div>' +
              '<div class="gt-edit-grid"><label class="gt-field">Sätze<input class="gt-text" id="' + id + '-s" inputmode="numeric" data-f="sets"' + b + ' value="' + x.sets + '"></label>' +
              '<label class="gt-field">Wdh<input class="gt-text" id="' + id + '-r" data-f="reps"' + b + ' value="' + esc(x.reps) + '"></label>' +
              '<label class="gt-field">Pause (s)<input class="gt-text" id="' + id + '-p" inputmode="numeric" data-f="rest"' + b + ' value="' + x.rest + '"></label></div>' +
              '<div class="gt-row"><label class="gt-toggle gt-grow"><input type="checkbox" id="' + id + '-b" data-f="bar"' + b + (x.bar ? ' checked' : '') + '>Langhantel (Scheiben anzeigen)</label>' +
              '<button class="gt-icon-btn" data-act="ex-del"' + b + ' data-confirm aria-label="Übung löschen">' + ICON.trash + '</button></div></div>';
          });
          h += '<div class="gt-tools"><button class="gt-btn gt-btn-sm" data-act="ex-add"' + a + '>+ Übung</button>' +
            '<button class="gt-btn gt-btn-danger gt-btn-sm" data-act="w-del"' + a + ' data-confirm>Training löschen</button></div></div>';
        }
        h += '</article>';
      });
      h += '<div class="gt-tools"><button class="gt-btn" data-act="w-add">+ Training</button>' +
        '<button class="gt-btn" data-act="sheet" data-sheet="plan">Plan aus Text einfügen</button>' +
        '<button class="gt-btn gt-btn-ghost" data-act="sheet" data-sheet="data">Backup</button></div>';
      return h;
    }

    function viewSheet() {
      var h = '';
      if (ui.summary) {
        var s = ui.summary;
        h = '<div><p class="gt-eyebrow">' + esc(s.name) + ' abgeschlossen</p><h2 class="gt-h1">Stark.</h2></div>' +
          '<div class="gt-sum"><div><b>' + s.durationMin + '</b><span>Minuten</span></div><div><b>' + s.sets + '</b><span>Sätze</span></div><div><b>' +
          fmtVol(s.volume) + '</b><span>bewegt</span></div></div>' +
          (s.prs.length ? '<div class="gt-section"><h3 class="gt-h2">Neue Rekorde</h3><div class="gt-prlist">' + s.prs.map(function (n) {
            return '<span class="gt-badge">' + esc(n) + '</span>';
          }).join('') + '</div></div>' : '') +
          '<button class="gt-btn gt-btn-accent gt-btn-big" data-act="close-sheet">Fertig</button>';
      } else if (ui.sheet === 'plan') {
        h = '<div><h2 class="gt-h1">Plan einfügen</h2><p class="gt-muted">Eine Zeile pro Übung im Format „Name 3x8-12“. Eine Zeile ohne Sätze beginnt ein neues Training.</p></div>' +
          '<textarea class="gt-text js-plan-text" id="gt-plan-text" aria-label="Trainingsplan als Text" placeholder="Push\nBankdrücken 3x6-10\nSeitheben 3x12-15\n\nPull\nKlimmzüge 3x6-10"></textarea>' +
          '<div class="gt-tools"><button class="gt-btn gt-btn-accent" data-act="plan-apply" data-confirm>Aktuellen Plan ersetzen</button>' +
          '<button class="gt-btn gt-btn-ghost" data-act="close-sheet">Abbrechen</button></div>';
      } else if (ui.sheet === 'data') {
        h = '<div><h2 class="gt-h1">Backup</h2><p class="gt-muted">Deine Daten liegen nur in diesem Browser. Kopiere das Backup an einen sicheren Ort, oder füge ein früheres Backup ein und spiele es zurück.</p></div>' +
          '<textarea class="gt-text js-data-text" id="gt-data-text" aria-label="Backup-Daten" placeholder="Backup hier einfügen"></textarea>' +
          '<div class="gt-tools"><button class="gt-btn gt-btn-accent" data-act="data-copy">Backup kopieren</button>' +
          '<button class="gt-btn" data-act="data-apply" data-confirm>Eingefügtes Backup einspielen</button>' +
          '<button class="gt-btn gt-btn-ghost" data-act="close-sheet">Schließen</button></div>';
      }
      return h ? '<div class="gt-scrim"><div class="gt-sheet" role="dialog" aria-modal="true">' + h + '</div></div>' : '';
    }

    /* ---------- render ---------- */
    var TABS = [['home', 'Heute', ICON.home], ['history', 'Verlauf', ICON.hist], ['progress', 'Fortschritt', ICON.chart], ['plan', 'Plan', ICON.plan]];
    var VIEWS = { home: viewHome, history: viewHistory, progress: viewProgress, plan: viewPlan };
    el.innerHTML = '<div class="gt"><main class="gt-view"></main><nav class="gt-tabs" aria-label="Bereiche"></nav>' +
      '<div class="js-wo"></div><div class="js-sheet"></div><div class="js-toast" aria-live="polite"></div></div>';
    var $view = el.querySelector('.gt-view'), $tabs = el.querySelector('.gt-tabs'), $wo = el.querySelector('.js-wo'),
      $sheet = el.querySelector('.js-sheet'), $toast = el.querySelector('.js-toast');

    function render(resetScroll) {
      var top = $view.scrollTop, body = $wo.querySelector('.gt-wo-body'), wtop = body ? body.scrollTop : 0;
      $view.innerHTML = VIEWS[ui.tab]();
      $view.scrollTop = resetScroll ? 0 : top;
      $tabs.innerHTML = TABS.map(function (t) {
        return '<button class="gt-tab' + (ui.tab === t[0] ? ' is-on' : '') + '" data-act="tab" data-tab="' + t[0] + '"' + (ui.tab === t[0] ? ' aria-current="page"' : '') + '>' + t[2] + t[1] + '</button>';
      }).join('');
      var showWo = !!(state.active && ui.workoutOpen);
      if (showWo) {
        var had = !!body;
        $wo.innerHTML = viewWorkout();
        if (had) { $wo.firstChild.style.animation = 'none'; $wo.querySelector('.gt-wo-body').scrollTop = wtop; }
      } else $wo.innerHTML = '';
      $sheet.innerHTML = viewSheet();
      tick();
    }
    function renderToast() { $toast.innerHTML = ui.toast ? '<div class="gt-toast">' + esc(ui.toast) + '</div>' : ''; }
    function tick() {
      var a = state.active;
      if (!a) return;
      var now = Date.now(), els = el.querySelectorAll('.js-elapsed');
      for (var i = 0; i < els.length; i++) els[i].textContent = clock((now - a.start) / 1000);
      var rest = el.querySelector('.js-rest');
      if (!rest) return;
      var left = (a.restEnd - now) / 1000;
      if (a.restEnd && left <= 0) {
        a.restEnd = 0; save();
        try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* optional */ }
      }
      rest.hidden = !a.restEnd;
      if (a.restEnd) {
        rest.querySelector('.js-rest-time').textContent = clock(left);
        rest.querySelector('.js-rest-fill').style.width = Math.max(0, Math.min(100, (1 - left / a.restTotal) * 100)) + '%';
      }
    }

    el.addEventListener('click', onClick);
    el.addEventListener('input', onInput);
    el.addEventListener('keydown', onKey);
    var timer = setInterval(tick, 1000);
    render();

    return {
      getState: function () { return JSON.parse(JSON.stringify(state)); },
      getStats: getStats,
      setPlanFromText: function (text) { var p = parsePlan(text); if (p.length) { state.plan = p; save(); render(); } return p.length; },
      destroy: function () {
        clearInterval(timer); releaseAwake();
        el.removeEventListener('click', onClick); el.removeEventListener('input', onInput); el.removeEventListener('keydown', onKey);
        el.innerHTML = '';
      }
    };
  }

  var api = { mount: mount, parsePlan: parsePlan, version: '1.0.0' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GymTracker = api;
})(typeof window !== 'undefined' ? window : globalThis);
