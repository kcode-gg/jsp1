/* Claude artifact shell: mounts the tracker and mirrors its data into the viewer's
   private store (data/users/<id>/), so progress follows the Claude account across
   devices. localStorage stays the fast local copy; newest write wins. */
(function () {
  var KEY = 'gymtracker.v1', TKEY = KEY + '.t';
  var ls = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  var status = 'Nur auf diesem Gerät gespeichert', col = null, written = {}, timer = null, busy = false, dirty = false;
  var gym = GymTracker.mount(document.getElementById('gym'), {
    storageKey: KEY,
    storage: { get: ls.get, set: function (k, v) { ls.set(k, v); ls.set(TKEY, String(Date.now())); dirty = true; schedule(); } },
    getStatus: function () { return status; }
  });
  function setStatus(s) { status = s; gym.refreshStatus(); }
  function schedule() { clearTimeout(timer); if (col) timer = setTimeout(push, 2500); }
  function monthKey(t) { var d = new Date(t); return 'm-' + d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }

  async function push() {
    clearTimeout(timer);
    if (!col) return;
    if (busy) return schedule();
    var raw = ls.get(KEY);
    if (!raw) return;
    busy = true; dirty = false;
    try {
      var state = JSON.parse(raw), docs = {}, sessions = state.sessions || [];
      delete state.sessions;
      sessions.forEach(function (s) { var k = monthKey(s.start); (docs[k] = docs[k] || { sessions: [] }).sessions.push(s); });
      Object.keys(written).forEach(function (k) { if (k !== 'meta' && !docs[k]) docs[k] = { sessions: [] }; });
      docs.meta = { t: +ls.get(TKEY) || Date.now(), state: state };   // meta last: it carries the version stamp
      for (var k in docs) {
        var body = JSON.stringify(docs[k]);
        if (written[k] === body) continue;
        await col.doc(k).set(JSON.parse(body));
        written[k] = body;
      }
      setStatus('Mit deinem Claude-Konto synchronisiert');
    } catch (e) {
      dirty = true;
      setStatus('Synchronisierung gerade nicht möglich. Deine Daten sind auf diesem Gerät gesichert.');
    }
    busy = false;
  }

  async function pull() {
    if (!col || busy) return;
    if (dirty) return schedule();
    busy = true;
    try {
      var snap = await col.get(), meta = null, sessions = [];
      snap.docs.forEach(function (d) {
        var b = d.data(); if (!b) return;
        if (d.id === 'meta') meta = b;
        else if (Array.isArray(b.sessions)) { sessions = sessions.concat(b.sessions); written[d.id] = JSON.stringify(b); }
      });
      busy = false;
      if (dirty) return schedule();
      var localT = +ls.get(TKEY) || 0;
      if (meta && meta.state && meta.t > localT) {
        var state = JSON.parse(JSON.stringify(meta.state));
        state.sessions = sessions.sort(function (a, b) { return a.start - b.start; });
        ls.set(KEY, JSON.stringify(state)); ls.set(TKEY, String(meta.t));
        status = 'Mit deinem Claude-Konto synchronisiert';
        gym.reload();
      } else if (ls.get(KEY) && (!meta || localT > meta.t)) {
        await push();
      } else setStatus('Mit deinem Claude-Konto synchronisiert');
    } catch (e) {
      busy = false;
      setStatus('Synchronisierung gerade nicht möglich. Deine Daten sind auf diesem Gerät gesichert.');
    }
  }

  (async function () {
    if (!window.claude || !window.claude.use) return;
    var db = await window.claude.use('db'), user = await window.claude.use('user');
    var id = user ? await user.id() : null;
    if (!db || !id) return;
    col = db.collection('data/users/' + id);
    await pull();
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') pull(); else if (dirty) push();
    });
  })();
})();
