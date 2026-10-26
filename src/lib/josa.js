// 앞말 받침에 맞춰 조사를 고른다(직무·능력단위 이름처럼 서버에서 오는 말 뒤에 쓴다).
// 끝의 괄호 설명은 빼고 본다(예: '수행결과보고서(제9호)' → '서'). 숫자는 읽는 소리(1 일 · 2 이 …)로, 영문 등 그 밖은 받침 없음으로 본다.
const DIGIT_FINAL = '013678' // 영 · 일 · 삼 · 육 · 칠 · 팔 — 받침 있음
const DIGIT_RIEUL = '178' // 일 · 칠 · 팔 — ㄹ 받침

function lastSound(word) {
  const text = String(word ?? '').trim().replace(/\s*\([^()]*\)$/, '').trim()
  const ch = text.at(-1)
  if (!ch) return { final: false, rieul: false }
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28
    return { final: jong > 0, rieul: jong === 8 }
  }
  if (/\d/.test(ch)) return { final: DIGIT_FINAL.includes(ch), rieul: DIGIT_RIEUL.includes(ch) }
  return { final: false, rieul: false }
}

// pair: '이/가' · '을/를' · '은/는' · '과/와' · '으로/로'
export function josa(word, pair) {
  const { final, rieul } = lastSound(word)
  const [withFinal, withoutFinal] = pair.split('/')
  if (pair === '으로/로') return final && !rieul ? withFinal : withoutFinal
  return final ? withFinal : withoutFinal
}
