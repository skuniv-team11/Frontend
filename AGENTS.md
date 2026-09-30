# AGENTS.md — Co-op 레이더 프론트엔드

이 파일은 이 저장소에서 작업하는 사람과 코딩 도구가 **처음 읽는 목차**다.

## 무엇을 만드나
현장실습 공고를 AI로 구조화해 학생에게 자격 판정·적합도 추천과 **원문 근거**를 보여주는 서비스의 웹 화면. 모바일 우선. 백엔드·API 계약은 `skuniv-team11/Backend`(`docs/api/`). 제출 11/1, 1차 평가 11/2~11/9(공개 링크), 최종 발표 11/12.

## 스택·명령
React 19 · Vite · React Router 7 · TypeScript. Vercel 배포.
```
npm ci
npm run lint       # oxlint — 통과해야 끝
npm run build      # tsc -b + vite build — 통과해야 끝
npm run dev        # :5173, .env.local 의 VITE_API_BASE_URL 로 백엔드 호출
scripts/verify.sh  # 위 두 개 + 비밀 검사. CI와 같은 검사
```

## MVP 화면 (학생 중심)
1. 프로필 입력(예시 프로필 불러오기, 로그인 없음) → 2. 자격 판정(가능/조건부/불가 + 이유) → 3. 적합도 추천 + 근거 인용 → 4. 직무 상세(AI 추출값 ↔ 근거 쪽·인용문, 서경대 기준 통근시간) → 5. 1~3지망 조합 제안(모집기간 리플레이)
P1: 센터 현황판(읽기 전용) → 체크리스트 → NCS 직무 풀이

## 절대 하지 말 것 (Never)
- `VITE_`로 시작하는 환경변수에 키·비밀값을 넣지 않는다(브라우저 번들에 그대로 노출).
- 원문 PDF를 띄우지 않는다. 근거는 문서명·쪽·인용문으로만 보여준다.
- 학생 입력(평점 등)을 localStorage·분석 도구·로그에 남기지 않는다. 요청 때만 보낸다.
- 시연 모드(모집기간 리플레이) 화면에서 "가상 데이터" 표시를 빼지 않는다.
- 원본 문서·`.env`·키를 커밋하지 않는다 → `scripts/check-secrets.sh`가 막는다.
- 커밋에 공동 작성자·링크 트레일러나 생성 도구 표기 줄을 넣지 않는다. 작성자는 GitHub 계정에 연결된 본인 이메일 한 명. 개인 도구 설정·메모는 커밋하지 않는다(백엔드 ADR-0006, `commit-msg` 훅과 CI `commits`가 막는다).

## 먼저 물어볼 것 (Ask first)
- 새 의존성(UI 라이브러리 등), 라우팅 구조 변경
- API 응답 형태가 필요와 다를 때 → 백엔드 저장소에 이슈로 제안하고 합의 후 반영
- `vercel.json`, `.github/workflows/` 변경

## 항상 할 것 (Always)
- API 호출은 `src/api.ts`에만 모은다. 화면에서 `fetch`를 직접 부르지 않는다.
- 백엔드가 아직 없는 API는 백엔드 저장소 `docs/api/*.json` 예시로 목업을 만든다.
- 폭 360px에서 먼저 확인하고 PR에 모바일 스크린샷을 붙인다.
- 커밋·PR은 한국어, `feat|fix|docs|refactor|test|chore(fe): 요약` (`docs/conventions.md`).

## 알아두면 막히지 않는 것
- 하위 경로 새로고침 404는 `vercel.json` rewrite로 해결돼 있다. 지우지 않는다.
- Vercel 미리보기 주소는 매번 바뀐다. 백엔드 `CORS_ORIGINS` 패턴에 맞는지 확인한다.
- 백엔드(Render Free)가 잠들어 있으면 첫 요청이 1분 가까이 걸린다. 로딩 상태를 둔다.
