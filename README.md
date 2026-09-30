# 현장뛰자 — 프론트엔드

현장실습 공고를 AI로 구조화해 학생에게는 지원할 수 있는 자리와 이유·1~3지망 몰림 경고를, 현장실습지원센터에는 모집 중 현황판을 보여주는 서비스의 웹 화면입니다. 2026 소웨X전컴 공모전 11조 '나중에 고치조'. 백엔드·API 계약: [skuniv-team11/Backend](https://github.com/skuniv-team11/Backend) (`docs/api/`)

React 19 · Vite · React Router 7 · TypeScript → Vercel

## 처음 받은 뒤 한 번
```
git clone https://github.com/skuniv-team11/Frontend.git && cd Frontend
git config core.hooksPath .githooks        # 커밋 전 키·원본 문서 검사
git config user.email "<숫자>+<아이디>@users.noreply.github.com"   # GitHub Settings → Emails에 나오는 주소
```
작업 규칙은 [AGENTS.md](AGENTS.md), 브랜치·커밋 규칙은 [docs/conventions.md](docs/conventions.md)에 있습니다. 작업을 마치면 `scripts/verify.sh`를 돌립니다(CI와 같은 검사).

## 로컬 실행
```
cp .env.example .env.local     # VITE_API_BASE_URL=http://localhost:8080 (백엔드 로컬 실행 시)
npm install
npm run dev                    # http://localhost:5173
```
첫 화면에 "✓ ok"가 뜨면 프론트 → 백엔드 → CORS가 모두 통과한 것입니다.

## 배포 (Vercel)
1. Vercel → New Project → 이 저장소를 고릅니다(Framework: Vite 자동 인식). **Project Name은 `coop-radar`로 바꿉니다.** 저장소 이름을 그대로 쓰면 주소가 `frontend-xxxx.vercel.app`처럼 알아보기 어려워지고, 백엔드 `CORS_ORIGINS` 예시도 `coop-radar` 기준입니다.
2. Environment Variables에 `VITE_API_BASE_URL=https://<백엔드>.onrender.com`을 넣습니다.
3. 배포 주소를 백엔드 Render의 `CORS_ORIGINS`에 넣습니다.
4. 배포 주소에서 두 가지를 확인합니다.
    - 첫 화면에 "✓ ok"가 뜨는지
    - `/jobs/sample`에서 새로고침해도 404가 안 나는지(`vercel.json` rewrite)

## 규칙
- **환경변수:** `VITE_`로 시작하는 값은 브라우저에 그대로 보입니다. 백엔드 주소만 넣고, 키는 넣지 않습니다.
- **원문 표시:** 원문 PDF는 띄우지 않고, 근거는 문서명·쪽·인용문으로만 보여줍니다.
