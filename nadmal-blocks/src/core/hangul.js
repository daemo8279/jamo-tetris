/**
 * 한글 음절과 자모를 오가는 순수 함수 모음입니다.
 * 이 파일은 다른 모듈에 의존하지 않으므로 단독으로 시험할 수 있습니다.
 *
 * 한글 음절은 유니코드에서 다음 규칙으로 배치되어 있습니다.
 *   코드값 = 0xAC00 + (초성번호 × 21 + 중성번호) × 28 + 종성번호
 */

export const CHO = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

export const JUNG = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ',
  'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
];

export const JONG = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ',
  'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

/** 중성으로 쓰이는 모음 집합입니다. 자모 조립에서 자음과 모음을 가릅니다. */
export const VOWELS = new Set(JUNG);

/** 겹받침 집합입니다. 16단계 이후에만 등장하며 화면에서 다른 색으로 그립니다. */
export const DOUBLE_JONG = new Set(['ㄳ', 'ㄵ', 'ㄶ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅄ']);

const BASE = 0xAC00;
const LAST = 0xD7A3;

/** 글자 하나가 완성된 한글 음절인지 확인합니다. */
export function isSyllable(ch) {
  const code = ch.charCodeAt(0);
  return code >= BASE && code <= LAST;
}

/** 초성·중성·종성을 받아 음절 한 글자로 합칩니다. 조합이 불가능하면 null을 돌려줍니다. */
export function combine(cho, jung, jong) {
  const c = CHO.indexOf(cho);
  const j = JUNG.indexOf(jung);
  const k = jong ? JONG.indexOf(jong) : 0;
  if (c < 0 || j < 0 || k < 0) return null;
  return String.fromCharCode(BASE + (c * 21 + j) * 28 + k);
}

/** 문자열을 자모 배열로 풀어냅니다. 한글이 아닌 글자는 건너뜁니다. */
export function decompose(str) {
  const out = [];
  for (const ch of str) {
    if (!isSyllable(ch)) continue;
    const off = ch.charCodeAt(0) - BASE;
    out.push(CHO[Math.floor(off / 588)]);
    out.push(JUNG[Math.floor(off / 28) % 21]);
    const k = off % 28;
    if (k > 0) out.push(JONG[k]);
  }
  return out;
}

/**
 * 자모 배열을 음절 문자열로 되돌립니다. 조립이 불가능하면 null을 돌려줍니다.
 *
 * 종성 판정에 규칙이 하나 있습니다. 자음이 나왔을 때 바로 다음 글자가 모음이면
 * 그 자음을 종성으로 쓰지 않고 다음 음절의 초성으로 넘깁니다.
 * 예를 들어 ㅎㅏㄴㄱㅡㄹ 은 「한글」이 되지만, ㅎㅏㄴㅏ 는 「하나」가 됩니다.
 */
export function assemble(arr) {
  const out = [];
  let i = 0;
  while (i < arr.length) {
    if (VOWELS.has(arr[i])) return null;
    const cho = arr[i++];

    if (i >= arr.length || !VOWELS.has(arr[i])) return null;
    const jung = arr[i++];

    let jong = '';
    if (i < arr.length && !VOWELS.has(arr[i])) {
      const nextIsVowel = i + 1 < arr.length && VOWELS.has(arr[i + 1]);
      if (!nextIsVowel) jong = arr[i++];
    }

    const syllable = combine(cho, jung, jong);
    if (!syllable) return null;
    out.push(syllable);
  }
  return out.length ? out.join('') : null;
}

/** 음절 하나의 초성을 돌려줍니다. 힌트에서 첫소리를 알려 줄 때 씁니다. */
export function chosungOf(syllable) {
  return decompose(syllable)[0];
}

/** 낱말에 겹받침이 들어 있는지 확인합니다. */
export function hasDoubleJong(word) {
  return decompose(word).some((j) => DOUBLE_JONG.has(j));
}

/** 자모 배열을 정렬해 이어 붙인 값입니다. 순서와 무관하게 구성을 견주는 데 씁니다. */
export function jamoSignature(arr) {
  return [...arr].sort().join('');
}
