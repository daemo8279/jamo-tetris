/**
 * 놀이하는 사람의 닉네임을 다룹니다.
 * 랭킹에 올릴 이름이므로 게임을 시작하기 전에 미리 받아 둡니다.
 */

const KEY = 'nb_player_name';

export const NAME_MAX = 10;

/** 앞뒤 공백을 없애고 길이를 맞춥니다. 쓸 수 없는 이름이면 빈 문자열을 돌려줍니다. */
export function normalizeName(raw) {
  const name = String(raw || '').trim().replace(/\s+/g, ' ');
  if (!name) return '';
  return [...name].slice(0, NAME_MAX).join('');
}

/** 저장된 닉네임을 읽습니다. 없으면 빈 문자열입니다. */
export function loadName() {
  try {
    return normalizeName(localStorage.getItem(KEY) || '');
  } catch {
    return '';
  }
}

/** 닉네임을 저장합니다. 저장에 성공하면 정리된 이름을, 실패하면 빈 문자열을 돌려줍니다. */
export function saveName(raw) {
  const name = normalizeName(raw);
  if (!name) return '';
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* 저장이 막혀 있어도 이번 판에서는 그대로 씁니다. */
  }
  return name;
}

/** 지금 판에서 쓰는 이름입니다. 저장된 값이 없으면 빈 문자열로 시작합니다. */
export const player = { name: loadName() };

/** 이름을 정하고 기억해 둡니다. */
export function setName(raw) {
  const name = saveName(raw);
  if (name) player.name = name;
  return player.name;
}

/** 이름이 정해져 있는지 확인합니다. */
export function hasName() {
  return Boolean(player.name);
}
