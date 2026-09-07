// ── 윈도우 메타 ──
const WIN_META = {
  'win-profile': { label: '🌸 프로필' },
  'win-clock':   { label: '⏰ 현재 시각' },
  'win-welcome': { label: '🏠 홈' },
  'win-diary':   { label: '📔 다이어리' },
  'win-typing':  { label: '⌨ 타자 놀이' },
};
const OPEN_WINS = new Set();  // currently open (not minimized) windows
const EXIST_WINS = new Set(); // windows that haven't been closed

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
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('open');
  el.style.display = 'block';
  OPEN_WINS.add(id);
  EXIST_WINS.add(id);
  focusWin(id);
}

// ── 닫기 (완전히 숨김) ──
function closeWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  el.style.display = 'none';
  OPEN_WINS.delete(id);
  EXIST_WINS.delete(id);
  updateTaskbar();
}

// ── 최소화 (taskbar로) ──
function minimizeWin(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  OPEN_WINS.delete(id);
  updateTaskbar();
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
        focusWin(id);
      } else {
        focusWin(id);
      }
      updateTaskbar();
    };
    container.appendChild(btn);
  });
}

// ── 데스크탑 아이콘 클릭 ──
let selectedIco = null;
function icoClick(el, winId) {
  if (selectedIco) selectedIco.classList.remove('active');
  el.classList.add('active');
  selectedIco = el;
  if (winId) {
    const win = document.getElementById(winId);
    if (!win) return;
    EXIST_WINS.add(winId);
    win.style.display = 'block';
    OPEN_WINS.add(winId);
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
const cur   = document.getElementById('cursor');
const chars = ['✿','★','♡','✦','♪','✶'];
const cols  = ['#e8547a','#ff8fab','#ffb3c6','#c45a7a','#ff6b9d'];

document.addEventListener('mousemove', e => {
  cur.style.left = e.clientX + 'px';
  cur.style.top  = e.clientY + 'px';
  if (dragEl) {
    dragEl.style.left = (e.clientX - dox) + 'px';
    dragEl.style.top  = (e.clientY - doy) + 'px';
    return;
  }
  if (Math.random() < 0.15) spark(e.clientX, e.clientY);
});
document.addEventListener('mouseup', () => { dragEl = null; });

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
}
setInterval(tick, 1000); tick();

// ── 초기 위치 설정 ──
window.addEventListener('load', () => {
  const W = innerWidth, H = innerHeight;
  const setPos = (id, x, y) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.left = Math.max(0, x) + 'px';
    el.style.top  = Math.max(0, y) + 'px';
  };

  // 처음에 열려있는 윈도우들
  ['win-profile','win-clock','win-welcome'].forEach(id => EXIST_WINS.add(id));
  ['win-profile','win-clock','win-welcome'].forEach(id => OPEN_WINS.add(id));

  // 위치
  setPos('win-profile', 100, 48);
  setPos('win-clock',   100, 290);

  const wel = document.getElementById('win-welcome');
  setPos('win-welcome', (W - wel.offsetWidth) / 2, 48);

  const dia = document.getElementById('win-diary');
  setPos('win-diary', (W - dia.offsetWidth) / 2 + 30, 90);

  const typing = document.getElementById('win-typing');
  setPos('win-typing', (W - typing.offsetWidth) / 2 + 50, 110);

  // 초기 z-index
  document.getElementById('win-profile').style.zIndex = 11;
  document.getElementById('win-clock').style.zIndex   = 12;
  document.getElementById('win-welcome').style.zIndex  = 13;

  updateTaskbar();
});

// HTML의 기존 클릭 핸들러와 Firebase 모듈에서 사용하는 UI 함수를 노출한다.
Object.assign(window, { closeWin, icoClick, minimizeWin, openWin, showToast });
