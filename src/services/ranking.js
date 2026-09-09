/**
 * 랭킹 저장소입니다.
 *
 * 지금은 브라우저에만 저장합니다. 서버로 옮기실 때는 아래 loadScores 와 saveScore 두
 * 함수만 원격 호출로 바꾸면 나머지 화면 코드는 그대로 둘 수 있습니다.
 *
 * 다만 점수를 브라우저가 계산해서 그대로 보내는 구조이므로, 순위 경쟁을 진지하게
 * 다루실 계획이라면 서버에서 점수를 다시 확인하는 절차를 함께 두셔야 합니다.
 */

const KEY = 'nb_rank';

/** 저장해 두는 기록 수입니다. */
const KEEP = 30;

/** 화면에 보여 주는 기록 수입니다. */
export const SHOW_LIMIT = 20;

/** 기록을 읽어 점수 내림차순으로 돌려줍니다. */
export async function loadScores() {
  let list = [];
  try {
    list = JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    list = [];
  }
  if (!Array.isArray(list)) list = [];
  return list.sort((a, b) => (b.score || 0) - (a.score || 0));
}

/** 기록 하나를 남깁니다. */
export async function saveScore(entry) {
  const list = await loadScores();
  list.push({
    name: entry.name,
    score: entry.score,
    level: entry.level,
    words: entry.words,
    ts: Date.now()
  });
  list.sort((a, b) => (b.score || 0) - (a.score || 0));
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, KEEP)));
  } catch {
    /* 저장이 막혀 있으면 이번 기록은 남지 않습니다. */
  }
  return list.slice(0, SHOW_LIMIT);
}
