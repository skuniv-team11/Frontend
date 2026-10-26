# 현장뛰자 — 프론트엔드

현장실습 공고를 AI로 구조화해 학생에게는 지원할 수 있는 자리와 이유·1~3지망 빈 자리 제안을, 현장실습지원센터에는 모집 중 현황판을 보여주는 서비스의 웹 화면입니다. 2026 소웨X전컴 공모전 11조 '나중에 고치조'. 백엔드·API 계약: [skuniv-team11/Backend](https://github.com/skuniv-team11/Backend) (`docs/api/`)

React 19 · Vite · React Router 7 · JavaScript(JSX) · styled-components → Cloudflare Pages(https://fieldrun.pages.dev)

## 처음 받은 뒤 한 번
```
git clone https://github.com/skuniv-team11/Frontend.git && cd Frontend
git config core.hooksPath .githooks        # 커밋 전 키·원본 문서 검사
git config user.email "<숫자>+<아이디>@users.noreply.github.com"   # GitHub Settings → Emails에 나오는 주소
```
작업 규칙은 [AGENTS.md](AGENTS.md), 브랜치·커밋 규칙은 [docs/conventions.md](docs/conventions.md)에 있습니다. 작업을 마치면 `scripts/verify.sh`를 돌립니다(CI와 같은 검사).

## 테스트는 배포 주소에서
작업 중에는 로컬에서 바로 확인하고, 병합 전 최종 확인은 **PR 미리보기 주소**에서 합니다. 백엔드는 Render 한 곳만 씁니다(https://coop-radar-api.onrender.com · [Swagger](https://coop-radar-api.onrender.com/swagger-ui.html)).
- **로컬:** `npm ci` 후 `npm run dev` → http://localhost:5173, 또는 `npm run build` 후 `npm run preview` → http://localhost:4173. 둘 다 `.env` 없이 Render API를 부릅니다(백엔드 `CORS_ORIGINS`가 이 두 주소를 허용). 포트(5173·4173)가 쓰이고 있으면 다른 포트로 넘어가지 않고 멈추니 켜 둔 서버를 끄고 다시 실행합니다.
- **PR 미리보기:** 브랜치를 push하면 Cloudflare Pages가 `https://<브랜치 이름>.fieldrun.pages.dev`에 올리고 PR 검사에 'Cloudflare Pages'로 링크를 답니다.
- **운영:** `https://fieldrun.pages.dev` = `develop`의 최신 빌드(10/26 빌드 해시로 확인). `develop`에 병합하면 바로 바뀝니다.
- 백엔드 API가 바뀌었는데 화면에서 안 보이면, 백엔드 `main`이 아직 반영 전인지 확인합니다(Render는 `main`만 배포).

## 배포 (Cloudflare Pages)
- Cloudflare Pages가 이 저장소에 연결돼 있습니다. 빌드 `npm run build`, 출력 `dist`.
- 환경변수 `VITE_API_BASE_URL`은 넣지 않아도 됩니다(기본값이 Render 주소). 값을 넣으면 다시 빌드해야 반영됩니다(빌드 때 들어감).
- 하위 경로 새로고침(`/jobs/101`, `/approvals/…`): `404.html`이 없으면 Pages가 SPA로 보고 `index.html`을 줍니다. **`public/404.html`을 만들지 않습니다.**
- 백엔드 Render `CORS_ORIGINS`는 `https://fieldrun.pages.dev,https://*.fieldrun.pages.dev`(운영 + 미리보기)와 로컬 두 주소입니다.
- `vercel.json`은 예전 Vercel 배포용으로 남아 있고 지금은 쓰지 않습니다.

## 규칙
- **환경변수:** `VITE_`로 시작하는 값은 브라우저에 그대로 보입니다. 백엔드 주소만 넣고, 키는 넣지 않습니다.
- **원문 표시:** 원문 PDF는 띄우지 않고, 근거는 문서명·쪽·인용문으로만 보여줍니다.


## 🎯 Git Convention

- 🎉 **Start** : Start New Project `[:tada:]`
- ✨ **Feat** : 새로운 기능 추가 `[:sparkles:]`
- 🐛 **Fix** : 버그 수정 `[:bug:]`
- 🎨 **Design** : CSS 등 사용자 UI 디자인 변경 `[:art:]`
- ♻️ **Refactor** : 코드 리팩토링 `[:recycle:]`
- 🔧 **Settings** : 설정 파일 수정 `[:wrench:]`
- 🗃️ **Comment** : 필요한 주석 추가 및 변경 `[:card_file_box:]`
- ➕ **Dependency/Plugin** : 라이브러리 추가 `[:heavy_plus_sign:]`
- 📝 **Docs** : 문서 수정 `[:memo:]`
- 🔀 **Merge** : 브랜치 병합 `[:twisted_rightwards_arrows:]`
- 🚀 **Deploy** : 배포 관련 작업 `[:rocket:]`
- 🚚 **Rename** : 파일 및 폴더 이름 수정 `[:truck:]`
- 🔥 **Remove** : 파일 삭제 `[:fire:]`
- ⏪️ **Revert** : 이전 버전으로 롤백 `[:rewind:]`

## 🌲 Branch Convention

- `main` : 배포 가능한 브랜치
- `develop` : 개발 브랜치
- `feat/#이슈번호/명칭` : 새로운 기능 개발 브랜치
  - 예시 : `feat/#12/temperature`
- `fix/#이슈번호/명칭` : 버그 수정 브랜치
  - 예시 : `fix/#12/temperature-chart`
- `ui/#이슈번호/명칭` : UI 작업 브랜치
  - 예시 : `ui/#12/home`
- `docs/#이슈번호/명칭` : 문서 작성 및 수정 브랜치
  - 예시 : `docs/#12/readme`
- `api/#이슈번호/명칭` : API 연동 작업 브랜치
  - 예시 : `api/#12/hospital`
- `refactor/#이슈번호/명칭` : 리팩토링 작업 브랜치
  - 예시 : `refactor/#12/component-structure`

## 🌊 Flow

1. Issue 생성
2. 최신 `develop` 브랜치에서 작업 브랜치 생성
3. 기능 개발 및 커밋 진행
4. `develop` 브랜치로 Pull Request 생성
5. 코드 리뷰 진행
6. 리뷰 완료 후 `develop` 브랜치로 병합
7. 병합 완료 후 작업 브랜치 삭제