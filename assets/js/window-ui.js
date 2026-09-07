// ── 윈도우 메타 ──
const WIN_META = {
  'win-profile': { label: '🌸 프로필' },
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

function readWindowState() {
  try {
    const saved = JSON.parse(localStorage.getItem(WINDOW_STATE_KEY));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

const savedWindowState = readWindowState();
const isMobile = window.matchMedia('(max-width: 560px)').matches;

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
let pct = 0;
const barEl  = document.getElementById('load-bar');
const pctEl  = document.getElementById('load-pct');
const loadIv = setInterval(() => {
  pct = Math.min(100, pct + Math.floor(Math.random() * 9) + 3);
  barEl.style.width = pct + '%';
  pctEl.textContent = pct + '%';
  if (pct >= 100) {
    clearInterval(loadIv);
    setTimeout(() => {
      const ol = document.getElementById('loading-overlay');
      ol.classList.add('hidden');
      setTimeout(() => ol.remove(), 600);
    }, 350);
  }
}, 80);

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
  if (isMobile) { mobileActivate(id); return; }
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.style.display = 'block';
  OPEN_WINS.add(id);
  EXIST_WINS.add(id);
  saveWindowState(id, 'open');
  focusWin(id);
  el.dispatchEvent(new CustomEvent('win-open', { bubbles: false }));
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
  if (!isMobile) saveWindowState(id, 'closed');
  if (!isMobile) updateTaskbar();
}

// ── 최소화 (taskbar로) ──
function minimizeWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('mobile-active');
  el.style.display = 'none';
  OPEN_WINS.delete(id);
  if (!isMobile) saveWindowState(id, 'minimized');
  if (!isMobile) updateTaskbar();
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
}

// ── 데스크탑 아이콘 클릭 ──
let selectedIco = null;
function icoClick(el, winId) {
  if (isMobile) {
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
    const taskbarH = 28;
    const maxLeft = Math.max(0, window.innerWidth - dragEl.offsetWidth);
    const maxTop  = Math.max(0, window.innerHeight - dragEl.offsetHeight - taskbarH);
    dragEl.style.left = Math.max(0, Math.min(maxLeft, e.clientX - dox)) + 'px';
    dragEl.style.top  = Math.max(0, Math.min(maxTop,  e.clientY - doy)) + 'px';
    return;
  }
  if (Math.random() < 0.15) spark(e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => {
  if (dragEl) saveWindowState(dragEl.id, 'open');
  dragEl = null;
});

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
  if (isMobile) {
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
    const maxTop = Math.max(0, H - el.offsetHeight - 28);
    el.style.left = Math.min(maxLeft, Math.max(0, x)) + 'px';
    el.style.top  = Math.min(maxTop,  Math.max(0, y)) + 'px';
  };

  ['win-profile','win-clock','win-welcome'].forEach(id => EXIST_WINS.add(id));
  ['win-profile','win-clock','win-welcome'].forEach(id => OPEN_WINS.add(id));

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

    if (saved.state === 'closed') {
      el.classList.remove('open');
      el.style.display = 'none';
      OPEN_WINS.delete(id);
      EXIST_WINS.delete(id);
    } else if (saved.state === 'minimized') {
      el.classList.remove('open');
      el.style.display = 'none';
      OPEN_WINS.delete(id);
      EXIST_WINS.add(id);
    } else if (saved.state === 'open') {
      el.classList.add('open');
      el.style.display = 'block';
      OPEN_WINS.add(id);
      EXIST_WINS.add(id);
    }
  });

  ['win-profile', 'win-clock', 'win-welcome'].forEach(focusWin);
  updateTaskbar();
});

// HTML의 기존 클릭 핸들러와 Firebase 모듈에서 사용하는 UI 함수를 노출한다.
Object.assign(window, { closeWin, icoClick, minimizeWin, openWin, showToast });
