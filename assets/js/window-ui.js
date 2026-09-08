// ── 윈도우 메타 ──
const WIN_META = {
  'win-profile': { label: '🌸 프로필' },
  'win-stickers': { label: '✨ 스티커' },
  'win-clock':   { label: '⏰ 현재 시각' },
  'win-welcome': { label: '🏠 홈' },
  'win-diary':   { label: '📔 다이어리' },
  'win-board':   { label: '📋 게시판' },
  'win-typing':  { label: '⌨ 타자 놀이' },
  'win-guestbook': { label: 'Guestbook' },
  'win-music': { label: '음악 플레이어' },
};
const OPEN_WINS = new Set();  // currently open (not minimized) windows
const EXIST_WINS = new Set(); // windows that haven't been closed
const WINDOW_STATE_KEY = 'banana-room.window-state.v1';
const INITIAL_LAYOUT_URL = `${import.meta.env.BASE_URL}window-layout.json`;
const DEFAULT_SIZED_WINDOWS = new Set(['win-typing']);

function readWindowState() {
  try {
    const saved = JSON.parse(localStorage.getItem(WINDOW_STATE_KEY));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

const savedWindowState = readWindowState();
const savedInitialLayout = {};
const isMobile = () => window.matchMedia('(max-width: 560px), (max-height: 560px) and (orientation: landscape)').matches;
const windowLayout = new Map();

function desktopBounds(el) {
  return {
    left: Math.max(0, innerWidth - el.offsetWidth),
    top: Math.max(0, innerHeight - el.offsetHeight - 32),
  };
}

// Keep a window's intended position as a percentage of its available desktop
// area.  A narrow viewport may force several windows together; this lets them
// return to their separate positions when the viewport grows again.
function rememberWindowLayout(el) {
  if (!el) return;
  const bounds = desktopBounds(el);
  const left = Number.parseFloat(el.style.left);
  const top = Number.parseFloat(el.style.top);
  const previous = windowLayout.get(el.id) || { x: 0, y: 0 };
  windowLayout.set(el.id, {
    x: bounds.left > 0 && Number.isFinite(left) ? Math.min(1, Math.max(0, left / bounds.left)) : previous.x,
    y: bounds.top > 0 && Number.isFinite(top) ? Math.min(1, Math.max(0, top / bounds.top)) : previous.y,
  });
}

function restoreWindowLayout(el) {
  if (!el || el.style.display === 'none') return;
  const layout = windowLayout.get(el.id);
  if (!layout) return clampWin(el.id);
  const bounds = desktopBounds(el);
  el.style.left = `${bounds.left * layout.x}px`;
  el.style.top = `${bounds.top * layout.y}px`;
}

function visibleDesktopWindows() {
  return [...document.querySelectorAll('.win')].filter(el => getComputedStyle(el).display !== 'none');
}

function saveWindowState(id, state) {
  const el = document.getElementById(id);
  if (!el) return;

  const left = Number.parseFloat(el.style.left);
  const top = Number.parseFloat(el.style.top);
  savedWindowState[id] = {
    ...savedWindowState[id],
    ...(Number.isFinite(left) ? { left } : {}),
    ...(Number.isFinite(top) ? { top } : {}),
    state,
  };

  try {
    localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(savedWindowState));
  } catch {
    // Storage can be unavailable in private browsing or when the user blocks it.
  }
}

// Use the supplied mouse-click recordings and vary them for a less repetitive feel.
const clickSounds = ['click1.mp3', 'click2.mp3', 'click3.mp3'].map(file => {
  const sound = new Audio(`assets/sounds/${file}`);
  sound.preload = 'auto';
  sound.volume = 0.5;
  return sound;
});
let previousClickSound = -1;
function playMouseClick() {
  let soundIndex = Math.floor(Math.random() * clickSounds.length);
  if (clickSounds.length > 1 && soundIndex === previousClickSound) {
    soundIndex = (soundIndex + 1) % clickSounds.length;
  }
  previousClickSound = soundIndex;
  const sound = clickSounds[soundIndex];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

document.addEventListener('pointerdown', event => {
  if (event.button === 0 && event.isPrimary) playMouseClick();
}, { passive: true });

// Randomize the supplied key sounds. Two voices per recording preserve rapid typing.
const keyboardSounds = ['key1.mp3', 'key2.mp3', 'key3.mp3', 'key4.mp3', 'key5.mp3', 'key6.mp3', 'key7.mp3'].map(file =>
  Array.from({ length: 2 }, () => {
    const sound = new Audio(`assets/sounds/${file}`);
    sound.preload = 'auto';
    sound.volume = 0.28;
    return sound;
  })
);
const keyboardSoundIndexes = Array(keyboardSounds.length).fill(0);
function playKeyboardSound() {
  const soundGroupIndex = Math.floor(Math.random() * keyboardSounds.length);
  const soundGroup = keyboardSounds[soundGroupIndex];
  const soundIndex = keyboardSoundIndexes[soundGroupIndex];
  keyboardSoundIndexes[soundGroupIndex] = (soundIndex + 1) % soundGroup.length;
  const sound = soundGroup[soundIndex];
  sound.currentTime = 0;
  sound.play().catch(() => {});
}

document.addEventListener('keydown', event => {
  // Modifier-only keys and held-key repeats are intentionally silent.
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'NumLock', 'ScrollLock'].includes(event.key)) return;
  playKeyboardSound();
});

// ── 로딩 바 ──
const barEl  = document.getElementById('load-bar');
const pctEl  = document.getElementById('load-pct');
const barSegments = barEl.querySelectorAll('.load-bar-segment');
const loadingDuration = 1000;
const pauseIndexes = new Set();
while (pauseIndexes.size < 2) pauseIndexes.add(Math.floor(Math.random() * (barSegments.length - 5)) + 3);
const pauseDelays = new Map([...pauseIndexes].map(index => [index, 150 + Math.random() * 50]));
const pauseTotal = [...pauseDelays.values()].reduce((total, delay) => total + delay, 0);
const regularDelay = (loadingDuration - pauseTotal) / (barSegments.length - pauseIndexes.size);
const loadingDelays = Array.from(barSegments, (_, index) => pauseDelays.get(index) ?? regularDelay);
let loadingStep = 0;
function advanceLoading() {
  barSegments[loadingStep].classList.add('filled');
  loadingStep += 1;
  const pct = Math.round((loadingStep / barSegments.length) * 100);
  pctEl.textContent = pct + '%';
  if (loadingStep >= barSegments.length) {
    setTimeout(() => {
      const ol = document.getElementById('loading-overlay');
      ol.classList.add('hidden');
      setTimeout(() => ol.remove(), 600);
    }, 350);
    return;
  }
  setTimeout(advanceLoading, loadingDelays[loadingStep]);
}
setTimeout(advanceLoading, loadingDelays[0]);

// ── z-index 관리 ──
let zTop = 10;
function focusWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.zIndex = ++zTop;
  updateTaskbar();
}

// ── 윈도우 열기 ──
function openWin(id) {
  if (isMobile()) { mobileActivate(id); return; }
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.style.display = 'block';
  restoreWindowLayout(el);
  OPEN_WINS.add(id);
  EXIST_WINS.add(id);
  saveWindowState(id, 'open');
  focusWin(id);
  el.dispatchEvent(new CustomEvent('win-open', { bubbles: false }));
  window.dispatchEvent(new Event('window-state-change'));
}

// ── 닫기 (완전히 숨김) ──
function closeWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.classList.remove('mobile-active');
  el.style.display = 'none';
  OPEN_WINS.delete(id);
  EXIST_WINS.delete(id);
  if (!isMobile()) saveWindowState(id, 'closed');
  if (!isMobile()) updateTaskbar();
  window.dispatchEvent(new Event('window-state-change'));
}

// ── 최소화 (taskbar로) ──
function minimizeWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('mobile-active');
  el.style.display = 'none';
  OPEN_WINS.delete(id);
  if (!isMobile()) saveWindowState(id, 'minimized');
  if (!isMobile()) updateTaskbar();
  window.dispatchEvent(new Event('window-state-change'));
}

// ── 태스크바 업데이트 ──
function updateTaskbar() {
  const container = document.getElementById('tb-wins');
  container.innerHTML = '';
  EXIST_WINS.forEach(id => {
    const btn = document.createElement('button');
    btn.className = 'tb-win' + (document.getElementById(id).style.display !== 'none' ? ' active' : '');
    btn.textContent = WIN_META[id]?.label || id;
    btn.onclick = () => {
      const el = document.getElementById(id);
      if (el.style.display === 'none') {
        el.style.display = 'block';
        OPEN_WINS.add(id);
        saveWindowState(id, 'open');
        restoreWindowLayout(el);
        focusWin(id);
      } else {
        focusWin(id);
      }
      updateTaskbar();
    };
    container.appendChild(btn);
  });
}

// ── 모바일 패널 전환 ──
function mobileActivate(id) {
  document.querySelectorAll('.win.mobile-active').forEach(w => w.classList.remove('mobile-active'));
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('mobile-active');
  OPEN_WINS.clear(); OPEN_WINS.add(id); EXIST_WINS.add(id);
  document.querySelectorAll('#mobile-nav button[data-win]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.win === id);
  });
  el.dispatchEvent(new CustomEvent('win-open', { bubbles: false }));
  window.dispatchEvent(new Event('window-state-change'));
}

// ── 데스크탑 아이콘 클릭 ──
let selectedIco = null;
function icoClick(el, winId) {
  if (isMobile()) {
    if (winId) mobileActivate(winId);
    else showToast('공사중이에요! ♡');
    return;
  }
  if (selectedIco) selectedIco.classList.remove('active');
  el.classList.add('active');
  selectedIco = el;
  if (winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    EXIST_WINS.add(winId);
    win.style.display = 'block';
    restoreWindowLayout(win);
    OPEN_WINS.add(winId);
    saveWindowState(winId, 'open');
    focusWin(winId);
  } else {
    showToast('공사중이에요! ♡');
  }
}
document.addEventListener('click', e => {
  if (!e.target.closest('.desktop-icon') && selectedIco) {
    selectedIco.classList.remove('active');
    selectedIco = null;
  }
});

// ── 토스트 ──
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── 드래그 ──
let dragEl = null, dox = 0, doy = 0;
document.querySelectorAll('.win-title').forEach(tb => {
  tb.addEventListener('mousedown', e => {
    if (e.target.classList.contains('tbtn')) return;
    const win = tb.closest('.win');
    dragEl = win;
    focusWin(win.id);
    const r = win.getBoundingClientRect();
    dox = e.clientX - r.left;
    doy = e.clientY - r.top;
  });
});
// 윈도우 클릭 시 focus
document.querySelectorAll('.win').forEach(win => {
  win.addEventListener('mousedown', e => {
    if (!e.target.classList.contains('tbtn')) focusWin(win.id);
  });
});

// ── 커서 + 드래그 + 스파클 ──
const chars = ['✿','★','♡','✦','♪','✶'];
const cols  = ['#e8547a','#ff8fab','#ffb3c6','#c45a7a','#ff6b9d'];

document.addEventListener('mousemove', e => {
  if (dragEl) {
    const taskbarH = 32;
    const maxLeft = Math.max(0, window.innerWidth - dragEl.offsetWidth);
    const maxTop  = Math.max(0, window.innerHeight - dragEl.offsetHeight - taskbarH);
    dragEl.style.left = Math.max(0, Math.min(maxLeft, e.clientX - dox)) + 'px';
    dragEl.style.top  = Math.max(0, Math.min(maxTop,  e.clientY - doy)) + 'px';
    window.dispatchEvent(new Event('window-moving'));
    return;
  }
  if (Math.random() < 0.15) spark(e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => {
  if (dragEl) {
    rememberWindowLayout(dragEl);
    if (!windowLayoutEditing) saveWindowState(dragEl.id, 'open');
    window.dispatchEvent(new Event('window-state-change'));
  }
  dragEl = null;
});

// ── 단일 창을 뷰포트 경계 안으로 클램프 ──
function clampWin(id) {
  const el = document.getElementById(id);
  if (!el || el.style.display === 'none') return;
  const W = innerWidth, H = innerHeight;
  const left = parseFloat(el.style.left) || 0;
  const top  = parseFloat(el.style.top)  || 0;
  const maxLeft = Math.max(0, W - el.offsetWidth);
  const maxTop  = Math.max(0, H - el.offsetHeight - 32);
  el.style.left = Math.min(maxLeft, Math.max(0, left)) + 'px';
  el.style.top  = Math.min(maxTop,  Math.max(0, top))  + 'px';
}

// ── 창 크기 변경 시 보더 밖으로 나간 창 재배치 ──
function setInitialDesktopPositions() {
  const W = innerWidth, H = innerHeight;
  const setPos = (id, x, y) => {
    const el = document.getElementById(id);
    if (!el) return;
    const maxLeft = Math.max(0, W - el.offsetWidth);
    const maxTop = Math.max(0, H - el.offsetHeight - 32);
    el.style.left = `${Math.min(maxLeft, Math.max(0, x))}px`;
    el.style.top = `${Math.min(maxTop, Math.max(0, y))}px`;
  };
  const centered = (id, offset, top) => {
    const el = document.getElementById(id);
    if (el) setPos(id, (W - el.offsetWidth) / 2 + offset, top);
  };

  setPos('win-profile', 100, 48);
  setPos('win-clock', 100, 290);
  centered('win-welcome', 0, 48);
  centered('win-diary', 30, 90);
  centered('win-board', 15, 82);
  centered('win-typing', 50, 110);
  centered('win-guestbook', -20, 75);
  centered('win-music', 80, 145);
  applySavedInitialLayout();
}

function applySavedInitialLayout() {
  Object.entries(savedInitialLayout).forEach(([id, layout]) => {
    const el = document.getElementById(id);
    if (!el || !layout || typeof layout !== 'object') return;
    if (!DEFAULT_SIZED_WINDOWS.has(id)) {
      if (Number.isFinite(layout.width)) el.style.width = `${Math.max(160, layout.width)}px`;
      if (Number.isFinite(layout.height)) el.style.height = `${Math.max(110, layout.height)}px`;
    }
    if (Number.isFinite(layout.x) && Number.isFinite(layout.y)) {
      windowLayout.set(id, {
        x: Math.min(1, Math.max(0, layout.x)),
        y: Math.min(1, Math.max(0, layout.y)),
      });
      restoreWindowLayout(el);
    }
  });
}

function isDesktopMaximized() {
  // Browsers do not expose a maximized flag. Account for browser chrome and
  // platform window borders, which can be noticeably larger than a few pixels.
  const allowance = 80;
  return outerWidth >= screen.availWidth - allowance && outerHeight >= screen.availHeight - allowance;
}

let wasDesktopMaximized = false;
let desktopInitialized = false;
let wasMobileLayout = isMobile();

window.addEventListener('resize', () => {
  const mobileLayout = isMobile();
  if (mobileLayout) {
    if (!wasMobileLayout) mobileActivate('win-welcome');
    wasMobileLayout = true;
    return;
  }
  wasMobileLayout = false;
  if (windowLayoutEditing) return;
  const maximized = isDesktopMaximized();
  if (maximized && !wasDesktopMaximized) {
    setInitialDesktopPositions();
    visibleDesktopWindows().forEach(rememberWindowLayout);
  } else {
    EXIST_WINS.forEach(id => restoreWindowLayout(document.getElementById(id)));
  }
  wasDesktopMaximized = maximized;
});

let windowLayoutEditing = false;
let windowLayoutAdmin = false;
let layoutEditSnapshot = new Map();
let resizingWindow = null;

function snapshotWindowLayout() {
  return new Map([...document.querySelectorAll('.win')].map(el => [el.id, {
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    height: el.style.height,
  }]));
}

function addWindowResizeHandle(el) {
  if (el.querySelector('.win-layout-resize-handle')) return;
  const handle = document.createElement('span');
  handle.className = 'win-layout-resize-handle';
  handle.setAttribute('aria-label', '창 크기 조절');
  handle.addEventListener('pointerdown', event => {
    if (!windowLayoutEditing || event.button !== 0) return;
    const rect = el.getBoundingClientRect();
    resizingWindow = { el, pointerId: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  });
  handle.addEventListener('pointermove', event => {
    if (!resizingWindow || resizingWindow.el !== el || resizingWindow.pointerId !== event.pointerId) return;
    const left = Number.parseFloat(el.style.left) || 0;
    const top = Number.parseFloat(el.style.top) || 0;
    const width = Math.max(160, Math.min(innerWidth - left, resizingWindow.width + event.clientX - resizingWindow.x));
    const height = Math.max(110, Math.min(innerHeight - 32 - top, resizingWindow.height + event.clientY - resizingWindow.y));
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
  });
  const stopResize = event => {
    if (!resizingWindow || resizingWindow.el !== el) return;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    rememberWindowLayout(el);
    resizingWindow = null;
  };
  handle.addEventListener('pointerup', stopResize);
  handle.addEventListener('pointercancel', stopResize);
  el.append(handle);
}

function setWindowLayoutEditing(next) {
  if (next && !windowLayoutAdmin) return showToast('관리자 로그인 후 초기 위치를 편집할 수 있어요.');
  if (isMobile()) return showToast('창 초기 위치 편집은 데스크톱 화면에서 사용할 수 있어요.');
  const editor = document.getElementById('window-layout-editor');
  windowLayoutEditing = next;
  document.body.classList.toggle('window-layout-editing', next);
  editor.hidden = !next;
  if (!next) {
    document.querySelectorAll('.win').forEach(el => el.classList.remove('layout-editing'));
    return;
  }
  layoutEditSnapshot = snapshotWindowLayout();
  document.querySelectorAll('.win').forEach(addWindowResizeHandle);
  [...OPEN_WINS].forEach(id => document.getElementById(id)?.classList.add('layout-editing'));
}

async function saveInitialWindowLayout() {
  if (!windowLayoutAdmin) return;
  document.querySelectorAll('.win.layout-editing').forEach(el => {
    rememberWindowLayout(el);
    const layout = windowLayout.get(el.id);
    if (!layout) return;
    const savedLayout = {
      x: layout.x,
      y: layout.y,
    };
    if (!DEFAULT_SIZED_WINDOWS.has(el.id)) {
      savedLayout.width = Math.round(el.offsetWidth);
      savedLayout.height = Math.round(el.offsetHeight);
    }
    savedInitialLayout[el.id] = savedLayout;
  });
  const saveButton = document.getElementById('window-layout-save');
  saveButton.disabled = true;
  try {
    const response = await fetch('/__local-window-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ windows: savedInitialLayout }),
    });
    if (!response.ok) throw new Error(`local-save-${response.status}`);
    setWindowLayoutEditing(false);
    showToast('초기 배치를 저장했습니다. 배포하면 모두에게 반영됩니다.');
  } catch (error) {
    cancelInitialWindowLayout();
    const status = /^local-save-(\d+)$/.exec(error?.message || '')?.[1];
    showToast(status ? `초기 배치 저장에 실패했습니다. (HTTP ${status})` : '로컬 개발 서버에서만 저장할 수 있습니다. npm run dev로 실행해 주세요.');
  } finally {
    saveButton.disabled = false;
  }
}

function cancelInitialWindowLayout() {
  layoutEditSnapshot.forEach((style, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    Object.assign(el.style, style);
    if (el.style.display !== 'none') rememberWindowLayout(el);
  });
  setWindowLayoutEditing(false);
}

document.getElementById('window-layout-edit')?.addEventListener('click', () => {
  document.getElementById('start-menu').hidden = true;
  setWindowLayoutEditing(true);
});
document.getElementById('window-layout-save')?.addEventListener('click', saveInitialWindowLayout);
document.getElementById('window-layout-cancel')?.addEventListener('click', cancelInitialWindowLayout);

async function connectInitialWindowLayout() {
  try {
    const response = await fetch(INITIAL_LAYOUT_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error('load-layout');
    const data = await response.json();
    if (!data || typeof data !== 'object' || !data.windows || typeof data.windows !== 'object') return;
    Object.keys(savedInitialLayout).forEach(key => delete savedInitialLayout[key]);
    Object.assign(savedInitialLayout, data.windows);
    if (desktopInitialized && isDesktopMaximized()) {
      setInitialDesktopPositions();
      visibleDesktopWindows().forEach(rememberWindowLayout);
    }
  } catch {
    // The built-in default layout remains available when the JSON is absent.
  }
}

function setWindowLayoutAdmin(enabled) {
  windowLayoutAdmin = enabled;
  const edit = document.getElementById('window-layout-edit');
  if (edit) edit.hidden = !enabled;
  if (!enabled && windowLayoutEditing) cancelInitialWindowLayout();
}

connectInitialWindowLayout();

function spark(x, y) {
  const el = document.createElement('div');
  el.className = 'sparkle';
  el.textContent = chars[Math.floor(Math.random() * chars.length)];
  el.style.left  = (x + (Math.random() - 0.5) * 20) + 'px';
  el.style.top   = (y + (Math.random() - 0.5) * 20) + 'px';
  el.style.color = cols[Math.floor(Math.random() * cols.length)];
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 700);
}

// ── 시계 ──
const DAYS = ['일','월','화','수','목','금','토'];
function tick() {
  const n = new Date(), p = v => String(v).padStart(2, '0');
  document.getElementById('clock').textContent =
    `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
  document.getElementById('date-disp').textContent =
    `${n.getFullYear()}.${p(n.getMonth()+1)}.${p(n.getDate())} (${DAYS[n.getDay()]})`;
  document.getElementById('taskbar-clock').textContent =
    `${p(n.getHours())}:${p(n.getMinutes())}`;
  const mc = document.getElementById('mobile-clock-display');
  if (mc) mc.textContent = `${p(n.getHours())}:${p(n.getMinutes())}`;
}
setInterval(tick, 1000); tick();

// ── 초기 위치 설정 ──
window.addEventListener('load', () => {
  if (isMobile()) {
    // 모바일: 모든 창을 EXIST에 등록하고 홈 패널을 활성화
    Object.keys(WIN_META).forEach(id => EXIST_WINS.add(id));
    mobileActivate('win-welcome');
    return;
  }

  // 데스크탑: 위치 계산 후 배치
  const W = innerWidth, H = innerHeight;
  const setPos = (id, x, y) => {
    const el = document.getElementById(id);
    if (!el) return;
    const maxLeft = Math.max(0, W - el.offsetWidth);
    const maxTop = Math.max(0, H - el.offsetHeight - 32);
    el.style.left = Math.min(maxLeft, Math.max(0, x)) + 'px';
    el.style.top  = Math.min(maxTop,  Math.max(0, y)) + 'px';
  };

  // Every desktop reload starts from this fixed set.  Window positions may be
  // remembered, but previous open/minimized/closed states must not be restored.
  const initiallyOpen = ['win-profile', 'win-clock', 'win-welcome', 'win-music'];
  initiallyOpen.forEach(id => EXIST_WINS.add(id));
  initiallyOpen.forEach(id => OPEN_WINS.add(id));

  setPos('win-profile', 100, 48);
  setPos('win-clock',   100, 290);

  const wel = document.getElementById('win-welcome');
  setPos('win-welcome', (W - wel.offsetWidth) / 2, 48);

  const dia = document.getElementById('win-diary');
  setPos('win-diary', (W - dia.offsetWidth) / 2 + 30, 90);

  const board = document.getElementById('win-board');
  setPos('win-board', (W - board.offsetWidth) / 2 + 15, 82);

  const typing = document.getElementById('win-typing');
  setPos('win-typing', (W - typing.offsetWidth) / 2 + 50, 110);

  const guestbook = document.getElementById('win-guestbook');
  setPos('win-guestbook', (W - guestbook.offsetWidth) / 2 - 20, 75);

  const music = document.getElementById('win-music');
  setPos('win-music', (W - music.offsetWidth) / 2 + 80, 145);

  Object.entries(savedWindowState).forEach(([id, saved]) => {
    const el = document.getElementById(id);
    if (!el || !saved || typeof saved !== 'object') return;

    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      setPos(id, saved.left, saved.top);
    }

  });

  // A maximized desktop always starts from the intended default arrangement.
  if (isDesktopMaximized()) setInitialDesktopPositions();

  // Record the desktop arrangement once.  Future resize events use these
  // relative coordinates instead of leaving windows pinned to a small view.
  visibleDesktopWindows().forEach(rememberWindowLayout);
  wasDesktopMaximized = isDesktopMaximized();
  desktopInitialized = true;

  initiallyOpen.forEach(focusWin);
  updateTaskbar();
  window.dispatchEvent(new Event('window-state-change'));
});

// HTML의 기존 클릭 핸들러와 Firebase 모듈에서 사용하는 UI 함수를 노출한다.
Object.assign(window, { closeWin, icoClick, minimizeWin, openWin, showToast, connectInitialWindowLayout, setWindowLayoutAdmin });
