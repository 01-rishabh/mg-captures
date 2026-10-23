(function () {
  var S = window.STUDIO || {};
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Studio details from config.js ----------------------------------------------

  document.querySelectorAll('[data-studio]').forEach(function (el) {
    var value = S[el.getAttribute('data-studio')];
    if (value) el.textContent = value;
  });

  function waUrl(text) {
    return 'https://wa.me/' + String(S.whatsapp || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(text);
  }
  document.querySelectorAll('[data-wa-link]').forEach(function (a) {
    a.href = waUrl('Hi ' + (S.name || '') + ', I would like to know more about a photoshoot.');
    a.target = '_blank';
    a.rel = 'noopener';
  });
  document.querySelectorAll('[data-studio-ig]').forEach(function (a) {
    a.href = 'https://instagram.com/' + (S.instagram || '');
    if (a.textContent.indexOf('@') === 0) a.textContent = '@' + (S.instagram || '');
  });
  document.querySelectorAll('[data-studio-mail]').forEach(function (a) {
    if (S.email) a.href = 'mailto:' + S.email; else a.hidden = true;
  });
  document.querySelectorAll('[data-studio-tel]').forEach(function (a) {
    if (S.phone) a.href = 'tel:' + S.phone.replace(/[^\d+]/g, ''); else a.hidden = true;
  });
  document.querySelectorAll('[data-studio-map]').forEach(function (a) {
    if (S.address) a.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(S.name + ', ' + S.address); else a.hidden = true;
  });
  document.querySelectorAll('[data-founder-ig]').forEach(function (a) {
    if (!S.founderInstagram) { a.hidden = true; return; }
    a.href = 'https://instagram.com/' + S.founderInstagram;
    a.lastChild.textContent = '@' + S.founderInstagram;
  });
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  var cal = document.querySelector('[data-cal-link]');
  if (S.calLink) { cal.href = S.calLink; cal.hidden = false; }

  // ---- Theme: light by default, dark when chosen; the choice is remembered ----------------

  var themeButton = document.querySelector('.theme-toggle');
  function paintThemeButton() {
    var dark = document.documentElement.dataset.theme === 'dark';
    themeButton.querySelector('.ph').className = 'ph ' + (dark ? 'ph-sun' : 'ph-moon');
    themeButton.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }
  themeButton.addEventListener('click', function () {
    var dark = document.documentElement.dataset.theme !== 'dark';
    if (dark) document.documentElement.dataset.theme = 'dark';
    else delete document.documentElement.dataset.theme;
    try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* storage blocked: choice lasts this visit */ }
    paintThemeButton();
  });
  paintThemeButton();

  // ---- Menu ------------------------------------------------------------------------

  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');
  menu.querySelectorAll('a').forEach(function (a, i) { a.style.setProperty('--i', i); });
  function setMenu(open) {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('[data-menu-label]').textContent = open ? 'Close' : 'Menu';
    toggle.querySelector('.ph').className = 'ph ' + (open ? 'ph-x' : 'ph-list');
    document.body.classList.toggle('menu-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
  }
  toggle.addEventListener('click', function () { setMenu(menu.hidden); });
  menu.addEventListener('click', function (e) { if (e.target.tagName === 'A') setMenu(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // ---- Smooth scrolling (Lenis) -------------------------------------------------------

  // lenis.min.js is deferred, so it is ready by DOMContentLoaded. Skipped for reduced motion.
  var lenis = null;
  document.addEventListener('DOMContentLoaded', function () {
    if (reduceMotion || !window.Lenis) return;
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
  });

  // In-page links glide to their section and stop below the fixed header.
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('a[href^="#"]');
    if (!link || !lenis) return;
    var target = link.getAttribute('href') === '#top' ? 0 : document.querySelector(link.getAttribute('href'));
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: target === 0 ? 0 : -72 });
    history.replaceState(null, '', link.getAttribute('href'));
  });

  // ---- Header: solid once the hero has scrolled past ---------------------------------

  var header = document.querySelector('.site-header');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      header.classList.toggle('is-solid', !entries[0].isIntersecting);
    }, { rootMargin: '-72px 0px 0px 0px' }).observe(document.querySelector('.hero'));
  } else {
    header.classList.add('is-solid');
  }

  // ---- Word-by-word headline reveal ----------------------------------------------------

  // Wraps each word in a mask so it can slide up; nested <em> keeps its styling.
  function splitWords(el) {
    var n = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 1) { walk(child); return; }
        if (child.nodeType !== 3) return;
        var frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          var word = document.createElement('span');
          var inner = document.createElement('span');
          word.className = 'word';
          inner.className = 'word-inner';
          inner.textContent = part;
          inner.style.setProperty('--w', n++);
          word.appendChild(inner);
          frag.appendChild(word);
        });
        node.replaceChild(frag, child);
      });
    })(el);
  }
  document.querySelectorAll('[data-split]').forEach(splitWords);

  // ---- Scroll reveal and mobile bar --------------------------------------------------

  var revealed = document.querySelectorAll('[data-reveal], [data-split], [data-reveal-img]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    revealed.forEach(function (el) { revealObserver.observe(el); });
  } else {
    revealed.forEach(function (el) { el.classList.add('is-in'); });
  }

  // The bottom bar's "Book consultation" is redundant while the form is on screen.
  var bar = document.querySelector('.mobile-bar');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      bar.classList.toggle('is-away', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe(document.getElementById('book'));
  }

  // ---- Services: picking a strip preselects that shoot type in the form ----------------

  document.querySelectorAll('.strip').forEach(function (strip) {
    strip.addEventListener('click', function () {
      var radio = form.querySelector('input[name="shootType"][value="' + strip.getAttribute('data-shoot') + '"]');
      if (radio) radio.checked = true;
    });
  });

  // ---- Work: filters and lightbox ----------------------------------------------------

  var shots = Array.prototype.slice.call(document.querySelectorAll('.shot'));
  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      var filter = button.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
      shots.forEach(function (shot) {
        var show = filter === 'all' || shot.getAttribute('data-cat') === filter;
        shot.classList.toggle('is-hiding', !show);
        shot.classList.toggle('is-showing', show);
      });
    });
  });

  var lightbox = document.querySelector('.lightbox');
  var lbImg = lightbox.querySelector('img');
  var current = 0;
  function visibleShots() { return shots.filter(function (s) { return !s.classList.contains('is-hiding'); }); }
  function largeSrc(img) {
    return img.src.replace(/\/(\d+)\/(\d+)$/, function (_, w, h) { return '/' + w * 2 + '/' + h * 2; });
  }
  function showShot(index) {
    var list = visibleShots();
    current = (index + list.length) % list.length;
    var img = list[current].querySelector('img');
    lbImg.src = largeSrc(img);
    lbImg.alt = img.alt;
  }
  shots.forEach(function (shot) {
    shot.addEventListener('click', function () {
      showShot(visibleShots().indexOf(shot));
      lightbox.showModal();
      if (lenis) lenis.stop();
    });
  });
  lightbox.addEventListener('close', function () { if (lenis) lenis.start(); });
  lightbox.querySelector('.lb-close').addEventListener('click', function () { lightbox.close(); });
  lightbox.querySelector('.lb-prev').addEventListener('click', function () { showShot(current - 1); });
  lightbox.querySelector('.lb-next').addEventListener('click', function () { showShot(current + 1); });
  lightbox.addEventListener('click', function (e) { if (e.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') showShot(current + 1);
    if (e.key === 'ArrowLeft') showShot(current - 1);
  });
  var swipeX = null;
  lightbox.addEventListener('pointerdown', function (e) { swipeX = e.clientX; });
  lightbox.addEventListener('pointerup', function (e) {
    if (swipeX === null) return;
    var dx = e.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 50) showShot(current + (dx < 0 ? 1 : -1));
  });

  // ---- Background video loops --------------------------------------------------------

  // Skipped for reduced motion and data-saver visitors: the photo underneath stays.
  var saveData = navigator.connection && navigator.connection.saveData;
  function backgroundVideo(container, url) {
    if (!url || reduceMotion || saveData) return;
    var video = document.createElement('video');
    video.muted = true;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('aria-hidden', 'true');
    video.preload = 'auto';
    video.src = url;
    video.addEventListener('playing', function () { container.classList.add('has-video'); });
    container.appendChild(video);
    var playing = video.play();
    if (playing) playing.catch(function () { /* autoplay blocked: the photo stays visible */ });
  }
  backgroundVideo(document.querySelector('.hero-media'), S.heroVideo);

  // The closing band is far down the page, so its video only loads when it gets close.
  var band = document.querySelector('.band');
  if (S.bandVideo && 'IntersectionObserver' in window) {
    var bandObserver = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      bandObserver.disconnect();
      backgroundVideo(band, S.bandVideo);
    }, { rootMargin: '600px 0px' });
    bandObserver.observe(band);
  } else {
    backgroundVideo(band, S.bandVideo);
  }

  // ---- Films -----------------------------------------------------------------------

  var films = (S.films || []).filter(function (f) { return f && (f.src || /^[\w-]{11}$/.test(f.youtube || '')); });
  if (films.length) {
    var filmGrid = document.querySelector('[data-films]');
    filmGrid.setAttribute('data-count', String(Math.min(films.length, 4)));
    films.forEach(function (film) { filmGrid.appendChild(filmTile(film)); });
    document.getElementById('films').hidden = false;
    document.querySelector('[data-films-link]').hidden = false;
  }

  // Shows the poster with a play button; the player (or YouTube iframe) loads only on click.
  function filmTile(film) {
    var figure = document.createElement('figure');
    figure.className = 'film';
    var media = document.createElement('div');
    media.className = 'film-media';

    var play = document.createElement('button');
    play.type = 'button';
    play.className = 'film-play';
    play.setAttribute('aria-label', 'Play film: ' + (film.title || 'film'));
    var poster = document.createElement('img');
    poster.src = film.poster || (film.youtube ? 'https://i.ytimg.com/vi/' + film.youtube + '/hqdefault.jpg' : '');
    poster.alt = '';
    poster.loading = 'lazy';
    var icon = document.createElement('span');
    icon.className = 'play-icon';
    icon.innerHTML = '<i class="ph ph-play" aria-hidden="true"></i>';
    play.appendChild(poster);
    play.appendChild(icon);
    media.appendChild(play);

    play.addEventListener('click', function () {
      var player;
      if (film.youtube) {
        player = document.createElement('iframe');
        player.src = 'https://www.youtube-nocookie.com/embed/' + film.youtube + '?autoplay=1&rel=0';
        player.title = film.title || 'Film';
        player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
        player.allowFullscreen = true;
      } else {
        player = document.createElement('video');
        player.src = film.src;
        player.controls = true;
        player.autoplay = true;
        player.playsInline = true;
        if (film.poster) player.poster = film.poster;
      }
      media.replaceChild(player, play);
      player.focus();
    });

    var caption = document.createElement('figcaption');
    var title = document.createElement('h3');
    title.textContent = film.title || '';
    caption.appendChild(title);
    if (film.caption) {
      var text = document.createElement('p');
      text.textContent = film.caption;
      caption.appendChild(text);
    }
    figure.appendChild(media);
    figure.appendChild(caption);
    return figure;
  }

  // ---- Lead source -----------------------------------------------------------------

  // A tagged link (utm_source) always wins; otherwise the source seen earlier in this
  // visit is kept so a reload does not reset it to "direct".
  var params = new URLSearchParams(location.search);
  var tagged = params.get('utm_source') || params.get('src');
  var tracking = {
    source: tagged || (document.referrer && new URL(document.referrer).host !== location.host ? new URL(document.referrer).hostname : 'direct'),
    campaign: params.get('utm_campaign') || '',
  };
  try {
    var saved = JSON.parse(sessionStorage.getItem('lead-tracking') || 'null');
    if (saved && !tagged && tracking.source === 'direct') tracking = saved;
    else sessionStorage.setItem('lead-tracking', JSON.stringify(tracking));
  } catch (e) { /* storage blocked: use this page's values */ }

  // ---- Booking form: four steps ------------------------------------------------------

  var form = document.getElementById('booking-form');
  var steps = form.querySelectorAll('.step');
  var progressItems = form.querySelectorAll('.progress li');
  var progressFill = form.querySelector('.progress-bar span');
  var errorBox = form.querySelector('.form-error');
  var backButton = form.querySelector('[data-back]');
  var nextButton = form.querySelector('[data-next]');
  var NEXT_LABELS = ['Continue', 'Continue', 'Review', 'Send request'];
  var step = 0;
  var today = new Date().toISOString().slice(0, 10);
  form.consultDate.min = today;
  form.eventDate.min = today;

  // Returns digits with country code, assuming India for 10-digit numbers.
  function normalisePhone(text) {
    var d = text.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '0') d = d.slice(1);
    if (d.length === 10) d = '91' + d;
    return d.length >= 11 && d.length <= 15 ? d : '';
  }

  function prettyDate(value) {
    if (!value) return '';
    return new Date(value + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function validateStep(n) {
    var problems = [];
    steps[n].querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
    function bad(el, msg) { el.setAttribute('aria-invalid', 'true'); problems.push(msg); }
    function group(name) { return form.querySelector('[data-group="' + name + '"]'); }

    if (n === 0) {
      if (!form.name.value.trim()) bad(form.name, 'your name');
      if (!normalisePhone(form.whatsapp.value)) bad(form.whatsapp, 'a valid WhatsApp number');
      if (form.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.value.trim())) bad(form.email, 'a valid email');
    }
    if (n === 1 && !form.shootType.value) bad(group('shootType'), 'the shoot type');
    if (n === 2) {
      if (!form.consultDate.value || form.consultDate.value < today) bad(form.consultDate, 'a consultation date');
      if (!form.consultTime.value) bad(group('consultTime'), 'a consultation time');
    }

    errorBox.hidden = !problems.length;
    if (problems.length) {
      errorBox.textContent = 'Please add ' + problems.join(', ') + '.';
      var first = steps[n].querySelector('[aria-invalid]');
      (first.matches('input, textarea') ? first : first.querySelector('input')).focus();
    }
    return !problems.length;
  }

  function goTo(n) {
    steps[step].hidden = true;
    step = n;
    var el = steps[step];
    el.hidden = false;
    if (!reduceMotion) {
      el.classList.add('is-entering');
      el.addEventListener('animationend', function () { el.classList.remove('is-entering'); }, { once: true });
    }
    progressItems.forEach(function (li, i) {
      li.classList.toggle('done', i < step);
      if (i === step) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    progressFill.style.width = (step + 1) * 25 + '%';
    backButton.hidden = step === 0;
    nextButton.textContent = NEXT_LABELS[step];
    errorBox.hidden = true;
    if (step === 3) buildSummary();

    var top = form.getBoundingClientRect().top;
    if (top < 0) form.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    el.querySelector('legend').focus({ preventScroll: true });
  }

  function collectLead() {
    return {
      name: form.name.value.trim(),
      whatsapp: normalisePhone(form.whatsapp.value),
      email: form.email.value.trim(),
      shootType: form.shootType.value,
      eventDate: form.eventDate.value,
      location: form.location.value.trim(),
      budget: form.budget.value,
      consultMode: form.consultMode.value,
      consultDate: form.consultDate.value,
      consultTime: form.consultTime.value,
      message: form.message.value.trim(),
      source: tracking.source,
      campaign: tracking.campaign,
    };
  }

  // Review step. Built with textContent so typed values are never parsed as HTML.
  function buildSummary() {
    var lead = collectLead();
    var rows = [
      ['Name', lead.name, 0],
      ['WhatsApp', '+' + lead.whatsapp, 0],
      ['Email', lead.email, 0],
      ['Shoot', [lead.shootType, prettyDate(lead.eventDate), lead.location].filter(Boolean).join(', '), 1],
      ['Budget', lead.budget || 'Not sure yet', 1],
      ['Consultation', [lead.consultMode, prettyDate(lead.consultDate), lead.consultTime].filter(Boolean).join(', '), 2],
      ['Notes', lead.message, 2],
    ];
    var dl = form.querySelector('[data-summary]');
    dl.textContent = '';
    var lastStep = -1;
    rows.forEach(function (row) {
      if (!row[1]) return;
      var dt = document.createElement('dt');
      var dd = document.createElement('dd');
      dt.textContent = row[0];
      dd.textContent = row[1];
      if (row[2] !== lastStep) {
        var edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Edit';
        edit.setAttribute('aria-label', 'Edit ' + row[0].toLowerCase());
        edit.addEventListener('click', function () { goTo(row[2]); });
        dd.appendChild(edit);
        lastStep = row[2];
      }
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
  }

  backButton.addEventListener('click', function () { goTo(step - 1); });

  // Enter on any step moves forward; only the review step actually sends.
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (step < 3) {
      if (validateStep(step)) goTo(step + 1);
      return;
    }
    var lead = collectLead();
    nextButton.disabled = true;
    nextButton.textContent = 'Sending…';

    // The trap value travels with the lead instead of blocking it here: autofill and password
    // managers can fill hidden fields, and a dropped request is a lost real client.
    lead.trap = form.elements.hpx_mg.value;
    send(lead)
      .then(function (res) {
        console.info('[Booking] Saved to the sheet as ' + res.leadId);
        showThanks(res.leadId, lead);
      })
      .catch(function (err) {
        console.error('[Booking] Not saved:', err);
        errorBox.textContent = 'Could not send right now. Please message us on WhatsApp instead.';
        errorBox.hidden = false;
      })
      .finally(function () {
        nextButton.disabled = false;
        nextButton.textContent = NEXT_LABELS[step];
      });
  });

  // text/plain keeps this a simple CORS request, which Apps Script can answer.
  function send(lead) {
    if (!S.endpoint) {
      console.info('[Demo mode] endpoint is empty in config.js. Lead:', lead);
      return new Promise(function (resolve) { setTimeout(function () { resolve({ ok: true, leadId: 'DEMO-0001' }); }, 800); });
    }
    return fetch(S.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'lead', data: lead }),
    })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (body) {
        if (!body.ok || !body.leadId) throw new Error(body.error || 'The sheet did not return a reference');
        return body;
      });
  }

  function showThanks(leadId, lead) {
    var thanks = document.getElementById('thanks');
    thanks.querySelector('[data-ref]').textContent = leadId || '';
    thanks.querySelector('[data-ref-line]').hidden = !leadId;
    thanks.querySelector('[data-wa-thanks]').href = waUrl(
      'Hi, I just requested a ' + lead.shootType + ' consultation' + (leadId ? ' (ref ' + leadId + ')' : '') +
      ' for ' + prettyDate(lead.consultDate) + ', ' + lead.consultTime + '. My name is ' + lead.name + '.'
    );
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    thanks.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
  }
})();
