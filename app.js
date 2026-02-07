/* ============================================
   HOLDEN'S HUSTLE - App Logic
   ============================================ */

(function () {
  'use strict';

  // ---- Constants ----
  const STORAGE_KEY = 'holdens_hustle_data';
  const SEED_START_DATE = '2026-01-10'; // Day 1
  const SEED_DAYS = 28; // Pre-populated days (Jan 10 – Feb 6 → streak 28; Feb 7 check-in = day 29)

  // ---- DOM Elements ----
  const $moneyCounter = document.getElementById('money-counter');
  const $moneyDisplay = document.getElementById('money-display');
  const $moneySublabel = document.getElementById('money-sublabel');
  const $streakCount = document.getElementById('streak-count');
  const $todayValue = document.getElementById('today-value');
  const $streakFire = document.getElementById('streak-fire');
  const $runButton = document.getElementById('run-button');
  const $alreadyDone = document.getElementById('already-done');
  const $motivation = document.getElementById('motivation');
  const $reminderBanner = document.getElementById('reminder-banner');
  const $calendar = document.getElementById('calendar');
  const $calendarHeader = document.getElementById('calendar-header');
  const $statMiles = document.getElementById('stat-miles');
  const $statAvg = document.getElementById('stat-avg');
  const $statNextMilestone = document.getElementById('stat-next-milestone');
  const $notifyPrompt = document.getElementById('notify-prompt');
  const $notifyBtn = document.getElementById('notify-btn');
  const $videoModal = document.getElementById('video-modal');
  const $videoClose = document.getElementById('video-close');
  const $videoOverlay = document.getElementById('video-overlay');
  const $milestoneVideo = document.getElementById('milestone-video');
  const $confettiCanvas = document.getElementById('confetti-canvas');

  // ---- Audio Context ----
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioCtx;
  }

  // ---- Data Management ----
  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveData(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function seedInitialData() {
    const checkIns = {};
    const start = new Date(SEED_START_DATE + 'T12:00:00');
    for (let i = 0; i < SEED_DAYS; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      checkIns[dateToKey(d)] = true;
    }
    return {
      checkIns: checkIns,
      bankedEarnings: 0,
      lastBankedDate: null,
      milestone500Shown: false,
      notificationsEnabled: false
    };
  }

  function dateToKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function keyToDate(key) {
    const parts = key.split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2], 12, 0, 0);
  }

  function getToday() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
  }

  function getYesterday() {
    const t = getToday();
    t.setDate(t.getDate() - 1);
    return t;
  }

  // ---- Streak Calculation ----
  function calculateStreak(data) {
    const today = getToday();
    const todayKey = dateToKey(today);
    const yesterdayKey = dateToKey(getYesterday());

    // Get sorted check-in dates
    const dates = Object.keys(data.checkIns)
      .filter((k) => data.checkIns[k])
      .sort()
      .reverse();

    if (dates.length === 0) {
      return { streak: 0, checkedToday: false, broken: true };
    }

    const lastDate = dates[0];
    const checkedToday = lastDate === todayKey;

    // If last check-in is before yesterday, streak is broken
    if (lastDate < yesterdayKey) {
      return { streak: 0, checkedToday: false, broken: true };
    }

    // Count consecutive days backwards from the most recent check-in
    let streak = 1;
    for (let i = 1; i < dates.length; i++) {
      const curr = keyToDate(dates[i]);
      const prev = keyToDate(dates[i - 1]);
      const diff = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        streak++;
      } else {
        break;
      }
    }

    return { streak, checkedToday, broken: false };
  }

  function calcTotal(streak) {
    return (streak * (streak + 1)) / 2;
  }

  // Find the date that crossed a milestone target (e.g. 500)
  function findMilestoneDate(data, target) {
    const dates = Object.keys(data.checkIns).filter((k) => data.checkIns[k]).sort();
    if (dates.length === 0) return null;

    let banked = 0;
    let streakDay = 0;

    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        streakDay = 1;
      } else {
        const curr = keyToDate(dates[i]);
        const prev = keyToDate(dates[i - 1]);
        const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          streakDay++;
        } else {
          banked += calcTotal(streakDay);
          streakDay = 1;
        }
      }

      const total = banked + calcTotal(streakDay);
      if (total >= target) return dates[i];
    }
    return null;
  }

  // ---- Motivational Messages ----
  function getMotivationalMessage(streak, total, justCheckedIn) {
    const messages = [];

    if (justCheckedIn) {
      messages.push(
        `You just banked $${streak} today! Ka-ching!`,
        `Day ${streak} in the books! Keep stacking!`,
        `$${total} total! That money is REAL.`,
        `${streak} days straight. You're a machine, Holden!`,
        `Another mile, another pile of cash!`
      );
      if (streak >= 30) messages.push(`${streak} days! That's a whole MONTH of running!`);
      if (streak >= 50) messages.push(`50+ days?! You're in elite territory!`);
      if (total >= 200) messages.push(`Over $200 earned just by running. Legend.`);
      if (total >= 400) messages.push(`Almost $500! You can taste it!`);
    } else {
      // Projection messages
      const daysTo500 = findDaysForTarget(500, streak);
      const daysTo1000 = findDaysForTarget(1000, streak);

      if (total < 500 && daysTo500 > 0) {
        messages.push(`${daysTo500} more days and you hit $500! That's day ${streak + daysTo500}.`);
      }
      if (total < 1000 && daysTo1000 > 0) {
        messages.push(`Keep grinding — $1,000 is only ${daysTo1000} more days away!`);
      }

      messages.push(
        `Tomorrow's run is worth $${streak + 1}. Don't leave that on the table.`,
        `You've run ${streak} miles. That's basically ${(streak * 1.6).toFixed(1)} kilometers!`,
        `Every day the price goes UP. Day ${streak + 5} is worth $${streak + 5}!`,
        `Streak alive. Money growing. Keep it up, Holden.`
      );

      if (streak >= 25 && streak < 30) {
        messages.push(`${30 - streak} more days to hit 30! One whole month!`);
      }
      if (streak >= 35 && streak < 40) {
        messages.push(`${40 - streak} days to 40! At day 40, your total will be $${calcTotal(40)}!`);
      }
      if (streak >= 55 && streak < 60) {
        messages.push(`${60 - streak} days to 60! Two months straight — total will be $${calcTotal(60)}!`);
      }
      if (streak >= 85 && streak < 90) {
        messages.push(`${90 - streak} days to 90! THREE months! Total: $${calcTotal(90)}!`);
      }
    }

    return messages[Math.floor(Math.random() * messages.length)];
  }

  function findDaysForTarget(target, currentStreak) {
    let s = currentStreak;
    while (calcTotal(s) < target) {
      s++;
      if (s > currentStreak + 365) return 0;
    }
    return s - currentStreak;
  }

  // ---- Sound Effects ----
  function playChaChingSound() {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      // Cash register "click" — noise burst
      const noiseLen = 0.08;
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseLen, ctx.sampleRate);
      const noiseData = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.4;
      }
      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseLen);
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.value = 3000;
      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(now);
      noiseSource.stop(now + noiseLen);

      // Bell tone 1
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = 2200;
      gain1.gain.setValueAtTime(0.25, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now + 0.05);
      osc1.stop(now + 0.6);

      // Bell tone 2 (higher, slightly delayed)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 3300;
      gain2.gain.setValueAtTime(0.15, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.7);

      // Coin shimmer (harmonic)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.value = 4400;
      gain3.gain.setValueAtTime(0.08, now + 0.2);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.2);
      osc3.stop(now + 0.8);

    } catch (e) {
      // Audio not supported, that's fine
    }
  }

  // ---- Confetti ----
  const confettiParticles = [];
  let confettiAnimating = false;

  function initConfettiCanvas() {
    const canvas = $confettiCanvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    });
  }

  function launchConfetti(count, isMilestone) {
    const canvas = $confettiCanvas;
    const colors = isMilestone
      ? ['#ffd700', '#ffed4a', '#ff6b6b', '#00ff88', '#fff']
      : ['#00ff88', '#00cc6a', '#ffd700', '#ffffff', '#4ade80'];

    for (let i = 0; i < count; i++) {
      confettiParticles.push({
        x: canvas.width * Math.random(),
        y: -10 - Math.random() * canvas.height * 0.3,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1
      });
    }

    if (!confettiAnimating) {
      confettiAnimating = true;
      animateConfetti();
    }
  }

  function animateConfetti() {
    const canvas = $confettiCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1; // gravity
      p.rotation += p.rotSpeed;
      p.life -= 0.005;

      if (p.life <= 0 || p.y > canvas.height + 20) {
        confettiParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }

    if (confettiParticles.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      confettiAnimating = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ---- Money Counter Animation ----
  function animateCounter(from, to, duration, callback) {
    const start = performance.now();
    $moneyCounter.classList.add('counting');

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      $moneyCounter.textContent = current.toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        $moneyCounter.classList.remove('counting');
        $moneyCounter.classList.add('flash');
        setTimeout(() => $moneyCounter.classList.remove('flash'), 1000);
        if (callback) callback();
      }
    }

    requestAnimationFrame(tick);
  }

  // ---- Earning Popup ----
  function showEarningPopup(amount) {
    const el = document.createElement('div');
    el.className = 'earning-popup';
    el.textContent = `+$${amount}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }

  // ---- Calendar Rendering ----
  function renderCalendar(data) {
    $calendarHeader.innerHTML = '';
    $calendar.innerHTML = '';

    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    dayNames.forEach((d) => {
      const el = document.createElement('div');
      el.className = 'calendar-header-day';
      el.textContent = d;
      $calendarHeader.appendChild(el);
    });

    const today = getToday();
    const todayKey = dateToKey(today);

    // Find the $500 milestone date for highlighting
    const milestoneDate = data.milestone500Shown ? findMilestoneDate(data, 500) : null;

    // Show the current month + enough to capture the streak
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0);
    // Go back one more month to show more history
    const displayStart = new Date(startOfMonth);
    displayStart.setMonth(displayStart.getMonth() - 1);

    // Find the Sunday on or before displayStart
    const calStart = new Date(displayStart);
    calStart.setDate(calStart.getDate() - calStart.getDay());

    // Show 6 weeks
    const totalDays = 42;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(calStart);
      d.setDate(d.getDate() + i);
      const key = dateToKey(d);

      const el = document.createElement('div');
      el.className = 'calendar-day';
      el.textContent = d.getDate();

      if (d > today) {
        el.classList.add('future');
      } else if (data.checkIns[key]) {
        el.classList.add('checked');
      } else if (d < today && d >= keyToDate(Object.keys(data.checkIns).sort()[0] || todayKey)) {
        el.classList.add('missed');
      } else {
        el.classList.add('unchecked');
      }

      if (key === todayKey) {
        el.classList.add('today');
      }

      // Mark the $500 milestone day with a trophy
      if (milestoneDate && key === milestoneDate) {
        el.classList.add('milestone');
        el.innerHTML = d.getDate() + '<span class="milestone-badge">\uD83C\uDFC6</span>';
        el.addEventListener('click', () => {
          launchConfetti(200, true);
          $videoModal.classList.add('active');
          $milestoneVideo.currentTime = 0;
          try {
            $milestoneVideo.play();
          } catch (e) { /* autoplay may be blocked */ }
        });
      }

      $calendar.appendChild(el);
    }
  }

  // ---- Notification System ----
  function initNotifications(data) {
    if (!('Notification' in window)) return;

    if (data.notificationsEnabled && Notification.permission === 'granted') {
      scheduleReminder(data);
    } else if (Notification.permission === 'default') {
      $notifyPrompt.style.display = 'block';
    }
  }

  function scheduleReminder(data) {
    const now = new Date();
    const sevenPM = new Date(now);
    sevenPM.setHours(19, 0, 0, 0);

    // If it's after 7 PM and not checked in, show banner immediately
    const todayKey = dateToKey(getToday());
    if (now.getHours() >= 19 && !data.checkIns[todayKey]) {
      $reminderBanner.style.display = 'flex';
    }

    if (now >= sevenPM) {
      // Schedule for tomorrow
      sevenPM.setDate(sevenPM.getDate() + 1);
    }

    const msUntil = sevenPM - now;

    setTimeout(() => {
      const freshData = loadData();
      const todayNow = dateToKey(getToday());
      if (freshData && !freshData.checkIns[todayNow]) {
        // Show banner
        $reminderBanner.style.display = 'flex';

        // Try push notification
        if (navigator.serviceWorker && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title: "Hey Holden! \uD83C\uDFC3",
            body: "Don't forget to go run today! Your streak is on the line! \uD83D\uDCB0"
          });
        } else if (Notification.permission === 'granted') {
          new Notification("Hey Holden! \uD83C\uDFC3", {
            body: "Don't forget to go run today! Your streak is on the line! \uD83D\uDCB0"
          });
        }
      }
      // Reschedule
      scheduleReminder(freshData || data);
    }, msUntil);
  }

  // ---- $500 Milestone ----
  function checkMilestone(total, data) {
    if (total >= 500 && !data.milestone500Shown) {
      data.milestone500Shown = true;
      saveData(data);

      setTimeout(() => {
        launchConfetti(200, true);
        $videoModal.classList.add('active');
        try {
          $milestoneVideo.play();
        } catch (e) { /* autoplay may be blocked */ }
      }, 2000);
    }
  }

  // ---- Render UI ----
  function renderUI(data, animate) {
    const result = calculateStreak(data);
    const { streak, checkedToday, broken } = result;

    const total = data.bankedEarnings + calcTotal(streak);
    const todayVal = checkedToday ? streak : streak + 1;

    // Streak count
    $streakCount.textContent = streak;

    // Today's value
    $todayValue.textContent = `$${checkedToday ? streak : streak + 1}`;

    // Fire emoji state
    if (broken || streak === 0) {
      $streakFire.classList.add('dead');
      $streakFire.textContent = '\uD83D\uDCA8';
    } else {
      $streakFire.classList.remove('dead');
      $streakFire.textContent = '\uD83D\uDD25';
    }

    // Money counter
    if (animate) {
      const prevTotal = total - streak; // before today's check-in
      animateCounter(prevTotal, total, 2000, () => {
        checkMilestone(total, data);
      });
    } else {
      $moneyCounter.textContent = total.toLocaleString();
      // Still check milestone on load
      if (total >= 500 && !data.milestone500Shown) {
        checkMilestone(total, data);
      }
    }

    // Sublabel
    if (checkedToday) {
      $moneySublabel.textContent = `Day ${streak} complete!`;
    } else if (!broken) {
      $moneySublabel.textContent = `Run today to earn $${streak + 1}`;
    } else {
      $moneySublabel.textContent = `Streak broken! Run today to start fresh.`;
    }

    // Button state
    if (checkedToday) {
      $runButton.style.display = 'none';
      $alreadyDone.style.display = 'block';
      $reminderBanner.style.display = 'none';
    } else {
      $runButton.style.display = 'flex';
      $runButton.disabled = false;
      $alreadyDone.style.display = 'none';
    }

    // Motivation
    const msg = getMotivationalMessage(streak, total, false);
    $motivation.innerHTML = `<div class="motivation-text">${msg}</div>`;

    // Stats
    const allCheckIns = Object.keys(data.checkIns).filter((k) => data.checkIns[k]).length;
    $statMiles.textContent = allCheckIns;
    $statAvg.textContent = `$${allCheckIns > 0 ? Math.round(total / allCheckIns) : 0}`;

    // Next milestone
    const milestones = [100, 250, 500, 750, 1000, 1500, 2000, 5000, 10000];
    const nextMilestone = milestones.find((m) => m > total) || total + 500;
    $statNextMilestone.textContent = `$${nextMilestone.toLocaleString()}`;

    // Calendar
    renderCalendar(data);

    // Notifications
    initNotifications(data);
  }

  // ---- Check-in Handler ----
  function handleCheckIn() {
    const data = loadData();
    if (!data) return;

    const todayKey = dateToKey(getToday());
    if (data.checkIns[todayKey]) return;

    const result = calculateStreak(data);

    // Handle streak break: bank previous earnings
    if (result.broken) {
      // Previous streak earnings stay banked but we need to count total check-ins before
      // Actually the streak is already broken, so calcTotal(0) = 0, bankedEarnings stays
      // Just start a new streak
    }

    // Check in today
    data.checkIns[todayKey] = true;
    saveData(data);

    // Recalculate after check-in
    const newResult = calculateStreak(data);
    const newTotal = data.bankedEarnings + calcTotal(newResult.streak);

    // Play sound
    playChaChingSound();

    // Show earning popup
    showEarningPopup(newResult.streak);

    // Launch confetti
    launchConfetti(80, false);

    // Animate the money display
    $moneyDisplay.classList.add('pulse');
    setTimeout(() => $moneyDisplay.classList.remove('pulse'), 1000);

    // Show motivational check-in message
    const msg = getMotivationalMessage(newResult.streak, newTotal, true);
    $motivation.innerHTML = `<div class="motivation-text">${msg}</div>`;

    // Render UI with animation
    renderUI(data, true);
  }

  // ---- Handle Streak Break on Load ----
  function handleStreakBreak(data) {
    const result = calculateStreak(data);
    if (result.broken) {
      const dates = Object.keys(data.checkIns).filter((k) => data.checkIns[k]).sort().reverse();
      // Don't double-bank if we already processed this break
      if (dates.length > 0 && data.lastBankedDate !== dates[0]) {
        let oldStreak = 1;
        for (let i = 1; i < dates.length; i++) {
          const curr = keyToDate(dates[i]);
          const prev = keyToDate(dates[i - 1]);
          const diff = Math.round((prev - curr) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            oldStreak++;
          } else {
            break;
          }
        }
        data.bankedEarnings += calcTotal(oldStreak);
        data.lastBankedDate = dates[0];
        saveData(data);
      }
    }
  }

  // ---- Video Modal ----
  function initVideoModal() {
    $videoClose.addEventListener('click', () => {
      $videoModal.classList.remove('active');
      $milestoneVideo.pause();
    });
    $videoOverlay.addEventListener('click', () => {
      $videoModal.classList.remove('active');
      $milestoneVideo.pause();
    });
  }

  // ---- Service Worker Registration ----
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW registration failed, app still works
      });
    }
  }

  // ---- Notification Button ----
  function initNotifyButton() {
    $notifyBtn.addEventListener('click', async () => {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const data = loadData();
        if (data) {
          data.notificationsEnabled = true;
          saveData(data);
        }
        $notifyPrompt.style.display = 'none';
        scheduleReminder(data);
      } else {
        $notifyPrompt.style.display = 'none';
      }
    });
  }

  // ---- PWA Install Prompt ----
  let deferredInstallPrompt = null;
  function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      showInstallBanner();
    });
  }

  function showInstallBanner() {
    // Only show if not already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const banner = document.createElement('div');
    banner.className = 'install-banner';
    banner.innerHTML = `
      <span class="install-banner-icon">\uD83D\uDCF2</span>
      <span class="install-banner-text">Add to home screen for the full experience!</span>
    `;
    banner.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        if (result.outcome === 'accepted') {
          banner.remove();
        }
        deferredInstallPrompt = null;
      }
    });

    const main = document.querySelector('main');
    main.insertBefore(banner, main.firstChild);
  }

  // ---- Init ----
  function init() {
    // ?reset URL param: clear localStorage and re-seed (for testing)
    const params = new URLSearchParams(window.location.search);
    if (params.has('reset')) {
      localStorage.removeItem(STORAGE_KEY);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Seed data if first launch (or after reset)
    let data = loadData();
    if (!data) {
      data = seedInitialData();
      saveData(data);
    }

    // Handle potential streak break
    handleStreakBreak(data);
    data = loadData(); // reload after potential banking

    // Init canvas
    initConfettiCanvas();

    // Register SW
    registerServiceWorker();

    // Init video modal
    initVideoModal();

    // Init notification button
    initNotifyButton();

    // Init install prompt
    initInstallPrompt();

    // Run button
    $runButton.addEventListener('click', handleCheckIn);

    // Render
    renderUI(data, false);

    // iOS: show a manual install hint if needed
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIOS && !isStandalone) {
      const iosHint = document.createElement('div');
      iosHint.className = 'install-banner';
      iosHint.innerHTML = `
        <span class="install-banner-icon">\uD83D\uDCF2</span>
        <span class="install-banner-text">Tap Share \u2794 "Add to Home Screen" to install!</span>
      `;
      const main = document.querySelector('main');
      main.insertBefore(iosHint, main.firstChild);
    }
  }

  // Go!
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
