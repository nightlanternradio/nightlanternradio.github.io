/* The request-line board: six line keys and OPEN.
   Picking a line shows that caller on this page. OPEN starts Night 1.
   No audio. The lamp blink is CSS and stops under prefers-reduced-motion. */
(function () {
  'use strict';

  var board = document.querySelector('[data-board]');
  if (!board) return;

  var CALLERS = {
    dale: { name: 'Dale', line: 'Long-haul. Home two nights a week. Opens the show.' },
    marisol: { name: 'Marisol', line: 'Night nurse, county hospital, fourth floor.' },
    june: { name: 'June', line: 'Eighty-one. A widow. Has called since 2009.' },
    teddy: { name: 'Teddy', line: 'Nineteen. Overnight at a gas station. Records everything.' },
    lorraine: { name: 'Lorraine', line: 'Fire lookout. Stayed past the season.' },
    quiet: { name: 'The quiet man', line: 'Unknown. Calls three times a season and says almost nothing.' }
  };

  var keys = Array.prototype.slice.call(board.querySelectorAll('.key[data-caller]'));
  var open = board.querySelector('[data-open]');
  var out = board.querySelector('[data-board-out]');

  board.hidden = false;

  // Roving tabindex: one line key in the tab order, arrows move between them.
  function setRoving(active) {
    keys.forEach(function (k) { k.tabIndex = k === active ? 0 : -1; });
  }
  setRoving(keys[0]);

  function show(key) {
    var id = key.getAttribute('data-caller');
    var c = CALLERS[id];
    keys.forEach(function (k) { k.setAttribute('aria-pressed', String(k === key)); });
    setRoving(key);

    // Reuse the strip's photo and alt text so the board and the strip agree.
    var src = document.querySelector('#caller-' + id + ' img');
    out.textContent = '';
    var fig = document.createElement('figure');
    fig.className = 'board-caller';
    if (src) {
      var img = document.createElement('img');
      img.src = src.getAttribute('src');
      img.width = 960;
      img.height = 536;
      img.alt = src.getAttribute('alt');
      fig.appendChild(img);
    }
    var cap = document.createElement('figcaption');
    var label = document.createElement('span');
    label.className = 'board-line';
    label.textContent = key.querySelector('.key-n').textContent;
    var name = document.createElement('b');
    name.textContent = c.name;
    cap.appendChild(label);
    cap.appendChild(name);
    cap.appendChild(document.createTextNode(' ' + c.line));
    fig.appendChild(cap);
    out.appendChild(fig);
  }

  keys.forEach(function (key, i) {
    key.addEventListener('click', function () { show(key); });
    key.addEventListener('keydown', function (ev) {
      var next = null;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = keys[(i + 1) % keys.length];
      else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = keys[(i - 1 + keys.length) % keys.length];
      else if (ev.key === 'Home') next = keys[0];
      else if (ev.key === 'End') next = keys[keys.length - 1];
      if (next) { ev.preventDefault(); setRoving(next); next.focus(); }
    });
  });

  if (open) {
    open.addEventListener('click', function () {
      if (window.NightLantern) window.NightLantern.playNight1();
    });
  }
})();
