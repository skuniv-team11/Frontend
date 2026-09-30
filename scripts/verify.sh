#!/usr/bin/env bash
# 전체 검증의 단일 진입점. 사람·코딩 도구·CI가 같은 검사를 쓴다.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
results=(); status=0
run() { local name="$1" hint="$2"; shift 2; echo "── $name"
  if "$@"; then results+=("✓ $name"); else results+=("✗ $name — $hint"); status=1; fi; }

run "비밀·원본 파일" "출력된 파일을 git rm --cached 하고 값은 환경변수로 옮기세요" scripts/check-secrets.sh --all
run "커밋 메시지" "공동 작성자·도구 표기 줄을 지우고 git commit --amend 로 다시 쓰세요" scripts/check-commits.sh "$(git merge-base HEAD origin/develop 2>/dev/null)" HEAD
[ -d node_modules ] || npm ci --silent
run "lint" "oxlint 메시지의 규칙 이름으로 고치세요(규칙을 끄지 말 것)" npm run -s lint
run "build" "tsc 오류 위치를 고치세요. API 타입은 src/api.ts 에 모읍니다" npm run -s build
if git diff --name-only HEAD 2>/dev/null | grep -qE '^(scripts/|\.githooks/)' || [ "${1:-}" = "--all" ]; then
  run "하네스 자체 테스트" "규칙이 막아야 할 것을 못 막거나, 통과해야 할 것을 막고 있습니다" scripts/test-harness.sh
fi
echo; printf '%s\n' "${results[@]}"
exit $status
