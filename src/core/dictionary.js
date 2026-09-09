/**
 * 사전에서 뽑아낸 목록들입니다.
 * config/words.js 는 사람이 고치는 원본이고, 이 파일은 거기서 파생된 조회용 자료입니다.
 */

import { WORDS, HARD_WORDS } from '../config/words.js';
import { hasDoubleJong } from './hangul.js';

/** 판에 올릴 수 있는 음절 수입니다. */
export const WORD_LENGTHS = [2, 3];

export const ALL_WORDS = Object.keys(WORDS);

/** 겹받침이 없는 낱말입니다. 15단계까지는 여기서만 뽑습니다. */
export const EASY_WORDS = ALL_WORDS.filter((w) => !hasDoubleJong(w));

/** 16단계 이후에 등장 확률을 높여 주는 겹받침 낱말입니다. */
export const HARD_WORD_LIST = Object.keys(HARD_WORDS);

function groupByLength(list) {
  const out = {};
  for (const n of WORD_LENGTHS) {
    out[n] = list.filter((w) => [...w].length === n);
  }
  return out;
}

/** 음절 수별 낱말 목록입니다. easy 는 겹받침을 뺀 것이고 all 은 전부입니다. */
export const POOL = {
  easy: groupByLength(EASY_WORDS),
  all: groupByLength(ALL_WORDS)
};

/** 목표가 아닌 낱말을 우연히 만들었을 때 보너스로 인정하기 위한 전체 사전입니다. */
export const DICT = new Set(ALL_WORDS);

/** 낱말의 뜻풀이를 돌려줍니다. */
export function meaningOf(word) {
  return WORDS[word] || '';
}
