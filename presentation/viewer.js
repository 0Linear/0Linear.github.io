/*
 * Presentation viewer
 *
 * Shows the slide images listed in slides.json (made by
 * scripts/render-slides.py) with PowerPoint-style controls:
 *  - normal view: slide list, current slide, Present / All slides buttons
 *  - slide show: full screen, keyboard / click / swipe navigation, black and
 *    white screens, laser pointer, "go to slide" by number, end screen
 * The current slide is kept in the address (#3) so links and reloads land on it.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var app = $('app');
  var stage = $('stage');
  var layers = [$('slide-a'), $('slide-b')];
  var endScreen = $('end-screen');
  var cover = $('screen-cover');
  var laser = $('laser');
  var jump = $('jump');
  var sorter = $('sorter');
  var help = $('help');

  var deck = null;
  var current = 0;
  var activeLayer = 0;
  var atEnd = false;
  var laserOn = false;
  var jumpBuffer = '';
  var jumpTimer = null;
  var idleTimer = null;
  var wheelLock = 0;
  var pointerStart = null;

  var isPresenting = function () { return app.getAttribute('data-mode') === 'present'; };
  var count = function () { return deck ? deck.slides.length : 0; };

  /*
   * Rendering
   */
  function show(index, animate) {
    if (!deck) {
      return;
    }

    index = Math.max(0, Math.min(count() - 1, index));
    var changed = index !== current;
    current = index;
    atEnd = false;
    endScreen.hidden = true;

    var slide = deck.slides[index];
    var next = layers[1 - activeLayer];
    var prev = layers[activeLayer];

    if (changed || !prev.getAttribute('src')) {
      if (animate === false) {
        prev.src = slide.src;
        prev.alt = slide.title;
      } else {
        next.onload = function () {
          next.classList.add('is-active');
          prev.classList.remove('is-active');
          activeLayer = 1 - activeLayer;
        };
        next.alt = slide.title;
        next.src = slide.src;
      }
    }

    $('counter').textContent = (index + 1) + ' / ' + count();
    $('slide-title').textContent = slide.title;
    $('btn-prev').disabled = index === 0;
    $('btn-next').disabled = index === count() - 1 && !isPresenting();
    $('progress-bar').style.width = ((index + 1) / count() * 100) + '%';

    document.querySelectorAll('.thumb, .card').forEach(function (el) {
      el.classList.toggle('is-active', Number(el.getAttribute('data-index')) === index);
    });
    var thumb = document.querySelector('.thumb.is-active');
    if (thumb && !isPresenting()) {
      thumb.scrollIntoView({block: 'nearest'});
    }

    var hash = '#' + (index + 1);
    if (location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }

  function next() {
    if (atEnd) {
      stopPresenting();
    } else if (current < count() - 1) {
      show(current + 1);
    } else if (isPresenting()) {
      atEnd = true;
      endScreen.hidden = false;
    }
  }

  function prev() {
    if (atEnd) {
      atEnd = false;
      endScreen.hidden = true;
    } else {
      show(current - 1);
    }
  }

  /*
   * Slide show mode
   */
  function startPresenting(fromStart) {
    closeOverlays();
    app.setAttribute('data-mode', 'present');
    show(fromStart ? 0 : current, false);
    var el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen().catch(function () {
        // Full screen can be refused (e.g. inside a frame); present in the window
      });
    }
    wakeControls();
  }

  function stopPresenting() {
    if (!isPresenting()) {
      return;
    }
    app.setAttribute('data-mode', 'normal');
    app.classList.remove('is-idle');
    setCover(null);
    setLaser(false);
    atEnd = false;
    endScreen.hidden = true;
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    show(current, false);
  }

  function wakeControls() {
    app.classList.remove('is-idle');
    clearTimeout(idleTimer);
    if (isPresenting()) {
      idleTimer = setTimeout(function () {
        app.classList.add('is-idle');
      }, 2200);
    }
  }

  function setCover(color) {
    var same = !cover.hidden && cover.classList.contains('is-white') === (color === 'white');
    if (!color || same) {
      cover.hidden = true;
    } else {
      cover.hidden = false;
      cover.classList.toggle('is-white', color === 'white');
    }
  }

  function setLaser(on) {
    laserOn = on;
    stage.classList.toggle('has-laser', on);
    $('btn-laser').classList.toggle('is-on', on);
    if (!on) {
      laser.hidden = true;
    }
  }

  /*
   * Overlays
   */
  function openOverlay(el) {
    closeOverlays();
    el.hidden = false;
    if (el === sorter) {
      var active = sorter.querySelector('.card.is-active');
      if (active) {
        active.scrollIntoView({block: 'center'});
        active.focus({preventScroll: true});
      }
    }
  }

  function closeOverlays() {
    sorter.hidden = true;
    help.hidden = true;
  }

  function overlayOpen() {
    return !sorter.hidden || !help.hidden;
  }

  /*
   * Building the page from slides.json
   */
  function build(data) {
    deck = data;
    document.title = data.title;
    $('deck-title').textContent = data.title;
    $('deck-meta').textContent = data.slides.length + ' slides';

    var first = data.slides[0];
    if (first && first.width && first.height) {
      document.documentElement.style.setProperty('--ratio', first.width + ' / ' + first.height);
    }

    var rail = $('rail');
    var grid = $('sorter-grid');
    data.slides.forEach(function (slide, i) {
      var t = document.createElement('button');
      t.type = 'button';
      t.className = 'thumb';
      t.setAttribute('data-index', i);
      t.title = slide.title;
      t.innerHTML = '<span class="thumb-num">' + (i + 1) + '</span><img loading="lazy" alt="">';
      t.querySelector('img').src = slide.thumb;
      t.addEventListener('click', function () { show(i); });
      rail.appendChild(t);

      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'card';
      c.setAttribute('data-index', i);
      c.innerHTML = '<img loading="lazy" alt=""><span class="card-label"><b></b><span></span></span>';
      c.querySelector('img').src = slide.thumb;
      c.querySelector('b').textContent = i + 1;
      c.querySelector('.card-label span').textContent = slide.title;
      c.addEventListener('click', function () {
        closeOverlays();
        show(i);
      });
      grid.appendChild(c);
    });

    var fromHash = parseInt(location.hash.slice(1), 10);
    current = -1;
    show(isNaN(fromHash) ? 0 : fromHash - 1, false);

    // Warm the cache so every slide appears instantly
    data.slides.forEach(function (slide) {
      var img = new Image();
      img.src = slide.src;
    });
  }

  /*
   * Input
   */
  function onKey(ev) {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) {
      return;
    }

    var key = ev.key;

    if (overlayOpen()) {
      if (key === 'Escape' || (key === 'g' && !sorter.hidden) || (key === '?' && !help.hidden)) {
        closeOverlays();
        ev.preventDefault();
      }
      return;
    }

    if (key === 'F5') {
      startPresenting(!ev.shiftKey);
    } else if (/^[0-9]$/.test(key)) {
      jumpBuffer = (jumpBuffer + key).slice(-3);
      jump.textContent = 'Go to ' + jumpBuffer;
      jump.hidden = false;
      clearTimeout(jumpTimer);
      jumpTimer = setTimeout(clearJump, 2500);
    } else if (key === 'Enter' && jumpBuffer) {
      show(parseInt(jumpBuffer, 10) - 1);
      clearJump();
    } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].indexOf(key) !== -1) {
      if ((key === 'Enter' || key === ' ') && ev.target.tagName === 'BUTTON') {
        return;
      }
      next();
    } else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].indexOf(key) !== -1) {
      prev();
    } else if (key === 'Home') {
      show(0);
    } else if (key === 'End') {
      show(count() - 1);
    } else if (key === 'g' || key === 'G') {
      openOverlay(sorter);
    } else if (key === '?') {
      openOverlay(help);
    } else if (key === 'Escape') {
      if (jumpBuffer) {
        clearJump();
      } else {
        stopPresenting();
      }
    } else if (isPresenting() && (key === 'b' || key === 'B' || key === '.')) {
      setCover('black');
    } else if (isPresenting() && (key === 'w' || key === 'W' || key === ',')) {
      setCover('white');
    } else if (isPresenting() && (key === 'l' || key === 'L')) {
      setLaser(!laserOn);
    } else {
      return;
    }

    ev.preventDefault();
    if (isPresenting()) {
      wakeControls();
    }
  }

  function clearJump() {
    jumpBuffer = '';
    jump.hidden = true;
    clearTimeout(jumpTimer);
  }

  document.addEventListener('keydown', onKey);

  $('btn-prev').addEventListener('click', prev);
  $('btn-next').addEventListener('click', next);
  $('btn-present').addEventListener('click', function () { startPresenting(false); });
  $('btn-fullscreen').addEventListener('click', function () { startPresenting(false); });
  $('btn-exit').addEventListener('click', stopPresenting);
  $('btn-sorter').addEventListener('click', function () { openOverlay(sorter); });
  $('btn-sorter-2').addEventListener('click', function () { openOverlay(sorter); });
  $('btn-help').addEventListener('click', function () { openOverlay(help); });
  $('btn-laser').addEventListener('click', function () { setLaser(!laserOn); });

  document.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', closeOverlays);
  });
  help.addEventListener('click', function (ev) {
    if (ev.target === help) {
      closeOverlays();
    }
  });

  // Leaving full screen (Esc handled by the browser) ends the slide show
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) {
      stopPresenting();
    }
  });

  // Click to advance, swipe on touch screens
  stage.addEventListener('pointerdown', function (ev) {
    pointerStart = {x: ev.clientX, y: ev.clientY, type: ev.pointerType};
  });

  stage.addEventListener('pointerup', function (ev) {
    if (!pointerStart) {
      return;
    }
    var dx = ev.clientX - pointerStart.x;
    var dy = ev.clientY - pointerStart.y;
    var type = pointerStart.type;
    pointerStart = null;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        next();
      } else {
        prev();
      }
    } else if (isPresenting() && type === 'mouse' && ev.button === 0 && Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      if (!cover.hidden) {
        setCover(null);
      } else {
        next();
      }
    }
  });

  stage.addEventListener('wheel', function (ev) {
    if (ev.ctrlKey || Math.abs(ev.deltaY) < 8) {
      return;
    }
    ev.preventDefault();
    var now = Date.now();
    if (now - wheelLock > 450) {
      wheelLock = now;
      if (ev.deltaY > 0) {
        next();
      } else {
        prev();
      }
    }
  }, {passive: false});

  stage.addEventListener('mousemove', function (ev) {
    if (laserOn) {
      var r = stage.getBoundingClientRect();
      laser.hidden = false;
      laser.style.left = (ev.clientX - r.left) + 'px';
      laser.style.top = (ev.clientY - r.top) + 'px';
    }
  });

  stage.addEventListener('mouseleave', function () {
    laser.hidden = true;
  });

  document.addEventListener('mousemove', function () {
    if (isPresenting()) {
      wakeControls();
    }
  });

  window.addEventListener('hashchange', function () {
    var n = parseInt(location.hash.slice(1), 10);
    if (!isNaN(n) && n - 1 !== current) {
      show(n - 1);
    }
  });

  fetch('slides.json', {cache: 'no-cache'})
    .then(function (r) {
      if (!r.ok) {
        throw new Error(r.status);
      }
      return r.json();
    })
    .then(build)
    .catch(function () {
      $('load-error').hidden = false;
      $('deck-meta').textContent = '';
    });
}());
