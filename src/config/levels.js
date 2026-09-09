/**
 * 레벨 설계입니다. 난이도를 조정하려면 이 파일만 고치면 됩니다.
 *
 *   1~5단계   글자(음절) 블록. 낱말 순서를 그대로 맞춰야 합니다.
 *   6~15단계  자모 블록. 자모를 다 모으면 순서는 상관없습니다.
 *   16단계~   겹받침이 섞이고 레벨이 오를수록 계속 빨라집니다.
 */

/** 다음 레벨로 올라가는 데 필요한 낱말 수입니다. */
export function goalOf(level) {
  if (level <= 5) return 5;
  if (level <= 10) return 10;
  if (level <= 15) return 15;
  return 17;
}

/** 한 칸 내려가는 데 걸리는 시간(밀리초)입니다. */
const SYL_SPEED = [1100, 1000, 900, 820, 740];
const JAMO_SPEED = [900, 830, 760, 690, 620, 550, 480, 420, 370, 320];

/** 16단계부터는 레벨마다 이만큼씩 빨라지며, 하한 아래로는 내려가지 않습니다. */
const MASTER_BASE_SPEED = 300;
const MASTER_SPEED_STEP = 12;
const MIN_SPEED = 140;

/**
 * 레벨 설정을 돌려줍니다.
 *   mode       'syl' 이면 글자 블록, 'jamo' 이면 자모 블록입니다.
 *   master     겹받침 낱말이 등장하는 구간인지 나타냅니다.
 *   syllables  목표 낱말의 음절 수 후보입니다. 최대 3음절을 넘지 않습니다.
 *   speed      낙하 간격(밀리초)입니다.
 *   chunk      목표 블록을 몇 개씩 연달아 공급할지 정하는 범위입니다.
 *   filler     연속 구간 사이에 끼워 넣는 방해 블록 수의 범위입니다.
 *   goal       다음 레벨로 넘어가는 데 필요한 낱말 수입니다.
 *   hintEvery  블록 몇 개마다 힌트 단계를 올릴지 정합니다.
 */
export function levelConfig(level) {
  if (level <= 5) {
    return {
      mode: 'syl',
      master: false,
      syllables: level <= 2 ? [2] : level === 3 ? [2, 3] : [3],
      speed: SYL_SPEED[level - 1],
      chunk: [2, 2],
      filler: level === 1 ? [0, 0] : level <= 3 ? [0, 1] : [1, 1],
      goal: goalOf(level),
      hintEvery: 4
    };
  }

  if (level <= 15) {
    return {
      mode: 'jamo',
      master: false,
      syllables: level <= 8 ? [2] : level <= 10 ? [2, 3] : [3],
      speed: JAMO_SPEED[level - 6],
      chunk: level <= 7 ? [3, 3] : level <= 12 ? [2, 3] : [2, 2],
      filler: level <= 8 ? [0, 1] : level <= 12 ? [1, 1] : [1, 2],
      goal: goalOf(level),
      hintEvery: 6
    };
  }

  const over = level - 16;
  return {
    mode: 'jamo',
    master: true,
    syllables: [2, 3],
    speed: Math.max(MIN_SPEED, MASTER_BASE_SPEED - over * MASTER_SPEED_STEP),
    chunk: [2, 2],
    filler: [1, 2],
    goal: goalOf(level),
    hintEvery: 6
  };
}

/** 진행 바에 표시하는 단계 이름입니다. */
export function stageLabel(level) {
  if (level <= 5) return `${level}단계 · 글자 블록`;
  if (level <= 15) return `${level}단계 · 자모 블록`;
  return `${level}단계 · 겹받침`;
}

/** 단계 이름에서 방식만 떼어 냅니다. 레벨업 알림에 씁니다. */
export function modeLabel(level) {
  if (level <= 5) return '글자 블록';
  if (level <= 15) return '자모 블록';
  return '겹받침';
}

/** 해당 레벨의 블록 방식입니다. */
export function modeOf(level) {
  return levelConfig(level).mode;
}

/** 글자 블록에서 자모 블록으로 넘어가는 지점입니다. */
export const JAMO_START_LEVEL = 6;

/** 겹받침이 처음 등장하는 지점입니다. */
export const MASTER_START_LEVEL = 16;
