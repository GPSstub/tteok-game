'use strict';

/* ==========================================================================
   떡치기 게임
   - body[data-character="pig"] 이면 돼지 모드, 아니면 토끼 모드
   ========================================================================== */

// ---------- 설정값 ----------
const ROUND_TIME_MS = 10000; // 패턴 하나당 제한 시간
const MAX_LIVES = 6;         // 절구(목숨) 개수
const MAX_PATTERN_LENGTH = 48;
const TOKENS_PER_ROW = 6;
const WARNING_TIME_MS = 3000; // 이 이하로 남으면 타이머 바가 붉게 변함

const RECIPES = ['쑥송편', '콩송편', '깨송편', '밤송편'];

const isPig = document.body.dataset.character === 'pig';

const COLORS = isPig
  ? ['yellow', 'red', 'orange', 'purple']
  : ['teal', 'green', 'blue', 'pink'];

const COLOR_NAMES = isPig
  ? ['노랑', '빨강', '주황', '보라']
  : ['청록', '초록', '파랑', '분홍'];

// 돼지 모드에서 "짝수 칸마다 랜덤, 홀수 칸은 항상 이 색(보라)" 규칙에 쓰는 인덱스
const PIG_FIXED_COLOR = 3;
const PIG_FIRST_ROUND_COLOR = 2;

const COLOR_PRESSED_MS = 90;

// 랭킹 (이 기기의 localStorage에 저장 · 토끼/돼지 따로 관리)
const RANKING_SIZE = 10;
const RANKING_KEY = `tteok-ranking-${isPig ? 'pig' : 'rabbit'}`;
const PLAYER_NAME_KEY = 'tteok-player-name';
const MAX_NAME_LENGTH = 8;
const DEFAULT_NAME = '익명';

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);
const inputButtons = [...document.querySelectorAll('.input')];

// ---------- 게임 상태 ----------
let round = 1;
let score = 0;
let combo = 0;
let maxCombo = 0;
let lives = MAX_LIVES;
let remaining = ROUND_TIME_MS; // 남은 시간(ms)
let pattern = [];              // 색 인덱스 배열
let position = 0;              // 지금 눌러야 할 패턴 위치
let mode = 'ready';            // 'ready' | 'playing' | 'paused' | 'ended'
let lastFrameTime = 0;

// ---------- 랭킹 상태 ----------
let pendingRecord = null; // 게임이 끝난 뒤 아직 저장하지 않은 기록
let lastSavedId = null;   // 방금 저장한 기록 (랭킹에서 강조 표시용)

// ---------- 사운드 ----------
let soundEnabled = false;
let audioContext;

// ---------- 렌더링 캐시 (값이 바뀔 때만 DOM 갱신) ----------
const rendered = {};

function setText(id, value) {
  const text = String(value);
  if (rendered[id] !== text) {
    $(id).textContent = text;
    rendered[id] = text;
  }
}

/* ==========================================================================
   패턴 생성 / 렌더링
   ========================================================================== */

function getPatternLength() {
  return Math.min(MAX_PATTERN_LENGTH, 4 + Math.floor((round - 1) * 1.6));
}

function makePigPattern(length) {
  // 돼지 모드는 두 칸씩 짝을 이루도록 길이를 짝수로 맞춤
  const pairedLength = Math.min(MAX_PATTERN_LENGTH, length + (length % 2));

  return Array.from({ length: pairedLength }, (_, i) => {
    const isOddIndex = i % 2 === 1;
    if (isOddIndex) return PIG_FIXED_COLOR;
    if (round === 1) return PIG_FIRST_ROUND_COLOR;
    return Math.floor(Math.random() * 3);
  });
}

function makeRabbitPattern(length) {
  return Array.from({ length }, () =>
    round === 1 ? 0 : Math.floor(Math.random() * 4)
  );
}

function makePattern() {
  const length = getPatternLength();
  pattern = isPig ? makePigPattern(length) : makeRabbitPattern(length);
  position = 0;

  renderPattern();
  $('recipe').textContent = RECIPES[(round - 1) % RECIPES.length];
}

function createToken(colorIndex, index) {
  const token = document.createElement('div');
  token.className = 'token';

  if (index === position) token.classList.add('current');
  else if (index < position) token.classList.add('done');

  if (isPig && index % 2 === 0) token.classList.add('paired');

  token.dataset.index = index;

  const img = document.createElement('img');
  img.src = `assets/${COLORS[colorIndex]}.webp`;
  img.alt = COLOR_NAMES[colorIndex];
  token.append(img);

  return token;
}

function createRow(startIndex) {
  const row = document.createElement('div');
  row.className = 'pattern-row';

  const endIndex = Math.min(startIndex + TOKENS_PER_ROW, pattern.length);
  for (let i = startIndex; i < endIndex; i++) {
    row.append(createToken(pattern[i], i));
  }

  return row;
}

function renderPattern() {
  const root = $('pattern');
  root.replaceChildren();

  for (let start = 0; start < pattern.length; start += TOKENS_PER_ROW) {
    root.append(createRow(start));
  }
}

function getTokenElement(index) {
  return $('pattern').querySelector(`[data-index="${index}"]`);
}

/* ==========================================================================
   화면 갱신
   ========================================================================== */

function updateTimer() {
  const ratio = Math.max(0, remaining / ROUND_TIME_MS);

  setText('time', Math.max(0, remaining / 1000).toFixed(1));
  $('timebar').style.transform = `scaleX(${ratio})`;

  const barColor = remaining < WARNING_TIME_MS ? '#f06c83' : '#9283ee';
  if (rendered.barColor !== barColor) {
    $('timebar').style.background = barColor;
    rendered.barColor = barColor;
  }
}

function renderLives() {
  const root = $('lives');
  root.replaceChildren();

  for (let i = 0; i < MAX_LIVES; i++) {
    const life = document.createElement('span');
    life.className = 'life' + (i >= lives ? ' lost' : '');
    life.textContent = '▰';
    life.setAttribute('aria-hidden', 'true');
    root.append(life);
  }

  root.setAttribute('aria-label', `절구 ${lives}개 남음`);
}

function update() {
  setText('round', round);
  setText('score', score);
  setText('combo', combo);

  if (rendered.lives !== lives) {
    renderLives();
    rendered.lives = lives;
  }

  if (rendered.mode !== mode) {
    inputButtons.forEach((button) => {
      button.disabled = mode !== 'playing';
    });
    $('pause').disabled = mode !== 'playing' && mode !== 'paused';
    rendered.mode = mode;
  }

  updateTimer();
}

function animateHit(element, keyframes) {
  if (element.animate) {
    element.animate(keyframes, { duration: 160, easing: 'ease-out' });
  }
}

function animateSuccess() {
  animateHit(document.querySelector('.actor'), [
    { transform: 'translateX(-50%) translateY(0)' },
    { transform: 'translateX(-50%) translateY(-9px)' },
    { transform: 'translateX(-50%) translateY(0)' },
  ]);
}

function animateFail() {
  animateHit(document.querySelector('.field'), [
    { transform: 'translateX(0)' },
    { transform: 'translateX(-4px)' },
    { transform: 'translateX(4px)' },
    { transform: 'translateX(0)' },
  ]);
}

/* ==========================================================================
   랭킹 (localStorage)
   - 정렬: 송편 개수 ↓ → 최고 콤보 ↓ → 먼저 달성한 기록 ↑
   - 서버가 없는 정적 사이트라서 "이 기기"에서만 보이는 기록이에요
   ========================================================================== */

function compareRecords(a, b) {
  return b.score - a.score || b.maxCombo - a.maxCombo || a.date - b.date;
}

function loadRanking() {
  try {
    const saved = JSON.parse(localStorage.getItem(RANKING_KEY));
    if (!Array.isArray(saved)) return [];

    return saved
      .filter((r) => r && Number.isFinite(r.score))
      .map((r) => ({
        name: String(r.name ?? DEFAULT_NAME),
        score: r.score,
        maxCombo: Number(r.maxCombo) || 0,
        date: Number(r.date) || 0,
      }));
  } catch {
    return [];
  }
}

function saveRanking(records) {
  try {
    localStorage.setItem(RANKING_KEY, JSON.stringify(records));
  } catch {
    // 시크릿 모드 등에서 저장이 막혀 있으면 조용히 무시
  }
}

function loadPlayerName() {
  try {
    return localStorage.getItem(PLAYER_NAME_KEY) || '';
  } catch {
    return '';
  }
}

function savePlayerName(name) {
  try {
    localStorage.setItem(PLAYER_NAME_KEY, name);
  } catch {
    // 무시
  }
}

function qualifiesForRanking(record) {
  if (record.score <= 0) return false;

  const records = loadRanking().sort(compareRecords);
  if (records.length < RANKING_SIZE) return true;

  return compareRecords(record, records[records.length - 1]) < 0;
}

function addRecord(record) {
  const records = loadRanking();
  records.push(record);
  records.sort(compareRecords);
  saveRanking(records.slice(0, RANKING_SIZE));
}

function createRankingItem(record, index) {
  const item = document.createElement('li');
  if (record.date === lastSavedId) item.classList.add('me');

  const parts = [
    ['rank', index + 1],
    ['name', record.name],
    ['points', `${record.score}개`],
    ['combo', `콤보 ${record.maxCombo}`],
  ];

  parts.forEach(([className, text]) => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text; // textContent라서 이름에 HTML이 들어가도 안전
    item.append(span);
  });

  return item;
}

function renderRanking() {
  const list = $('ranking');
  list.replaceChildren();

  const records = loadRanking().sort(compareRecords).slice(0, RANKING_SIZE);

  if (records.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'ranking-empty';
    empty.textContent = '아직 기록이 없어요';
    list.append(empty);
    return;
  }

  records.forEach((record, index) => {
    list.append(createRankingItem(record, index));
  });
}

function showNameEntry() {
  $('name-entry').hidden = false;
  $('player-name').value = loadPlayerName();
}

function submitRecord() {
  if (!pendingRecord) return;

  const name =
    $('player-name').value.trim().slice(0, MAX_NAME_LENGTH) || DEFAULT_NAME;

  savePlayerName(name);
  addRecord({ ...pendingRecord, name });

  lastSavedId = pendingRecord.date;
  pendingRecord = null;

  $('name-entry').hidden = true;
  renderRanking();
}

/* ==========================================================================
   사운드
   ========================================================================== */

function playTone(isCorrect) {
  if (!soundEnabled) return;

  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = 'sine';
    // 정답: 콤보가 쌓일수록 음이 올라감 / 오답: 낮은 음
    oscillator.frequency.value = isCorrect ? 520 + (combo % 8) * 55 : 140;

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(now + 0.11);
  } catch {
    // 오디오를 못 쓰는 환경이면 조용히 무시
  }
}

/* ==========================================================================
   게임 흐름 (시작 / 종료 / 시간초과 / 일시정지)
   ========================================================================== */

function startGame() {
  round = 1;
  score = 0;
  combo = 0;
  maxCombo = 0;
  remaining = ROUND_TIME_MS;
  lives = MAX_LIVES;
  mode = 'playing';
  lastFrameTime = performance.now();

  pendingRecord = null;
  lastSavedId = null;
  $('name-entry').hidden = true;

  $('overlay').hidden = true;
  $('pause').textContent = '일시정지';
  $('feedback').textContent = '위의 순서대로 눌러주세요';

  makePattern();
  update();
}

function endGame() {
  mode = 'ended';

  $('overlay').hidden = false;
  $('dialog-title').textContent = '떡치기 완료!';
  $('dialog-body').innerHTML =
    `송편 <b>${score}개</b> · ROUND ${round}<br>최고 콤보 <b>${maxCombo}</b>`;
  $('rules').textContent = '다시 도전해서 더 많은 송편을 만들어보세요';
  $('start').textContent = '다시 하기';
  $('feedback').textContent = '절구를 모두 잃었어요';

  // 랭킹 진입 가능하면 이름 입력칸을 보여줌
  const record = { score, maxCombo, date: Date.now() };
  lastSavedId = null;
  if (qualifiesForRanking(record)) {
    pendingRecord = record;
    showNameEntry();
  } else {
    pendingRecord = null;
    $('name-entry').hidden = true;
  }
  $('ranking-box').hidden = false;
  renderRanking();

  update();
}

// 절구 1개 차감 (시간 초과 / 오답 공통). 게임이 끝났으면 true 반환
function loseLife() {
  lives--;
  combo = 0;

  if (lives > 0) return false;

  lives = 0;
  remaining = 0;
  endGame();
  return true;
}

function handleTimeout() {
  if (loseLife()) return;

  remaining = ROUND_TIME_MS;
  lastFrameTime = performance.now();
  makePattern();

  $('feedback').textContent = `시간 초과! 절구 ${lives}개 남음 · 다시 시작`;
  update();
}

function togglePause() {
  if (mode === 'playing') {
    // 일시정지 직전까지 흐른 시간을 반영
    remaining -= performance.now() - lastFrameTime;
    if (remaining <= 0) {
      remaining = 0;
      handleTimeout();
      return;
    }

    mode = 'paused';
    $('overlay').hidden = false;
    $('dialog-title').textContent = '잠깐 쉬는 중';
    $('dialog-body').textContent = `ROUND ${round} · 송편 ${score}개`;
    $('rules').textContent = '이어서 하면 현재 패턴부터 계속해요';
    $('start').textContent = '이어서 하기';
    $('pause').textContent = '계속하기';
    $('name-entry').hidden = true;
    $('ranking-box').hidden = true;
  } else if (mode === 'paused') {
    mode = 'playing';
    lastFrameTime = performance.now();
    $('overlay').hidden = true;
    $('pause').textContent = '일시정지';
  }

  update();
}

/* ==========================================================================
   입력 처리
   ========================================================================== */

function flashButton(colorIndex) {
  const button = inputButtons.find((b) => Number(b.dataset.color) === colorIndex);
  button.classList.add('pressed');
  setTimeout(() => button.classList.remove('pressed'), COLOR_PRESSED_MS);
}

function handleCorrectInput(now) {
  position++;
  combo++;
  maxCombo = Math.max(combo, maxCombo);
  playTone(true);
  animateSuccess();

  const patternDone = position === pattern.length;

  if (patternDone) {
    // 송편 하나 완성 → 다음 라운드
    score++;
    round++;
    remaining = ROUND_TIME_MS;
    lastFrameTime = now;
    $('feedback').textContent = '송편 완성!';
    makePattern();
    return;
  }

  const previousToken = getTokenElement(position - 1);
  previousToken.classList.remove('current');
  previousToken.classList.add('done');
  getTokenElement(position).classList.add('current');

  $('feedback').textContent = `${position} / ${pattern.length}`;
}

function handleWrongInput() {
  playTone(false);
  animateFail();

  if (loseLife()) return;

  $('feedback').textContent = `틀렸어요! 절구 ${lives}개 남음 · 같은 칸에서 다시`;
}

function handleInput(colorIndex) {
  if (mode !== 'playing') return;

  // 입력 시점까지 흐른 시간 반영
  const now = performance.now();
  remaining -= now - lastFrameTime;
  lastFrameTime = now;

  if (remaining <= 0) {
    remaining = 0;
    handleTimeout();
    return;
  }

  flashButton(colorIndex);

  if (pattern[position] === colorIndex) {
    handleCorrectInput(now);
  } else {
    handleWrongInput();
  }

  update();
}

/* ==========================================================================
   이벤트 바인딩
   ========================================================================== */

const hasNativeTouch = 'ontouchstart' in window;
let lastPhysicalInputTime = -Infinity;

function bindInputButton(button) {
  const colorIndex = () => Number(button.dataset.color);

  const press = () => {
    lastPhysicalInputTime = performance.now();
    handleInput(colorIndex());
  };

  // 터치 기기: 멀티터치 지원 (손가락마다 한 번씩 입력)
  if (hasNativeTouch) {
    button.addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        for (const _touch of e.changedTouches) press();
      },
      { passive: false }
    );
  }

  // 마우스 / 펜 (터치 기기의 touch 포인터는 위에서 처리하므로 제외)
  button.addEventListener('pointerdown', (e) => {
    if (hasNativeTouch && e.pointerType === 'touch') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    press();
  });

  // 키보드(Enter/Space)로 버튼을 누른 경우만 처리 (detail === 0)
  // 방금 포인터 입력이 있었다면 중복 처리 방지
  button.addEventListener('click', (e) => {
    const isKeyboardClick = e.detail === 0;
    const noRecentPointerInput = performance.now() - lastPhysicalInputTime > 500;
    if (isKeyboardClick && noRecentPointerInput) {
      handleInput(colorIndex());
    }
  });

  button.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindEvents() {
  $('start').addEventListener('click', () => {
    if (mode === 'paused') togglePause();
    else startGame();
  });

  $('pause').addEventListener('click', togglePause);

  $('name-entry').addEventListener('submit', (e) => {
    e.preventDefault();
    submitRecord();
  });

  inputButtons.forEach(bindInputButton);

  document.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.target instanceof HTMLInputElement) return; // 이름 입력 중엔 1~4 키가 입력돼야 함

    if (['1', '2', '3', '4'].includes(e.key)) {
      e.preventDefault();
      handleInput(Number(e.key) - 1);
    }

    if (e.key === 'Escape') togglePause();
  });

  // 탭이 가려지면 자동 일시정지
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'playing') togglePause();
  });

  $('sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;

    const sound = $('sound');
    sound.textContent = '소리 ' + (soundEnabled ? 'ON' : 'OFF');
    sound.setAttribute('aria-pressed', String(soundEnabled));
    sound.setAttribute('aria-label', soundEnabled ? '소리 끄기' : '소리 켜기');

    if (soundEnabled) playTone(true);
  });
}

/* ==========================================================================
   메인 루프
   ========================================================================== */

function tick(now) {
  if (mode === 'playing') {
    remaining = Math.max(0, remaining - (now - lastFrameTime));
    lastFrameTime = now;

    if (remaining === 0) handleTimeout();
    else updateTimer();
  }

  requestAnimationFrame(tick);
}

/* ==========================================================================
   WebMCP 도구 등록 (지원하는 브라우저에서만)
   ========================================================================== */

function readState() {
  return {
    character: isPig ? 'pig' : 'rabbit',
    mode,
    round,
    score,
    combo,
    lives,
    remainingSeconds: Math.max(0, remaining / 1000),
    pattern: pattern.map((c) => COLORS[c]),
    position,
  };
}

function registerModelContextTools() {
  if (!document.modelContext?.registerTool) return;

  try {
    document.modelContext.registerTool({
      name: 'read_game_state',
      description: 'Read the current tteok game pattern, progress and remaining time.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: readState,
    });

    document.modelContext.registerTool({
      name: 'start_tteok_game',
      description:
        'Start or restart the selected tteok game with six lives and ten seconds per pattern.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      execute: () => {
        startGame();
        return readState();
      },
    });
  } catch {
    // 등록 실패해도 게임 자체엔 영향 없음
  }
}

/* ==========================================================================
   초기화
   ========================================================================== */

bindEvents();
registerModelContextTools();
renderRanking();
makePattern();
update();
requestAnimationFrame(tick);
