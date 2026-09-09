const $ = (selector) => document.querySelector(selector);
const random = {
  board: $('#typing-random-board'), text: $('#typing-random-text'), input: $('#typing-random-input'),
  status: $('#typing-random-status'), speed: $('#typing-random-speed'), next: $('#typing-random-next'), sentences: [], last: '', started: null, lastInputAt: null, elapsed: 0, timer: null, idleTimer: null,
};
const rainField = $('#acid-rain-field');
const rainInput = $('#acid-rain-input');
const rainStart = $('#acid-rain-start');
const rainScore = $('#acid-rain-score');
const rainLife = $('#acid-rain-life');
const rainLevel = $('#acid-rain-level');
const rainStatus = $('#acid-rain-status');
const boardCache = new Map();
let publicBoards = [];

function validPosts(posts) {
  return Array.isArray(posts) ? posts.filter((post) => typeof post?.content === 'string' && post.content.trim()).map((post) => ({
    title: typeof post.title === 'string' && post.title.trim() ? post.title.trim() : '제목 없는 글', content: post.content.trim(),
  })) : [];
}
function populateBoards(select, placeholder) {
  const previous = select.value;
  const byId = new Map(publicBoards.map((board) => [board.id, board]));
  boardCache.forEach(({ board }) => byId.set(board.id, board));
  select.replaceChildren();
  const first = document.createElement('option'); first.value = ''; first.textContent = placeholder; select.append(first);
  byId.forEach((board) => { const option = document.createElement('option'); option.value = board.id; option.textContent = board.name; select.append(option); });
  if (byId.has(previous)) select.value = previous;
}
function refreshBoards() { populateBoards(random.board, '게시판 선택'); }
function normalizeTyping(value) {
  return value
    .replace(/[“”„‟〝〞＂]/g, '"')
    .replace(/\.\.\.|⋯/g, '⋯');
}
function matchesTarget(typed, target) { return normalizeTyping(typed) === normalizeTyping(target); }
function renderTarget(element, target, typed = '', cursorIndex = null) {
  const targetChars = Array.from(target), typedChars = Array.from(typed);
  const caretIndex = Math.min(Math.max(0, cursorIndex === null ? typedChars.length : cursorIndex), targetChars.length);
  element.replaceChildren();
  targetChars.forEach((character, index) => {
    if (index === caretIndex) {
      const caret = document.createElement('span'); caret.className = 'practice-caret'; caret.setAttribute('aria-hidden', 'true'); element.append(caret);
    }
    const span = document.createElement('span'); span.className = 'practice-char';
    span.classList.add(index < typedChars.length ? (normalizeTyping(typedChars[index]) === normalizeTyping(character) ? 'correct' : 'incorrect') : 'pending');
    const displayed = index < typedChars.length ? typedChars[index] : character;
    span.textContent = displayed; element.append(span);
  });
  if (caretIndex >= targetChars.length) {
    const caret = document.createElement('span'); caret.className = 'practice-caret'; caret.setAttribute('aria-hidden', 'true'); element.append(caret);
  }
}
const IDLE_PAUSE_MS = 5000;
function characterCount(value) { return Array.from(value).length; }
function elapsedTime(state) { return state.elapsed + (state.started ? performance.now() - state.started : 0); }
function speed(state) { return Math.round(((state.offset || 0) + characterCount(state.input.value)) / Math.max(elapsedTime(state) / 60000, 1 / 60)); }
function updateMeter(state, label = '') {
  const count = (state.offset || 0) + characterCount(state.input.value);
  state.speed.textContent = `${label ? `${label} · ` : ''}${count}타 · 속도 ${count ? speed(state) : '--'} 타/분`;
}
function resetTimer(state, preserveMeter = false) { clearInterval(state.timer); clearTimeout(state.idleTimer); state.timer = null; state.idleTimer = null; state.started = null; state.lastInputAt = null; state.elapsed = 0; if (!preserveMeter) updateMeter(state); }
function pauseTimer(state, label = '멈춤') {
  if (!state.started) return;
  state.elapsed += (state.lastInputAt || performance.now()) - state.started;
  state.started = null;
  clearInterval(state.timer); state.timer = null;
  updateMeter(state, label);
}
function scheduleIdlePause(state) {
  clearTimeout(state.idleTimer);
  state.idleTimer = setTimeout(() => pauseTimer(state), IDLE_PAUSE_MS);
}
function cursorIndex(state) { return characterCount(state.input.value.slice(0, state.input.selectionStart ?? state.input.value.length)); }
function scrollTarget(state, target, index = cursorIndex(state)) {
  if (state.text.scrollHeight <= state.text.clientHeight) return;
  const currentIndex = Math.min(index, characterCount(target) - 1);
  const currentCharacter = state.text.querySelectorAll('.practice-char')[currentIndex];
  if (!currentCharacter) return;
  const height = state.text.clientHeight;
  const lowerBound = state.text.scrollTop + height * 0.68;
  const upperBound = state.text.scrollTop + height * 0.20;
  if (currentCharacter.offsetTop > lowerBound) state.text.scrollTop = Math.max(0, currentCharacter.offsetTop - height * 0.68);
  else if (currentCharacter.offsetTop < upperBound) state.text.scrollTop = Math.max(0, currentCharacter.offsetTop - height * 0.20);
  state.input.scrollTop = state.text.scrollTop;
}
function trackInput(state, target) {
  const index = cursorIndex(state);
  renderTarget(state.text, target, state.input.value, index);
  scrollTarget(state, target, index);
  const inputAt = performance.now();
  if (state.input.value && !state.started) { state.started = inputAt; state.timer = setInterval(() => updateMeter(state), 250); }
  state.lastInputAt = inputAt;
  scheduleIdlePause(state);
  updateMeter(state);
  if (matchesTarget(state.input.value, target)) { pauseTimer(state, '완료'); clearTimeout(state.idleTimer); }
}
function syncCursor(state, target) {
  const index = cursorIndex(state);
  renderTarget(state.text, target, state.input.value, index);
  scrollTarget(state, target, index);
}
async function getPosts(id) {
  if (!id) return [];
  if (boardCache.has(id)) return boardCache.get(id).posts;
  const board = publicBoards.find((item) => item.id === id && item.public);
  if (!board) return [];
  const response = await fetch(`board-data/${encodeURIComponent(id)}.json`, { cache: 'no-store' });
  if (!response.ok) throw new Error('board unavailable');
  const posts = validPosts((await response.json()).posts);
  boardCache.set(id, { board, posts }); return posts;
}
function hasVisibleText(value) {
  return value.replace(/[\s\u00A0\u200B-\u200D\u2060\uFEFF]/gu, '').length > 0;
}
function sentences(posts) {
  return posts.flatMap((post) => post.content
    .split(/(?<=[.!?…。！？])\s+|\n+/u)
    .map((sentence) => sentence.trim())
    .filter(hasVisibleText));
}
function renderRandom() {
  const preservePreviousMeter = characterCount(random.input.value) > 0;
  random.input.value = ''; resetTimer(random, preservePreviousMeter);
  if (!random.sentences.length) { random.text.textContent = '게시판을 선택해 주세요.'; random.input.disabled = true; random.next.disabled = true; return; }
  const pool = random.sentences.length > 1 ? random.sentences.filter((sentence) => sentence !== random.last) : random.sentences;
  random.last = pool[Math.floor(Math.random() * pool.length)]; renderTarget(random.text, random.last);
  random.input.disabled = false; random.next.disabled = false;
  // A middle-dot ellipsis (⋯) may be typed as three ordinary periods (...).
  random.input.maxLength = random.last.length + (random.last.match(/⋯/g)?.length || 0) * 2;
  random.input.focus();
}
async function chooseRandomBoard() {
  random.status.textContent = '';
  try { random.sentences = sentences(await getPosts(random.board.value)); random.last = ''; if (random.board.value && !random.sentences.length) random.status.textContent = '문장으로 나눌 수 있는 글이 없습니다.'; }
  catch { random.sentences = []; random.status.textContent = '게시글을 불러오지 못했습니다.'; }
  renderRandom();
}
random.board.addEventListener('change', chooseRandomBoard);
random.next.addEventListener('click', renderRandom);
random.input.addEventListener('input', () => { if (random.last) trackInput(random, random.last); });
['keyup', 'click', 'select'].forEach((eventName) => random.input.addEventListener(eventName, () => {
  if (random.last) syncCursor(random, random.last);
}));
random.input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && matchesTarget(random.input.value, random.last)) { event.preventDefault(); renderRandom(); } });
window.addEventListener('board-content-available', (event) => { const { board, posts } = event.detail || {}; if (!board?.id) return; boardCache.set(board.id, { board, posts: validPosts(posts) }); refreshBoards(); });
fetch('board-data/manifest.json', { cache: 'no-store' }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { publicBoards = Array.isArray(data.boards) ? data.boards.filter((board) => board?.public && typeof board.id === 'string' && typeof board.name === 'string') : []; refreshBoards(); }).catch(refreshBoards);
refreshBoards(); renderRandom();

const words = ['바나나', '딸기', '구름', '별빛', '하트', '리본', '고양이', '우체통'];
let fallingWords = [], rainSpawnTimer = null, rainFallTimer = null, rainRunning = false, score = 0, life = 3, level = 1;
function updateRainStats() { rainScore.textContent = String(score).padStart(4, '0'); rainLife.textContent = '♥'.repeat(life) + '♡'.repeat(3 - life); rainLevel.textContent = String(level); }
function clearRain() { fallingWords.forEach(({ element }) => element.remove()); fallingWords = []; }
function clearRainTimers() { clearInterval(rainSpawnTimer); clearInterval(rainFallTimer); rainSpawnTimer = null; rainFallTimer = null; }
function stopRain(message) { rainRunning = false; clearRainTimers(); rainStart.textContent = '새 게임'; if (message) rainStatus.textContent = message; }
function finishRain(prefix) { if (!rainRunning) return; stopRain(`${prefix} 점수 ${score}점 · 레벨 ${level}`); clearRain(); }
function pauseRain() { if (!rainRunning) return; stopRain('게임을 멈췄습니다. 산성비 탭을 열면 새 게임이 시작됩니다.'); clearRain(); }
function spawnWord() { if (!rainRunning) return; const element = document.createElement('span'); element.className = 'falling-word'; const text = words[Math.floor(Math.random() * words.length)]; element.textContent = text; const item = { text, element, left: Math.floor((Math.random() * Math.max(0, rainField.clientWidth - 78)) / 4) * 4, top: -20 }; element.style.left = `${item.left}px`; element.style.top = `${item.top}px`; rainField.append(element); fallingWords.push(item); }
function rainTick() { if (!rainRunning) return; const limit = rainField.clientHeight - 20; fallingWords = fallingWords.filter((item) => { item.top += 1; item.element.style.top = `${item.top}px`; if (item.top < limit) return true; item.element.remove(); life -= 1; updateRainStats(); if (life <= 0) finishRain('GAME OVER!'); return false; }); }
function startRain() { if (rainRunning) return; clearRainTimers(); clearRain(); score = 0; life = 3; level = 1; rainRunning = true; rainStart.textContent = '끝내기'; rainStatus.textContent = '떨어지는 단어를 입력하고 Enter!'; updateRainStats(); rainInput.value = ''; rainInput.focus(); spawnWord(); rainFallTimer = setInterval(rainTick, 125); rainSpawnTimer = setInterval(() => { spawnWord(); level = Math.min(9, 1 + Math.floor(score / 80)); updateRainStats(); }, 3200); }
rainStart.addEventListener('click', () => { if (rainRunning) finishRain('게임 종료!'); else startRain(); });
rainInput.addEventListener('keydown', (event) => { if (event.key !== 'Enter' || !rainRunning) return; event.preventDefault(); const typed = rainInput.value.trim(); const match = fallingWords.find((item) => item.text === typed); if (match) { match.element.classList.add('popped'); setTimeout(() => match.element.remove(), 180); fallingWords = fallingWords.filter((item) => item !== match); score += typed.length * 5; rainStatus.textContent = 'GOOD!'; updateRainStats(); } else rainStatus.textContent = typed ? '그 단어는 아직 없어요.' : '단어를 입력해 주세요.'; rainInput.value = ''; });
document.querySelectorAll('[data-typing-mode]').forEach((button) => button.addEventListener('click', () => { const mode = button.dataset.typingMode; if (mode !== 'rain') pauseRain(); document.querySelectorAll('[data-typing-mode]').forEach((item) => item.classList.toggle('active', item === button)); document.querySelectorAll('.typing-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== mode; }); if (mode === 'rain') startRain(); else random.input.focus(); }));
document.querySelector('#win-typing .win-btns').addEventListener('click', pauseRain);
updateRainStats();
