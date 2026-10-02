/* The Night Lantern: rack clock, air-time logic, episode rendering,
   the click-to-load YouTube player and the Night 5 gate.
   Every time shown is formatted from an episode's `airs` value in Pacific.
   A night with a future `airs` gets no link, no player and no video id in the page. */
(function () {
  'use strict';

  var TZ = 'America/Los_Angeles';
  var EPISODES = (window.EPISODES || []).slice().sort(function (a, b) { return a.number - b.number; });
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function now() { return Date.now(); }
  function airsAt(ep) { return Date.parse(ep.airs); }
  function hasAired(ep, t) { return t >= airsAt(ep); }
  function byNumber(n) { return EPISODES.filter(function (e) { return e.number === n; })[0]; }
  function watchUrl(ep) { return 'https://youtu.be/' + encodeURIComponent(ep.video_id); }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text != null) node.textContent = text;
    return node;
  }

  /* ---------- time formatting ---------- */

  function parts(date, opts) {
    var out = {};
    new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: TZ }, opts))
      .formatToParts(date).forEach(function (p) { out[p.type] = p.value; });
    return out;
  }

  // "Friday, 2 October 2026, 7:00 PM Pacific"
  function pacificLong(ms) {
    var p = parts(new Date(ms), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    return p.weekday + ', ' + p.day + ' ' + p.month + ' ' + p.year + ', ' + p.hour + ':' + p.minute + ' ' + p.dayPeriod + ' Pacific';
  }

  // Visitor's own clock, only when it reads differently from Pacific.
  function localTime(ms) {
    try {
      var opts = { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' };
      var local = new Intl.DateTimeFormat(undefined, opts).format(new Date(ms));
      var pacific = new Intl.DateTimeFormat(undefined, Object.assign({ timeZone: TZ }, opts)).format(new Date(ms));
      if (local === pacific) return '';
      return 'Your time: ' + new Intl.DateTimeFormat(undefined, Object.assign({ timeZoneName: 'short' }, opts)).format(new Date(ms));
    } catch (e) { return ''; }
  }

  // Minute resolution: "in 1 day, 2 hours", "in 3 hours, 12 minutes", "in 5 minutes".
  function countdown(ms) {
    var mins = Math.max(1, Math.ceil(ms / 60000));
    var d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
    function unit(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
    if (d) return 'in ' + unit(d, 'day') + (h ? ', ' + unit(h, 'hour') : '');
    if (h) return 'in ' + unit(h, 'hour') + (m ? ', ' + unit(m, 'minute') : '');
    return 'in ' + unit(m, 'minute');
  }

  /* ---------- rack clock ---------- */

  function startClock() {
    var box = document.querySelector('[data-clock]');
    if (!box) return;
    var timeEl = box.querySelector('[data-clock-time]');
    var dayEl = box.querySelector('[data-daypart]');
    var chip = box.querySelector('[data-onair]');
    box.hidden = false;
    var timer = null;

    function tick() {
      var slow = reduceMotion && reduceMotion.matches;
      var p = parts(new Date(now()), { hour: 'numeric', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
      var h = parseInt(p.hour, 10) % 24, m = parseInt(p.minute, 10);
      var h12 = h % 12 === 0 ? 12 : h % 12;
      timeEl.textContent = h12 + ':' + p.minute + (slow ? '' : ':' + p.second) + ' ' + (h < 12 ? 'AM' : 'PM');
      var mins = h * 60 + m;
      var onAir = mins < 240;
      chip.hidden = !onAir;
      dayEl.textContent = onAir ? 'In the story: Ray is on air'
        : mins < 330 ? 'In the story: the gap'
        : 'In the story: Ray is back at midnight';
      // Under reduced motion, tick on the minute rather than every second.
      clearTimeout(timer);
      timer = setTimeout(tick, slow ? 60000 - (Date.now() % 60000) + 50 : 1000 - (Date.now() % 1000) + 20);
    }
    tick();
    if (reduceMotion && reduceMotion.addEventListener) reduceMotion.addEventListener('change', tick);
  }

  /* ---------- player facade (one live player per page) ---------- */

  var livePlayer = null;

  function loadPlayer(facade) {
    if (!facade || !facade.getAttribute('data-video')) return;
    if (livePlayer && livePlayer.parentNode) return livePlayer.focus();
    var id = facade.getAttribute('data-video');
    var frame = el('iframe', {
      src: 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) + '?autoplay=1&rel=0',
      title: facade.getAttribute('data-video-title') || 'YouTube video player',
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowfullscreen: '',
      referrerpolicy: 'strict-origin-when-cross-origin'
    });
    frame.className = 'player-frame';
    facade.parentNode.replaceChild(frame, facade);
    livePlayer = frame;
    frame.focus();
  }

  function playNight1() {
    var target = document.getElementById('night-1');
    var facade = document.querySelector('.facade[data-video]');
    if (target) target.scrollIntoView({ behavior: reduceMotion && reduceMotion.matches ? 'auto' : 'smooth', block: 'center' });
    if (facade) loadPlayer(facade); else if (livePlayer) livePlayer.focus();
  }

  function wirePlayer() {
    document.addEventListener('click', function (ev) {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      var facade = ev.target.closest && ev.target.closest('.facade[data-video]');
      var start = ev.target.closest && ev.target.closest('[data-play-night-1]');
      if (facade) { ev.preventDefault(); loadPlayer(facade); }
      else if (start && document.getElementById('night-1')) { ev.preventDefault(); playNight1(); }
    });
  }

  /* ---------- episode rows ---------- */

  function badgeFor(ep, aired) {
    if (ep.premiere) return 'Season 2 premiere';
    if (ep.finale && aired) return 'Season 1 finale';
    return '';
  }

  function row(ep, t, isNext) {
    var aired = hasAired(ep, t);
    var li = el('li', { 'class': 'log-row ' + (aired ? 'is-aired' : 'is-upcoming') });

    var img = el('img', {
      src: ep.thumb, width: '640', height: '360', loading: 'lazy', decoding: 'async',
      alt: 'Night ' + ep.number + ' thumbnail: Ray at the desk, with a line from the caller.'
    });
    img.className = 'log-thumb';
    if (aired) {
      var thumbLink = el('a', { href: watchUrl(ep), tabindex: '-1', 'aria-hidden': 'true' });
      thumbLink.className = 'log-thumb-link';
      img.alt = '';
      thumbLink.appendChild(img);
      li.appendChild(thumbLink);
    } else {
      li.appendChild(img);
    }

    var body = el('div', { 'class': 'log-body' });
    var head = el('p', { 'class': 'log-head' });
    head.appendChild(el('span', { 'class': 'log-n' }, 'Night ' + ep.number));
    var badge = badgeFor(ep, aired);
    if (badge) head.appendChild(el('span', { 'class': 'badge' }, badge));
    body.appendChild(head);
    body.appendChild(el('h3', { 'class': 'log-title' }, ep.series_title));
    body.appendChild(el('p', { 'class': 'log-premise' }, ep.premise));

    var when = el('p', { 'class': 'log-when' });
    var ms = airsAt(ep);
    when.appendChild(el('span', null, (aired ? 'Aired ' : 'Airs ') + pacificLong(ms)));
    if (!aired) {
      var local = localTime(ms);
      if (local) when.appendChild(el('span', { 'class': 'mute' }, local));
      if (isNext) when.appendChild(el('span', { 'class': 'countdown', 'data-countdown': String(ms) }, countdown(ms - t)));
    }
    body.appendChild(when);

    if (aired) {
      var watch = el('a', { href: watchUrl(ep), 'class': 'watch' }, 'Watch on YouTube');
      watch.appendChild(el('span', { 'class': 'visually-hidden' }, ': Night ' + ep.number + ', ' + ep.series_title));
      body.appendChild(watch);
    }
    li.appendChild(body);
    return li;
  }

  function nextUpcoming(t) {
    return EPISODES.filter(function (e) { return !hasAired(e, t); })[0];
  }

  function fill(list, eps, t) {
    var next = nextUpcoming(t);
    list.textContent = '';
    eps.forEach(function (ep) { list.appendChild(row(ep, t, next && ep.number === next.number)); });
  }

  /* ---------- page renders ---------- */

  function renderHome(t) {
    var upcoming = document.querySelector('[data-upcoming]');
    if (upcoming) {
      var soon = EPISODES.filter(function (e) { return !hasAired(e, t); }).slice(0, 2);
      if (soon.length) fill(upcoming, soon, t);
      else {
        upcoming.textContent = '';
        upcoming.appendChild(el('li', { 'class': 'log-empty' }, 'Every night on the log has aired. The full log has them all.'));
      }
    }

    var actions = document.querySelector('[data-actions]');
    if (actions) {
      Array.prototype.forEach.call(actions.querySelectorAll('[data-extra]'), function (n) { n.remove(); });
      var start = actions.querySelector('[data-play-night-1]');
      var s2 = byNumber(11);
      if (s2 && hasAired(s2, t)) {
        var b2 = el('a', { href: watchUrl(s2), 'class': 'btn', 'data-extra': '' }, 'Or start at Season 2');
        start.insertAdjacentElement('afterend', b2);
      }
      var aired = EPISODES.filter(function (e) { return hasAired(e, t); });
      var latest = aired[aired.length - 1];
      if (latest && latest.number !== 1) {
        var bl = el('a', { href: watchUrl(latest), 'class': 'btn btn-quiet', 'data-extra': '' }, 'Latest night');
        bl.appendChild(el('span', { 'class': 'btn-sub' }, 'Night ' + latest.number));
        actions.appendChild(bl);
      }
    }

    var nora = document.querySelector('[data-nora]');
    if (nora && s2Aired(t)) {
      nora.classList.remove('is-dim');
      var note = nora.querySelector('[data-nora-note]');
      if (note) note.textContent = 'Season 2.';
    }
  }

  function s2Aired(t) { var s2 = byNumber(11); return !!(s2 && hasAired(s2, t)); }

  function renderNights(t) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-log]'), function (list) {
      var season = parseInt(list.getAttribute('data-log'), 10);
      fill(list, EPISODES.filter(function (e) { return e.season === season; }), t);
    });

    // The rule, stated once, and only after Night 5 has aired.
    var slot = document.querySelector('[data-after-five]');
    var five = byNumber(5);
    if (slot && five && hasAired(five, t) && !slot.firstChild) {
      var details = el('details', { 'class': 'after-five' });
      details.appendChild(el('summary', null, "If you've heard Night 5"));
      details.appendChild(el('p', null, 'Whatever is out there comes for people nobody knows the location of. When you call in, everyone listening knows where you are, and that is what the lines are for.'));
      slot.appendChild(details);
    }
  }

  function airedCount(t) { return EPISODES.filter(function (e) { return hasAired(e, t); }).length; }

  function render() {
    var t = now();
    renderHome(t);
    renderNights(t);
    return airedCount(t);
  }

  // Re-render when a night crosses its air time; otherwise just move the countdown.
  function watchAirTimes(count) {
    setInterval(function () {
      var t = now();
      if (airedCount(t) !== count) { count = render(); return; }
      Array.prototype.forEach.call(document.querySelectorAll('[data-countdown]'), function (n) {
        n.textContent = countdown(parseInt(n.getAttribute('data-countdown'), 10) - t);
      });
    }, 30000);
  }

  window.NightLantern = { playNight1: playNight1 };

  startClock();
  wirePlayer();
  watchAirTimes(render());
})();
