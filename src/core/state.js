/**
 * 게임 전체가 함께 보는 상태입니다.
 *
 * 여러 모듈이 같은 값을 읽고 고쳐야 하므로, 개별 변수를 내보내지 않고
 * 객체 하나를 내보냅니다. import 로 가져온 변수에는 다시 대입할 수 없기 때문입니다.
 * 상태를 바꾸는 일은 core/game.js 가 맡고, ui 쪽은 읽기만 하는 것을 원칙으로 삼습니다.
 */

export const S = {
  /* ── 판 ── */
  field: null,          // [행][열] 배열. 빈 칸은 null 이고, 그 밖에는 음절 또는 자모 한 글자입니다.
  cur: null,            // 떨어지는 중인 블록 { u, row, col }
  queue: [],            // 다음에 나올 블록들
  unitQueue: [],        // 공급기가 미리 만들어 둔 블록 묶음

  /* ── 점수와 진행 ── */
  score: 0,
  level: 1,
  wordCount: 0,         // 판을 시작한 뒤 완성한 낱말 총수
  levelWords: 0,        // 현재 레벨에서 완성한 낱말 수
  madeWords: [],

  /* ── 진행 제어 ── */
  running: false,
  paused: false,
  gameOver: false,
  clearing: false,      // 낱말이 사라지는 연출이 도는 중인지
  clearSet: new Set(),  // 사라질 칸들 ("행,열" 형태)
  awaitingAdvance: false, // 레벨 넘김을 묻는 중이라 조작을 막아야 하는지

  /* ── 낙하 ── */
  softDrop: false,
  dropAcc: 0,
  lastT: 0,
  animId: null,

  /* ── 목표 낱말 ── */
  targetWord: '',
  targetMatched: false,
  targetQueue: [],      // 예고 낱말
  targetBag: [],        // 목표 낱말의 블록을 섞어 담아 둔 주머니
  hintViewIdx: 0,       // 힌트 카드에서 보고 있는 낱말 (0이면 현재 목표)

  /* ── 힌트 ── */
  blocksDropped: 0,
  hintStage: 0,
  skipTimer: null,
  skipMissedOnce: false,

  /* ── 콤보와 보석 ── */
  combo: 0,             // 낱말을 연달아 완성한 횟수. 목표를 놓치면 0으로 돌아갑니다.
  bestCombo: 0,
  gems: 0,              // 한 줄을 통째로 지우는 보석

  /* ── 보조 수단 ── */
  stars: 5,
  removeMode: false,    // 별을 눌러 블록 한 칸을 지우는 중
  gemMode: false,       // 보석을 눌러 한 줄을 지우는 중
  hoverCell: null,
  hoverRow: null,
  pauseLeft: 3,
  holdUnit: null,
  holdUsed: false
};

/* ── 온보딩을 이미 봤는지 기억합니다 ── */
const KEY_SYL = 'nb_demo_syl';
const KEY_JAMO = 'nb_demo_jamo';

function readFlag(key) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export const seen = {
  demoSyl: readFlag(KEY_SYL),
  demoJamo: readFlag(KEY_JAMO)
};

export function markDemoSeen(kind) {
  const key = kind === 'syl' ? KEY_SYL : KEY_JAMO;
  if (kind === 'syl') seen.demoSyl = true;
  else seen.demoJamo = true;
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* 저장이 막혀 있어도 이번 판에서는 본 것으로 처리합니다. */
  }
}
