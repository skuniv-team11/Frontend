# 현장뛰자 — 프론트엔드

현장실습 공고를 AI로 구조화해 학생에게는 지원할 수 있는 자리와 이유·1~3지망 빈 자리 제안을, 현장실습지원센터에는 모집 중 현황판을 보여주는 서비스의 웹 화면입니다. 2026 소웨X전컴 공모전 11조 '나중에 고치조'. 백엔드·API 계약: [skuniv-team11/Backend](https://github.com/skuniv-team11/Backend) (`docs/api/`)

React 19 · Vite · React Router 7 · TypeScript → Vercel

## 처음 받은 뒤 한 번
```
git clone https://github.com/skuniv-team11/Frontend.git && cd Frontend
git config core.hooksPath .githooks        # 커밋 전 키·원본 문서 검사
git config user.email "<숫자>+<아이디>@users.noreply.github.com"   # GitHub Settings → Emails에 나오는 주소
```
작업 규칙은 [AGENTS.md](AGENTS.md), 브랜치·커밋 규칙은 [docs/conventions.md](docs/conventions.md)에 있습니다. 작업을 마치면 `scripts/verify.sh`를 돌립니다(CI와 같은 검사).

## 테스트는 배포 주소에서
화면 확인은 로컬이 아니라 **Vercel 배포 주소**에서 합니다(10/2 결정). 백엔드는 Render 한 곳만 씁니다.
- **PR 미리보기:** 브랜치를 push하고 PR을 열면 Vercel이 PR에 미리보기 주소를 답니다. 거기서 확인한 뒤 병합합니다.
- **develop 미리보기:** `https://coop-radar-git-develop-<계정>.vercel.app`(develop의 최신 상태)
- **운영:** `https://coop-radar.vercel.app`(`main`). 평가·시연용이라 `develop` → `main` 승격 때만 바뀝니다.
- 백엔드 API가 바뀌었는데 화면에서 안 보이면, 백엔드 `main`이 아직 승격 전인지 확인합니다(Render는 `main`만 배포).

로컬에서 띄우고 싶으면(선택) `.env.local`에 Render 주소를 넣습니다.
```
cp .env.example .env.local     # VITE_API_BASE_URL=https://<백엔드>.onrender.com 으로 고친다
npm install
npm run dev                    # http://localhost:5173 (백엔드 CORS_ORIGINS에 이 주소가 있어야 함)
```

## 배포 (Vercel)
1. Vercel → New Project → 이 저장소를 고릅니다(Framework: Vite 자동 인식). **Project Name은 `coop-radar`로 바꿉니다.** 저장소 이름을 그대로 쓰면 주소가 `frontend-xxxx.vercel.app`처럼 알아보기 어려워지고, 백엔드 `CORS_ORIGINS` 예시도 `coop-radar` 기준입니다.
2. Environment Variables에 `VITE_API_BASE_URL=https://<백엔드>.onrender.com`을 넣습니다. **Production과 Preview 둘 다** 체크합니다(미리보기도 Render를 부름). 값을 바꾸면 다시 배포해야 반영됩니다(빌드 때 들어감).
3. Settings → Deployment Protection → **Vercel Authentication을 끕니다.** 켜 두면 미리보기 주소가 Vercel 로그인을 요구하고, Hobby 플랜은 외부 사용자를 1명만 허용해서 팀원이 미리보기를 못 봅니다. 공개 저장소·공개 시연 화면이라 가릴 것이 없습니다.
4. 백엔드 Render `CORS_ORIGINS`는 `https://coop-radar.vercel.app,https://coop-radar-*.vercel.app`(운영 + 미리보기)입니다. 운영 주소가 `coop-radar.vercel.app`이 아니게 나오면 백엔드 값을 그 주소로 고칩니다.
5. 배포 주소에서 두 가지를 확인합니다.
    - 첫 화면에 "✓ ok"가 뜨는지
    - `/jobs/sample`에서 새로고침해도 404가 안 나는지(`vercel.json` rewrite)

## 규칙
- **환경변수:** `VITE_`로 시작하는 값은 브라우저에 그대로 보입니다. 백엔드 주소만 넣고, 키는 넣지 않습니다.
- **원문 표시:** 원문 PDF는 띄우지 않고, 근거는 문서명·쪽·인용문으로만 보여줍니다.
