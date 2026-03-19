(function () {
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return document.querySelectorAll(s); };
  var CIRC = 2 * Math.PI * 18;
  var EFFECT_CIRC = 2 * Math.PI * 11;
  var inEditMode = false;
  var dragTarget = null;
  var dragOffset = { x: 0, y: 0 };

  // Money auto-hide
  var moneyHideTimer = null;
  var moneyVisible = false;

  // Progress bar state
  var progressTimer = null;
  var progressRAF = null;

  // Effects state
  var renderedEffects = {};
  var effectTimers = {};

  var els = {
    container: $('.container'),
    id: $('.id'),
    idBadge: $('#id-badge'),
    job: $('.job'),
    jobrp: $('.jobrp'),
    speedo: $('.speedo'),
    speed: $('.speed'),
    speedUnit: $('.speed-unit'),
    engine: $('.engine'),
    light: $('.light'),
    limiter: $('.limiter'),
    seatbeltIcon: $('.seatbelt-icon'),
    harnessIcon: $('.harness-icon'),
    lockIcon: $('.lock-icon'),
    nosIcon: $('.nos-icon'),
    progressBar: $('.progressBar'),
    statusPanel: $('#status-panel'),
    voiceIndicator: $('#voice-indicator'),
    voiceBars: $$('.voice-bar'),
    gearValue: $('.gear-value'),
    gearContainer: $('.speedo-gear'),
    cruiseSpeed: $('.cruise-speed'),
    cruiseValue: $('.cruise-value'),
    streetName: $('.street-name'),
    directionBadge: $('.direction-badge'),
    compassContainer: $('.speedo-compass'),
    fuelBar: $('.fuel-bar'),
    fuelFill: $('.fuel-fill'),
    fuelText: $('.fuel-text'),
    crashOverlay: $('.crash-overlay'),
    drugOverlay: $('.drug-overlay'),
    damageBars: $('.damage-bars'),
    engineDamage: $('.engine-damage'),
    bodyDamage: $('.body-damage'),
    signalRow: $('.signal-row'),
    signalLeft: $('.signal-left'),
    signalRight: $('.signal-right'),
    signalHazard: $('.signal-hazard'),
    radioStat: $('.radio-stat'),
    radioChannel: $('.radio-channel'),
    notifContainer: $('#notif-container'),
    editBanner: $('.edit-banner'),
    weaponBar: $('#weapon-bar'),
    ammoClip: $('.ammo-clip'),
    ammoReserve: $('.ammo-reserve'),
    ammoBarFill: $('.ammo-bar-fill'),
    staminaVignette: $('.stamina-vignette'),
    moneyPanel: $('#money-panel'),
    moneyCashValue: $('.money-cash-value'),
    moneyBankValue: $('.money-bank-value'),
    moneyCashChange: $('.money-cash-change'),
    moneyBankChange: $('.money-bank-change'),
    effectsContainer: $('#effects-container'),
    progressContainer: $('#progress-container'),
    progressLabel: $('.progress-label'),
    progressFill: $('.progress-fill'),
    settingsOverlay: $('#settings-overlay'),
    settingsPanel: $('#settings-panel'),
    settingsCloseBtn: $('#settings-close-btn'),
    settingsSaveBtn: $('#settings-save-btn'),
    // Compass bar
    compassBar: $('#compass-bar'),
    compassTrack: $('#compass-track'),
    compassWaypoint: $('#compass-waypoint'),
    compassStreet: $('#compass-street'),
    compassZone: $('#compass-zone'),
    compassPostal: $('#compass-postal'),
    // Screen effects
    healthVignette: $('#health-vignette'),
    underwaterOverlay: $('#underwater-overlay'),
    stressOverlay: $('#stress-overlay'),
    // Circular progress
    circularProgress: $('#circular-progress'),
    circularLabel: $('#circular-label'),
    circularIcon: $('#circular-icon'),
    circularFill: null, // set after init
  };

  // Circular progress SVG constants
  var CIRC_PROGRESS_R = 50;
  var CIRC_PROGRESS_CIRC = 2 * Math.PI * CIRC_PROGRESS_R;
  var circularTimer = null;
  var circularRAF = null;

  // Init circular progress fill reference
  var circFillEl = $('.circular-fill-circle');
  if (circFillEl) {
    circFillEl.style.strokeDasharray = CIRC_PROGRESS_CIRC;
    circFillEl.style.strokeDashoffset = CIRC_PROGRESS_CIRC;
    els.circularFill = circFillEl;
  }

  // Build compass track marks (0-359 in 5 degree steps, repeated for seamless scrolling)
  var compassCardinals = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  var compassBuilt = false;
  function buildCompassTrack() {
    if (compassBuilt) return;
    compassBuilt = true;
    var track = els.compassTrack;
    // Build 720 degrees worth (0-719) so we can seamlessly wrap
    var html = '<div class="compass-center-line"></div>';
    for (var deg = 0; deg < 720; deg += 5) {
      var realDeg = deg % 360;
      var isCardinal = compassCardinals[realDeg] !== undefined;
      var cls = 'compass-mark' + (isCardinal ? ' cardinal' : '');
      var label = isCardinal ? compassCardinals[realDeg] : '';
      var showDeg = (realDeg % 15 === 0 && !isCardinal);
      html += '<div class="' + cls + '">' +
        (label ? '<span>' + label + '</span>' : '') +
        '<span class="compass-tick"></span>' +
        (showDeg ? '<span class="compass-deg">' + realDeg + '</span>' : '') +
      '</div>';
    }
    track.innerHTML = html;
    // Re-add center line to the strip parent
    var strip = track.parentElement;
    if (!strip.querySelector('.compass-center-line')) {
      var cl = document.createElement('div');
      cl.className = 'compass-center-line';
      strip.appendChild(cl);
    }
  }

  var prevCompassHeading = -1;
  function updateCompass(heading, street, zone, postal, waypoint) {
    if (!compassBuilt) buildCompassTrack();
    els.compassBar.style.display = '';

    // GTA heading: 0=N, clockwise. Compass: 0=N at center.
    // Each 5deg = 40px mark width. 360deg = 72 marks * 40px = 2880px
    // We want heading at center of 400px strip => offset = heading/5 * 40 - 200
    var pixelsPerDeg = 40 / 5; // 8px per degree
    var totalWidth = 360 * pixelsPerDeg; // 2880px
    var normalizedHeading = (360 - heading) % 360; // invert because GTA heading is CW
    var offset = normalizedHeading * pixelsPerDeg - 200;
    // Wrap for seamless
    if (offset < 0) offset += totalWidth;
    els.compassTrack.style.transform = 'translateX(-' + offset.toFixed(1) + 'px)';

    els.compassStreet.textContent = street || '';
    els.compassZone.textContent = zone || '';
    els.compassPostal.textContent = postal || '';

    // Waypoint indicator
    if (waypoint >= 0) {
      els.compassWaypoint.style.display = '';
      var wpNorm = (360 - waypoint) % 360;
      var diff = wpNorm - normalizedHeading;
      // Normalize diff to -180..180
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      var wpPx = 200 + diff * pixelsPerDeg;
      // Clamp to strip bounds
      if (wpPx >= 0 && wpPx <= 400) {
        els.compassWaypoint.style.left = wpPx + 'px';
        els.compassWaypoint.style.opacity = '1';
      } else {
        // Show at edge with reduced opacity
        els.compassWaypoint.style.left = (wpPx < 0 ? 4 : 396) + 'px';
        els.compassWaypoint.style.opacity = '0.4';
      }
    } else {
      els.compassWaypoint.style.display = 'none';
    }
  }

  // Circular progress icon SVGs
  var circularIcons = {
    timer: '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.962 8.962 0 0012 4c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>',
    wrench: '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
  };

  function startCircularProgress(duration, label, icon, color) {
    if (circularTimer) { clearTimeout(circularTimer); circularTimer = null; }
    if (circularRAF) { cancelAnimationFrame(circularRAF); circularRAF = null; }

    els.circularProgress.classList.remove('hiding');
    els.circularProgress.style.display = 'flex';
    els.circularLabel.textContent = label || '';
    els.circularIcon.innerHTML = circularIcons[icon] || circularIcons.timer;
    if (color && els.circularFill) {
      els.circularFill.style.stroke = color;
    } else if (els.circularFill) {
      els.circularFill.style.stroke = 'var(--accent-blue)';
    }
    if (els.circularFill) {
      els.circularFill.style.strokeDashoffset = CIRC_PROGRESS_CIRC;
    }

    var start = performance.now();
    function tick(now) {
      var elapsed = now - start;
      var pct = Math.min(1, elapsed / duration);
      if (els.circularFill) {
        els.circularFill.style.strokeDashoffset = CIRC_PROGRESS_CIRC * (1 - pct);
      }
      if (pct < 1) {
        circularRAF = requestAnimationFrame(tick);
      }
    }
    circularRAF = requestAnimationFrame(tick);

    circularTimer = setTimeout(function () {
      if (els.circularFill) els.circularFill.style.strokeDashoffset = '0';
      if (circularRAF) { cancelAnimationFrame(circularRAF); circularRAF = null; }
      setTimeout(function () {
        hideCircularProgress();
        if (typeof fetch !== 'undefined') {
          fetch('https://dei_hud/circularProgressComplete', { method: 'POST', body: JSON.stringify({}) });
        }
      }, 200);
    }, duration);
  }

  function hideCircularProgress() {
    if (circularTimer) { clearTimeout(circularTimer); circularTimer = null; }
    if (circularRAF) { cancelAnimationFrame(circularRAF); circularRAF = null; }
    els.circularProgress.classList.add('hiding');
    setTimeout(function () {
      els.circularProgress.style.display = 'none';
      els.circularProgress.classList.remove('hiding');
      if (els.circularFill) els.circularFill.style.strokeDashoffset = CIRC_PROGRESS_CIRC;
    }, 300);
  }

  // Critical/warning state tracking
  var prevCritical = {};
  function updateCriticalWarnings(d) {
    var critHealth = d.criticalHealth || 25;
    var warnHunger = d.warningHunger || 20;
    var warnThirst = d.warningThirst || 20;
    var stressEffects = d.stressEffects !== false;

    // Health critical
    var healthCrit = d.health < critHealth;
    if (stats.health) stats.health.el.classList.toggle('critical', healthCrit);
    // Health vignette
    if (healthCrit) {
      var intensity = (critHealth - d.health) / critHealth;
      els.healthVignette.style.setProperty('--vignette-intensity', (intensity * 0.6).toFixed(2));
      els.healthVignette.classList.add('active');
      els.healthVignette.style.opacity = '1';
    } else {
      els.healthVignette.classList.remove('active');
      els.healthVignette.style.opacity = '0';
    }

    // Hunger warning
    if (stats.hunger) stats.hunger.el.classList.toggle('warning', d.hunger < warnHunger);
    // Thirst warning
    if (stats.thirst) stats.thirst.el.classList.toggle('warning', d.thirst < warnThirst);

    // Stress effects (desaturation + subtle shake)
    if (stressEffects && d.stress > 80) {
      var sIntensity = (d.stress - 80) / 20; // 0..1
      els.stressOverlay.classList.add('active');
      els.stressOverlay.style.backdropFilter = 'saturate(' + (1 - sIntensity * 0.5).toFixed(2) + ')';
      els.stressOverlay.style.webkitBackdropFilter = 'saturate(' + (1 - sIntensity * 0.5).toFixed(2) + ')';
    } else {
      els.stressOverlay.classList.remove('active');
      els.stressOverlay.style.backdropFilter = '';
      els.stressOverlay.style.webkitBackdropFilter = '';
    }

    // Underwater overlay
    if (d.underWater) {
      els.underwaterOverlay.classList.add('active');
    } else {
      els.underwaterOverlay.classList.remove('active');
    }
  }

  var stats = {};
  $$('.circle-stat').forEach(function (el) {
    var name = el.dataset.stat;
    var circle = el.querySelector('.circle-progress circle');
    circle.style.strokeDasharray = CIRC;
    circle.style.strokeDashoffset = CIRC;
    stats[name] = { el: el, progress: circle, tooltip: el.querySelector('.stat-tooltip') };
  });

  function setCircle(name, value) {
    var s = stats[name];
    if (!s) return;
    s.progress.style.strokeDashoffset = CIRC * (1 - Math.min(100, Math.max(0, value)) / 100);
    if (s.tooltip) s.tooltip.textContent = value;
  }

  function getColor(name, value) {
    if (name === 'health') return value > 60 ? '#4ade80' : value > 30 ? '#fbbf24' : '#ef4444';
    if (name === 'stress') return value > 70 ? '#ef4444' : value > 40 ? '#fbbf24' : '#a855f7';
    if (name === 'oxygen') return value > 40 ? '#38bdf8' : value > 20 ? '#fbbf24' : '#ef4444';
    var c = { armor: '#3b82f6', stamina: '#f59e0b', thirst: '#06b6d4', hunger: '#f97316' };
    return c[name] || '#fff';
  }

  function updateStat(name, value, hideWhenFull, threshold, delay) {
    var s = stats[name];
    if (!s) return;
    s.progress.style.stroke = getColor(name, value);
    setCircle(name, value);
    var hidden = hideWhenFull && value >= threshold;
    s.el.style.transitionDelay = hidden ? '0ms' : (delay || 0) + 'ms';
    s.el.style.opacity = hidden ? '0' : '1';
    s.el.style.transform = hidden ? 'scale(0.7)' : 'scale(1)';
  }

  function damageColor(v) { return v > 60 ? '#4ade80' : v > 30 ? '#fbbf24' : '#ef4444'; }

  function formatMoney(n) {
    return '$' + (n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // ===== Money HUD =====
  function showMoneyPanel() {
    if (!moneyVisible) {
      moneyVisible = true;
      els.moneyPanel.classList.add('visible');
    }
    if (moneyHideTimer) clearTimeout(moneyHideTimer);
    moneyHideTimer = setTimeout(function () {
      moneyVisible = false;
      els.moneyPanel.classList.remove('visible');
    }, 5000);
  }

  function showMoneyChange(el, diff) {
    if (diff === 0) return;
    // Remove old animation
    el.className = 'money-change';
    el.textContent = '';
    // Force reflow
    void el.offsetWidth;
    el.textContent = (diff > 0 ? '+' : '') + formatMoney(diff);
    el.classList.add(diff > 0 ? 'gain' : 'loss');
  }

  // ===== Notifications =====
  function showNotif(msg, type, duration) {
    var n = document.createElement('div');
    n.className = 'notif notif--' + (type || 'info');
    n.textContent = msg;
    els.notifContainer.appendChild(n);
    requestAnimationFrame(function () { n.classList.add('notif--show'); });
    setTimeout(function () {
      n.classList.remove('notif--show');
      setTimeout(function () { n.remove(); }, 300);
    }, duration || 4000);
  }

  // ===== Signal blink =====
  var signalInterval = null;
  function startSignalBlink(left, right, hazard) {
    if (signalInterval) clearInterval(signalInterval);
    if (!left && !right && !hazard) {
      els.signalLeft.classList.remove('blink');
      els.signalRight.classList.remove('blink');
      els.signalHazard.classList.remove('blink');
      return;
    }
    els.signalLeft.classList.toggle('blink', left || hazard);
    els.signalRight.classList.toggle('blink', right || hazard);
    els.signalHazard.classList.toggle('blink', hazard);
  }

  // ===== Effects system =====
  var effectIconSVGs = {
    pill: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M4.22 11.29l5.07-5.07a6 6 0 018.48 8.48l-5.07 5.07a6 6 0 01-8.48-8.48zM15.54 9.5l-3.54 3.54 1.41 1.41 3.54-3.54z"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z"/></svg>',
    lightning: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>'
  };

  function renderEffects(effects) {
    var container = els.effectsContainer;
    var existingIds = {};

    // Mark effects to keep
    for (var i = 0; i < effects.length; i++) {
      existingIds[effects[i].id] = true;
    }

    // Remove effects that are gone
    var keys = Object.keys(renderedEffects);
    for (var k = 0; k < keys.length; k++) {
      var id = keys[k];
      if (!existingIds[id]) {
        var pill = renderedEffects[id];
        if (pill && pill.parentNode) {
          pill.classList.add('removing');
          (function(p, eid) {
            setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); delete renderedEffects[eid]; }, 300);
          })(pill, id);
        } else {
          delete renderedEffects[id];
        }
        if (effectTimers[id]) { clearInterval(effectTimers[id]); delete effectTimers[id]; }
      }
    }

    // Add or update effects
    for (var j = 0; j < effects.length; j++) {
      var e = effects[j];
      var pill = renderedEffects[e.id];
      if (!pill) {
        pill = document.createElement('div');
        pill.className = 'effect-pill';
        pill.style.color = e.color;

        pill.innerHTML =
          '<div class="effect-icon-wrap">' +
            '<svg class="effect-countdown-bg" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11"/></svg>' +
            '<svg class="effect-countdown" viewBox="0 0 28 28"><circle cx="14" cy="14" r="11" style="stroke:' + e.color + ';stroke-dasharray:' + EFFECT_CIRC + ';stroke-dashoffset:0"/></svg>' +
            '<div class="effect-icon">' + (effectIconSVGs[e.icon] || effectIconSVGs.star) + '</div>' +
          '</div>' +
          '<span class="effect-label">' + e.label + '</span>' +
          '<span class="effect-timer"></span>';

        container.appendChild(pill);
        renderedEffects[e.id] = pill;
      }

      // Update countdown circle and timer text
      var circle = pill.querySelector('.effect-countdown circle');
      var timerSpan = pill.querySelector('.effect-timer');
      var pct = e.duration > 0 ? e.remaining / e.duration : 0;
      circle.style.strokeDashoffset = EFFECT_CIRC * (1 - pct);

      var secs = Math.ceil(e.remaining / 1000);
      if (secs >= 60) {
        timerSpan.textContent = Math.floor(secs / 60) + 'm' + (secs % 60 < 10 ? '0' : '') + (secs % 60) + 's';
      } else {
        timerSpan.textContent = secs + 's';
      }
    }
  }

  // ===== Progress bar =====
  function startProgress(duration, label, color) {
    if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
    if (progressRAF) { cancelAnimationFrame(progressRAF); progressRAF = null; }

    els.progressContainer.classList.remove('hiding');
    els.progressContainer.style.display = 'block';
    els.progressLabel.textContent = label || '';
    els.progressFill.style.background = color || 'var(--accent-blue)';
    els.progressFill.style.width = '0%';
    els.progressFill.style.transition = 'none';

    var start = performance.now();
    var dur = duration;

    function tick(now) {
      var elapsed = now - start;
      var pct = Math.min(100, (elapsed / dur) * 100);
      els.progressFill.style.width = pct + '%';
      if (pct < 100) {
        progressRAF = requestAnimationFrame(tick);
      }
    }
    progressRAF = requestAnimationFrame(tick);

    progressTimer = setTimeout(function () {
      els.progressFill.style.width = '100%';
      if (progressRAF) { cancelAnimationFrame(progressRAF); progressRAF = null; }
      setTimeout(function () {
        hideProgress();
        // Send callback to Lua
        if (typeof fetch !== 'undefined') {
          fetch('https://dei_hud/progressComplete', { method: 'POST', body: JSON.stringify({}) });
        }
      }, 200);
    }, duration);
  }

  function hideProgress() {
    if (progressTimer) { clearTimeout(progressTimer); progressTimer = null; }
    if (progressRAF) { cancelAnimationFrame(progressRAF); progressRAF = null; }
    els.progressContainer.classList.add('hiding');
    setTimeout(function () {
      els.progressContainer.style.display = 'none';
      els.progressContainer.classList.remove('hiding');
      els.progressFill.style.width = '0%';
    }, 300);
  }

  // ===== Settings =====
  function openSettings(config) {
    els.settingsOverlay.classList.add('open');

    // Set current values
    var themeBtns = $$('.theme-btn');
    themeBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === (config.theme || 'dark'));
    });

    $('#setting-lightmode').checked = config.lightMode || false;
    var scaleSlider = $('#setting-scale');
    scaleSlider.value = config.scale || 1.0;
    $('#scale-value').textContent = parseFloat(scaleSlider.value).toFixed(1);

    var speedBtns = $$('.speed-btn');
    speedBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.unit === (config.speedUnit || 'kmh'));
    });

    $('#setting-voice').checked = config.showVoice !== false;
    $('#setting-radio').checked = config.showRadio !== false;
    $('#setting-weapon').checked = config.showWeapon !== false;
    $('#setting-stress').checked = config.showStress !== false;
    $('#setting-hidefull').checked = config.hideWhenFull !== false;
  }

  function closeSettings() {
    els.settingsOverlay.classList.remove('open');
    if (typeof fetch !== 'undefined') {
      fetch('https://dei_hud/closeSettings', { method: 'POST', body: JSON.stringify({}) });
    }
  }

  function saveSettings() {
    var activeTheme = 'dark';
    $$('.theme-btn').forEach(function (btn) {
      if (btn.classList.contains('active')) activeTheme = btn.dataset.theme;
    });

    var activeUnit = 'kmh';
    $$('.speed-btn').forEach(function (btn) {
      if (btn.classList.contains('active')) activeUnit = btn.dataset.unit;
    });

    var data = {
      theme: activeTheme,
      lightMode: $('#setting-lightmode').checked,
      scale: parseFloat($('#setting-scale').value),
      speedUnit: activeUnit,
      showVoice: $('#setting-voice').checked,
      showRadio: $('#setting-radio').checked,
      showWeapon: $('#setting-weapon').checked,
      showStress: $('#setting-stress').checked,
      hideWhenFull: $('#setting-hidefull').checked,
    };

    if (typeof fetch !== 'undefined') {
      fetch('https://dei_hud/saveSettings', { method: 'POST', body: JSON.stringify(data) });
    }
    closeSettings();
  }

  // Settings event listeners
  els.settingsCloseBtn.addEventListener('click', closeSettings);
  els.settingsSaveBtn.addEventListener('click', saveSettings);

  // Theme buttons
  $$('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.theme-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // Speed unit buttons
  $$('.speed-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.speed-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  // Scale slider live update
  $('#setting-scale').addEventListener('input', function () {
    $('#scale-value').textContent = parseFloat(this.value).toFixed(1);
  });

  // Click outside settings to close
  els.settingsOverlay.addEventListener('click', function (e) {
    if (e.target === els.settingsOverlay) {
      closeSettings();
    }
  });

  // ESC to close settings
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && els.settingsOverlay.classList.contains('open')) {
      closeSettings();
    }
  });

  // ===== Drag system =====
  function initDrag() {
    var draggables = $$('[data-draggable]');
    draggables.forEach(function (el) { el.classList.add('draggable'); });

    document.addEventListener('mousedown', function (e) {
      if (!inEditMode) return;
      var target = e.target.closest('[data-draggable]');
      if (!target) return;
      dragTarget = target;
      var rect = target.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      target.style.transition = 'none';
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragTarget) return;
      dragTarget.style.position = 'fixed';
      dragTarget.style.left = (e.clientX - dragOffset.x) + 'px';
      dragTarget.style.top = (e.clientY - dragOffset.y) + 'px';
      dragTarget.style.right = 'auto';
      dragTarget.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', function () {
      if (dragTarget) { dragTarget.style.transition = ''; dragTarget = null; }
    });
  }
  initDrag();

  window.savePositions = function () {
    var positions = {};
    $$('[data-draggable]').forEach(function (el) {
      var key = el.dataset.draggable;
      positions[key] = { left: el.style.left, top: el.style.top };
    });
    fetch('https://dei_hud/savePositions', { method: 'POST', body: JSON.stringify({ positions: positions }) });
    inEditMode = false;
    els.editBanner.style.display = 'none';
    $$('[data-draggable]').forEach(function (el) { el.classList.remove('draggable'); });
  };

  window.cancelEdit = function () {
    fetch('https://dei_hud/closeEditMode', { method: 'POST', body: JSON.stringify({}) });
    inEditMode = false;
    els.editBanner.style.display = 'none';
    $$('[data-draggable]').forEach(function (el) { el.classList.remove('draggable'); });
  };

  // ===== Message handler =====
  window.addEventListener('message', function (event) {
    var d = event.data;
    switch (d.action) {
      case 'showHud':
        els.container.style.display = 'block';

        // Player ID badge
        if (d.showPlayerID === false) {
          els.idBadge.style.display = 'none';
        } else {
          els.idBadge.style.display = '';
          els.id.textContent = d.playerid;
        }

        if (d.job) { els.job.textContent = d.job; els.jobrp.style.display = ''; } else { els.jobrp.style.display = 'none'; }

        var hide = d.hideWhenFull;
        var thr = d.hideThreshold || 100;
        var delay = d.staggerDelay || 0;
        updateStat('health', d.health, hide, thr, delay * 0);
        updateStat('armor', d.armor, true, 1, delay * 1);
        updateStat('stamina', d.stamina, hide, thr, delay * 2);
        updateStat('thirst', d.thirst, hide, thr, delay * 3);
        updateStat('hunger', d.hunger, hide, thr, delay * 4);

        if (d.showOxygen) { stats.oxygen.el.style.display = ''; updateStat('oxygen', d.oxygen, false, 101, delay * 5); }
        else if (stats.oxygen) stats.oxygen.el.style.display = 'none';

        if (d.showStress && d.stress > 0) { stats.stress.el.style.display = ''; updateStat('stress', d.stress, false, 101, delay * 6); }
        else if (stats.stress) stats.stress.el.style.display = 'none';

        if (d.showVoice) {
          els.voiceIndicator.style.display = 'flex';
          var ranges = [3, 8, 15];
          var level = 0;
          for (var i = 0; i < ranges.length; i++) { if (d.voiceRange >= ranges[i]) level = i + 1; }
          els.voiceBars.forEach(function (bar, idx) { bar.classList.toggle('active', idx < level); });
          els.voiceIndicator.classList.toggle('talking', d.talking);
        } else { els.voiceIndicator.style.display = 'none'; }

        if (d.showRadio && d.radio > 0) {
          els.radioStat.style.display = '';
          els.radioChannel.textContent = d.radio;
        } else { els.radioStat.style.display = 'none'; }

        if (d.drugged) { els.drugOverlay.classList.add('active'); }
        else { els.drugOverlay.classList.remove('active'); }

        // Weapon bar
        if (d.showWeapon && d.weapon) {
          els.weaponBar.style.display = 'flex';
          els.ammoClip.textContent = d.weapon.clip;
          els.ammoReserve.textContent = d.weapon.reserve;
          var maxClip = d.weapon.clip + d.weapon.reserve;
          var pct = maxClip > 0 ? (d.weapon.clip / (d.weapon.clip + d.weapon.reserve)) * 100 : 0;
          els.ammoBarFill.style.width = Math.min(100, pct) + '%';
          els.ammoBarFill.style.background = pct > 30 ? '#4ade80' : pct > 10 ? '#fbbf24' : '#ef4444';
        } else {
          els.weaponBar.style.display = 'none';
        }

        // Stamina vignette
        if (d.showStaminaVignette && d.stamina < 30) {
          var intensity = (30 - d.stamina) / 30;
          els.staminaVignette.style.opacity = intensity * 0.6;
        } else {
          els.staminaVignette.style.opacity = '0';
        }

        if (d.map) els.statusPanel.style.left = '30vh';

        // Critical/warning status effects
        updateCriticalWarnings(d);
        break;

      case 'hideHud':
        els.container.style.display = 'none';
        els.compassBar.style.display = 'none';
        els.healthVignette.style.opacity = '0';
        els.healthVignette.classList.remove('active');
        els.underwaterOverlay.classList.remove('active');
        els.stressOverlay.classList.remove('active');
        break;

      case 'showSpeed':
        els.speedo.style.display = 'block';
        if (d.unit) els.speedUnit.textContent = d.unit;
        if (d.showGear) els.gearContainer.style.display = '';
        if (d.showCompass) els.compassContainer.style.display = '';
        if (d.showFuel) els.fuelBar.style.display = '';
        if (d.showDamage) els.damageBars.style.display = '';
        if (d.showSignals) els.signalRow.style.display = '';
        if (d.showNos) els.nosIcon.style.display = '';
        if (d.harnessEnabled) els.harnessIcon.style.display = '';
        if (d.map) els.statusPanel.style.left = '30vh';
        break;

      case 'hideSpeed':
        els.speedo.style.display = 'none';
        els.harnessIcon.style.display = 'none';
        els.statusPanel.style.left = '';
        break;

      case 'vehicleStatus':
        els.speed.textContent = d.speed;
        els.engine.style.color = d.engine ? '#4ade80' : '#ef4444';
        els.light.style.color = d.lights ? '#fbbf24' : 'rgba(255,255,255,0.15)';
        els.limiter.style.color = d.cruise ? '#3b82f6' : 'rgba(255,255,255,0.15)';
        els.seatbeltIcon.style.color = d.seatbelt ? '#4ade80' : '#ef4444';
        els.harnessIcon.style.color = d.harness ? '#4ade80' : '#ef4444';
        els.lockIcon.style.color = d.locked ? '#fbbf24' : 'rgba(255,255,255,0.15)';
        els.progressBar.style.width = d.rpm + '%';

        if (d.nos !== undefined) els.nosIcon.style.color = d.nos ? '#a855f7' : 'rgba(255,255,255,0.15)';
        if (d.gear !== undefined) els.gearValue.textContent = d.gear === 0 ? 'R' : d.gear;

        if (d.cruise && d.cruiseSpeed) {
          els.cruiseSpeed.style.display = '';
          els.cruiseValue.textContent = d.cruiseSpeed;
        } else { els.cruiseSpeed.style.display = 'none'; }

        if (d.fuel !== undefined) {
          els.fuelFill.style.width = d.fuel + '%';
          els.fuelText.textContent = d.fuel;
          els.fuelFill.style.background = damageColor(d.fuel);
        }

        if (d.engineDamage !== undefined) {
          els.engineDamage.style.width = d.engineDamage + '%';
          els.engineDamage.style.background = damageColor(d.engineDamage);
          els.bodyDamage.style.width = d.bodyDamage + '%';
          els.bodyDamage.style.background = damageColor(d.bodyDamage);
        }

        if (d.street !== undefined) {
          els.streetName.textContent = d.street;
          els.directionBadge.textContent = d.direction;
        }
        break;

      case 'cruiseControl':
        els.limiter.style.color = d.cruise ? '#3b82f6' : 'rgba(255,255,255,0.15)';
        if (d.cruise) { els.cruiseSpeed.style.display = ''; els.cruiseValue.textContent = d.cruiseSpeed; }
        else { els.cruiseSpeed.style.display = 'none'; }
        break;

      case 'seatbelt':
        els.seatbeltIcon.style.color = d.active ? '#4ade80' : '#ef4444';
        break;

      case 'harness':
        els.harnessIcon.style.color = d.active ? '#4ade80' : '#ef4444';
        break;

      case 'signals':
        startSignalBlink(d.left, d.right, d.hazard);
        break;

      case 'crash':
        els.crashOverlay.classList.add('active');
        setTimeout(function () { els.crashOverlay.classList.remove('active'); }, 500);
        break;

      case 'notification':
        showNotif(d.message, d.type, d.duration);
        break;

      case 'toggleColor':
        document.body.classList.toggle('light-mode');
        break;

      case 'setLightMode':
        if (d.enabled) document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
        break;

      case 'editMode':
        inEditMode = d.active;
        els.editBanner.style.display = d.active ? 'flex' : 'none';
        $$('[data-draggable]').forEach(function (el) { el.classList.toggle('draggable', d.active); });
        break;

      case 'setScale':
        els.container.style.transform = 'scale(' + d.scale + ')';
        els.container.style.transformOrigin = 'bottom left';
        break;

      case 'loadPrefs':
        var p = d.prefs;
        if (p.lightMode) document.body.classList.add('light-mode');
        if (p.scale) { els.container.style.transform = 'scale(' + p.scale + ')'; els.container.style.transformOrigin = 'bottom left'; }
        if (p.theme) document.body.dataset.theme = p.theme;
        if (p.positions) {
          Object.keys(p.positions).forEach(function (key) {
            var el = document.querySelector('[data-draggable="' + key + '"]');
            if (el && p.positions[key]) {
              el.style.position = 'fixed';
              el.style.left = p.positions[key].left;
              el.style.top = p.positions[key].top;
              el.style.right = 'auto';
              el.style.bottom = 'auto';
            }
          });
        }
        break;

      case 'setTheme':
        document.body.dataset.theme = d.theme;
        break;

      case 'afkStatus':
        if (d.afk) {
          els.container.style.opacity = '0';
          els.container.style.transition = 'opacity 1s ease';
        } else {
          els.container.style.opacity = '1';
        }
        break;

      // ===== Money =====
      case 'updateMoney':
        els.moneyCashValue.textContent = formatMoney(d.cash);
        els.moneyBankValue.textContent = formatMoney(d.bank);
        if (d.cashDiff !== 0) showMoneyChange(els.moneyCashChange, d.cashDiff);
        if (d.bankDiff !== 0) showMoneyChange(els.moneyBankChange, d.bankDiff);
        showMoneyPanel();
        break;

      // ===== Effects =====
      case 'updateEffects':
        renderEffects(d.effects || []);
        break;

      // ===== Progress bar =====
      case 'progressBar':
        startProgress(d.duration, d.label, d.color);
        break;

      case 'cancelProgress':
        hideProgress();
        break;

      // ===== Settings =====
      case 'openSettings':
        openSettings(d.config || {});
        break;

      case 'closeSettingsPanel':
        els.settingsOverlay.classList.remove('open');
        break;

      // ===== Compass Bar =====
      case 'updateCompass':
        updateCompass(d.heading, d.street, d.zone, d.postal, d.waypoint);
        break;

      // ===== Circular Progress =====
      case 'circularProgress':
        startCircularProgress(d.duration, d.label, d.icon, d.color);
        break;

      case 'cancelCircularProgress':
        hideCircularProgress();
        break;
    }
  });

  // ===== PREVIEW / DEMO MODE =====
  var IS_BROWSER = !window.invokeNative;
  if (IS_BROWSER) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.style.visibility = 'visible';
      document.body.dataset.theme = 'dark';
      setTimeout(function () {
        window.postMessage({ action: 'setTheme', theme: 'dark' });
        window.postMessage({ action: 'showHud', health: 75, armor: 50, stamina: 80, thirst: 45, hunger: 60, job: 'Policia', playerid: 1, map: false, hideWhenFull: false, hideThreshold: 100, showStress: true, stress: 30, showOxygen: false, showVoice: true, voiceRange: 8, talking: false, showRadio: true, radio: 5, drugged: false, drugLevel: 0, staggerDelay: 50, showWeapon: true, weapon: { clip: 18, reserve: 72, total: 90 }, showStaminaVignette: true, showPlayerID: true, criticalHealth: 25, warningHunger: 20, warningThirst: 20, stressEffects: true, underWater: false });
        window.postMessage({ action: 'showSpeed', map: false, unit: 'KM/H', showFuel: true, showGear: true, showCompass: true, showDamage: true, showSignals: true, showNos: true, harnessEnabled: true });
        window.postMessage({ action: 'signals', left: false, right: false, hazard: false });

        // Demo money
        window.postMessage({ action: 'updateMoney', cash: 15000, bank: 250000, cashDiff: 0, bankDiff: 0 });

        // Demo effects
        window.postMessage({ action: 'updateEffects', effects: [
          { id: 'armor_boost', label: 'Armadura', icon: 'shield', duration: 60000, remaining: 45000, color: '#3b82f6', uid: 1 },
          { id: 'speed_boost', label: 'Velocidad', icon: 'lightning', duration: 30000, remaining: 22000, color: '#f59e0b', uid: 2 },
          { id: 'heal', label: 'Curacion', icon: 'heart', duration: 15000, remaining: 8000, color: '#ef4444', uid: 3 },
        ]});

        // Demo vehicle status and compass (continuous)
        window.postMessage({ action: 'vehicleStatus', engine: true, lights: true, rpm: 65, speed: 120, fuel: 65, gear: 3, street: 'Vinewood Blvd', direction: 'S', seatbelt: true, harness: false, cruise: false, cruiseSpeed: 0, engineDamage: 82, bodyDamage: 65, nos: true, locked: false });
        window.postMessage({ action: 'updateCompass', heading: 180, street: 'Vinewood Blvd / Alta St', zone: 'Vinewood', postal: '110', waypoint: 90 });

        // Demo progress bar
        setTimeout(function () {
          window.postMessage({ action: 'progressBar', duration: 8000, label: 'Reparando vehiculo...', color: '#4ade80' });
        }, 1500);

        // Demo circular progress
        setTimeout(function () {
          window.postMessage({ action: 'circularProgress', duration: 10000, label: 'Abriendo cerradura...', icon: 'lock', color: '#a855f7' });
        }, 3000);
      }, 300);
    });
  }
})();
