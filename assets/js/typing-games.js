import { TYPING_CONTENT } from './typing-content.js';

const cleanItems = (items) => Array.isArray(items)
  ? items.map((item) => String(item).trim()).filter(Boolean)
  : [];
const sentences = cleanItems(TYPING_CONTENT.sentences);
const words = cleanItems(TYPING_CONTENT.words);
const $ = (selector) => document.querySelector(selector);

const practiceText = $('#typing-practice-text');
const practiceInput = $('#typing-practice-input');
const practiceSpeed = $('#typing-practice-speed');
const practiceNext = $('#typing-practice-next');
const rainField = $('#acid-rain-field');
const rainInput = $('#acid-rain-input');
const rainStart = $('#acid-rain-start');
const rainScore = $('#acid-rain-score');
const rainLife = $('#acid-rain-life');
const rainLevel = $('#acid-rain-level');
const rainStatus = $('#acid-rain-status');
let sentenceIndex = 0;
let practiceStartedAt = null;
let practiceSpeedTimer = null;
let lastPracticeSpeed = null;
let fallingWords = [];
let rainSpawnTimer = null;
let rainFallTimer = null;
let rainRunning = false;
let score = 0;
let life = 3;
let level = 1;

function renderPractice() {
  practiceStartedAt = null;
  clearInterval(practiceSpeedTimer);
  practiceSpeedTimer = null;
  practiceSpeed.textContent = '속도 -- 타/분';
  if (!sentences.length) {
    practiceText.textContent = 'typing-content.js에 문장을 추가해 주세요.';
    practiceInput.disabled = true;
    practiceNext.disabled = true;
    return;
  }
  const sentence = sentences[sentenceIndex % sentences.length];
  renderPracticeCharacters(sentence);
  practiceInput.disabled = false;
  practiceNext.disabled = false;
  practiceInput.value = '';
  practiceInput.maxLength = sentence.length;
}
function renderPracticeCharacters(target, typed = '') {
  const targetCharacters = Array.from(target);
  const typedCharacters = Array.from(typed);
  practiceText.replaceChildren();
  targetCharacters.forEach((character, index) => {
    const letter = document.createElement('span');
    letter.className = 'practice-char';
    if (index < typedCharacters.length) {
      letter.classList.add(typedCharacters[index] === character ? 'correct' : 'incorrect');
    } else letter.classList.add('pending');
    const displayedCharacter = index < typedCharacters.length ? typedCharacters[index] : character;
    letter.textContent = displayedCharacter === ' ' ? '\u00a0' : displayedCharacter;
    practiceText.append(letter);
  });
}
function updatePracticeSpeed() {
  if (!practiceStartedAt) return;
  const elapsedMinutes = (performance.now() - practiceStartedAt) / 60000;
  const speed = Math.round(practiceInput.value.length / Math.max(elapsedMinutes, 1 / 60));
  lastPracticeSpeed = speed;
  practiceSpeed.textContent = `속도 ${speed} 타/분`;
}
function advancePractice() {
  const completedSpeed = lastPracticeSpeed;
  sentenceIndex = (sentenceIndex + 1) % sentences.length;
  renderPractice();
  if (completedSpeed !== null) practiceSpeed.textContent = `\uC18D\uB3C4 ${completedSpeed} \uD0C0/\uBD84`;
  practiceInput.focus();
}
practiceInput.addEventListener('input', () => {
  const target = sentences[sentenceIndex % sentences.length] || '';
  const typed = practiceInput.value;
  if (!target) return;
  renderPracticeCharacters(target, typed);
  if (practiceInput.value && !practiceStartedAt) {
    practiceStartedAt = performance.now();
    practiceSpeedTimer = setInterval(updatePracticeSpeed, 250);
  }
  if (!practiceInput.value) {
    practiceStartedAt = null;
    clearInterval(practiceSpeedTimer);
    practiceSpeedTimer = null;
    practiceSpeed.textContent = '속도 -- 타/분';
  }
  updatePracticeSpeed();
  if (typed === target) {
    clearInterval(practiceSpeedTimer);
    practiceSpeedTimer = null;
  }
});
practiceInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  if (practiceInput.value === sentences[sentenceIndex % sentences.length]) advancePractice();
});
practiceNext.addEventListener('click', advancePractice);

function updateRainStats() {
  rainScore.textContent = String(score).padStart(4, '0');
  rainLife.textContent = '♥'.repeat(life) + '♡'.repeat(3 - life);
  rainLevel.textContent = String(level);
}
function clearRain() { fallingWords.forEach(({ element }) => element.remove()); fallingWords = []; }
function clearRainTimers() {
  clearInterval(rainSpawnTimer);
  clearInterval(rainFallTimer);
  rainSpawnTimer = null;
  rainFallTimer = null;
}
function stopRain(message) {
  rainRunning = false;
  clearRainTimers();
  rainStart.textContent = '새 게임';
  if (message) rainStatus.textContent = message;
}
function resultMessage(prefix) {
  return `${prefix} 점수 ${score}점 · 레벨 ${level}`;
}
function finishRain(prefix) {
  if (!rainRunning) return;
  stopRain(resultMessage(prefix));
  clearRain();
}
function pauseRain() {
  if (!rainRunning) return;
  stopRain('게임이 멈췄습니다. 산성비 탭을 열면 새 게임이 시작됩니다.');
  clearRain();
}
function spawnWord() {
  if (!rainRunning || !words.length) return;
  const element = document.createElement('span');
  element.className = 'falling-word';
  const text = words[Math.floor(Math.random() * words.length)];
  element.textContent = text;
  const maxLeft = Math.max(0, rainField.clientWidth - 78);
  // Keep every position on a small pixel grid for a deliberately choppy, old-game fall.
  const item = { text, element, left: Math.floor((Math.random() * maxLeft) / 4) * 4, top: -20 };
  element.style.left = `${item.left}px`;
  element.style.top = `${item.top}px`;
  rainField.append(element);
  fallingWords.push(item);
}
function rainTick() {
  if (!rainRunning) return;
  const limit = rainField.clientHeight - 20;
  fallingWords = fallingWords.filter((item) => {
    item.top += 1;
    item.element.style.top = `${item.top}px`;
    if (item.top < limit) return true;
    item.element.remove();
    life -= 1;
    updateRainStats();
    if (life <= 0) finishRain('GAME OVER!');
    return false;
  });
}
function startRain() {
  if (!words.length) { rainStatus.textContent = 'typing-content.js에 단어를 추가해 주세요.'; return; }
  if (rainRunning) return;
  clearRainTimers();
  clearRain(); score = 0; life = 3; level = 1; rainRunning = true;
  rainStart.textContent = '끝내기';
  rainStatus.textContent = '떨어지는 단어를 입력하고 Enter!';
  updateRainStats(); rainInput.value = ''; rainInput.focus(); spawnWord();
  rainFallTimer = setInterval(rainTick, 125);
  rainSpawnTimer = setInterval(() => { spawnWord(); level = Math.min(9, 1 + Math.floor(score / 80)); updateRainStats(); }, 3200);
}
rainStart.addEventListener('click', () => {
  if (rainRunning) finishRain('게임 종료!');
  else startRain();
});
rainInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' || !rainRunning) return;
  event.preventDefault();
  const typed = rainInput.value.trim();
  const match = fallingWords.find((item) => item.text === typed);
  if (match) {
    match.element.classList.add('popped');
    setTimeout(() => match.element.remove(), 180);
    fallingWords = fallingWords.filter((item) => item !== match);
    score += typed.length * 5;
    rainStatus.textContent = 'GOOD!';
    updateRainStats();
  } else rainStatus.textContent = typed ? '그 단어는 아직 없어요.' : '단어를 입력해 주세요.';
  rainInput.value = '';
});
document.querySelectorAll('[data-typing-mode]').forEach((button) => button.addEventListener('click', () => {
  const mode = button.dataset.typingMode;
  if (mode !== 'rain') pauseRain();
  document.querySelectorAll('[data-typing-mode]').forEach((item) => item.classList.toggle('active', item === button));
  document.querySelectorAll('.typing-panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== mode; });
  if (mode === 'rain') startRain();
  else practiceInput.focus();
}));
document.querySelector('#win-typing .win-btns').addEventListener('click', pauseRain);
renderPractice();
updateRainStats();
