# HASHCORE X

`hashcat-utils`의 텍스트 처리 흐름을 명령어 없이 제공하는 TypeScript 웹 앱과, 이 Mac의 Hashcat을 제한적으로 호출하는 로컬 GPU Runner입니다.

## macOS Desktop App

Intel Mac용 독립 앱을 빌드하면 `dist/HASHCORE X.app`이 생성됩니다. 앱은 웹 화면과 Runner를 전용 로컬 포트에서 시작하고, 일회성 토큰을 URL에 남기지 않고 현재 앱 세션으로만 전달합니다.

```bash
pnpm desktop:build
open "dist/HASHCORE X.app"
```

앱은 이 저장소와 별도 설치된 Hashcat 실행 파일을 사용하며, Hashcat 원본 바이너리를 포함하거나 변경하지 않습니다.

브라우저 Utility 입력과 결과는 Web Worker에서만 처리됩니다. GPU Runner는 `127.0.0.1`에만 바인딩되고 임의 Shell 명령 대신 Hashcat 바이너리를 고정 인자로 직접 실행합니다.

## Requirements

- Node.js 22.13 이상
- pnpm 11 이상
- Hashcat 7 이상: `brew install hashcat`

## Development

```bash
pnpm install
brew install hashcat
pnpm dev
```

웹 앱은 `http://localhost:3000`, 로컬 실행기는 `http://127.0.0.1:8789`에서 시작합니다. 터미널에 표시된 일회성 Runner token을 `/runner` 화면에 입력합니다.

브라우저 Utility만 실행하거나 Runner만 실행할 수도 있습니다.

```bash
pnpm dev:web
pnpm runner
```

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Browser Utilities

- 빈 줄·공백 정리
- 중복 제거
- Unicode 문자 길이별 분류
- 특정 문자열 포함·제외
- 두 목록 결합
- 중복 없는 단순 순열 생성

## Local GPU Runner

- MD5, SHA-1, NTLM, SHA-256, SHA-512의 Raw Hash 모드
- Dictionary attack(`-a 0`)만 허용
- GPU 또는 CPU 장치 선택과 고정 Benchmark
- 동시에 한 작업, 작업당 5분, Hash 1,000개, 후보 100,000개 제한
- 임시 입력 파일 권한 `0600`, 작업 종료 즉시 삭제, 결과 메모리 TTL 30분
- 입력·결과·token을 브라우저 저장소와 History에 기록하지 않음

Runner는 공개 서버용 기능이 아닙니다. Bind address, 실행 바이너리, 허용 인자와 동시 실행 제한을 코드에서 고정하며 임의 명령 문자열을 받지 않습니다.

## Browser Safety Limits

- UTF-8 입력 최대 1 MB
- 결과 최대 10,000개 및 2,000,000자
- 순열 항목 최대 7자
- 브라우저 작업당 최대 15초
- 대용량 예상 결과는 실행 전 추가 확인

## Attribution

동작과 명칭 분석에는 [`hashcat/hashcat-utils`](https://github.com/hashcat/hashcat-utils)의 커밋 `8bbf2baf7b341c8ec23ca91e44e0ac7d7fcc0355`를 참고했습니다. 원본 소스는 수정하지 않았습니다.

원본 프로젝트의 MIT 고지는 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)에 포함되어 있습니다.

Hashcat은 이 저장소에 포함하거나 재배포하지 않으며, 사용자가 별도로 설치한 [`hashcat/hashcat`](https://github.com/hashcat/hashcat) 실행 파일만 호출합니다.
