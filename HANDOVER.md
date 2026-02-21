# Mission Control — 인수인계 문서

> 마지막 업데이트: 2026-02-21
> GitHub 브랜치: `claude/review-md-plan-xWWP8`

---

## 1. 이게 뭐야?

Brian의 비즈니스(갓템홈 어필리에이트) 전체 태스크를 관리하는 **AI 파워드 개인 프로젝트 매니저**.
Sunsama 스타일 UI + 음성 브레인덤프 + AI 자동 리포트.

---

## 2. 파일 구조 (전체)

```
mission-control/
├── index.html                  ← 메인 대시보드 (서버 연동 버전)
├── dashboard-offline.html      ← 오프라인 대시보드 (서버 없이 브라우저에서 바로 열림)
├── data/
│   └── tasks.json              ← 38개 태스크 데이터 (런타임 DB)
├── server/
│   ├── index.js                ← Express 서버 진입점 (port 3000)
│   ├── config.js               ← 설정 (API 키, 크론, AI 모델)
│   ├── package.json            ← Node.js 의존성
│   ├── .env.example            ← 환경변수 템플릿
│   ├── routes/
│   │   ├── tasks.js            ← GET/POST/PATCH/DELETE /api/tasks
│   │   ├── objectives.js       ← GET/PATCH /api/objectives
│   │   ├── voice.js            ← POST /api/voice/upload, /api/voice/todo
│   │   ├── braindump.js        ← POST /api/braindump
│   │   ├── report.js           ← GET /api/report/daily|weekly|stats
│   │   └── sync.js             ← POST /api/sync/github
│   └── lib/
│       ├── ai.js               ← Claude/Whisper AI 호출 로직
│       ├── dataStore.js        ← tasks.json 읽기/쓰기
│       ├── cron.js             ← 크론잡 (모닝/나이트/위클리)
│       └── telegram.js         ← 텔레그램 알림
├── master_tasks.md             ← 태스크 원본 (사람이 읽는 용)
├── MISSION_CONTROL_MASTER.md   ← 전체 설계 문서 (아키텍처, API 등)
├── INFRA_SETUP.md              ← VPS 인프라 정보
├── Dockerfile                  ← Docker 빌드
├── docker-compose.yml          ← Docker Compose
└── .gitignore
```

---

## 3. 현재 상태 — 뭐가 되어있고 뭐가 안 되어있나

### 완료된 것
| 항목 | 상태 | 설명 |
|------|------|------|
| UI 대시보드 (`index.html`) | ✅ 완료 | Sunsama 스타일, 모든 기능 UI 구현 |
| 오프라인 대시보드 (`dashboard-offline.html`) | ✅ 완료 | 서버 없이 브라우저에서 바로 열림 |
| 백엔드 API 서버 | ✅ 완료 | Express.js, 전체 CRUD + 음성 + 브레인덤프 |
| 태스크 데이터 38개 | ✅ 완료 | `data/tasks.json`에 저장 |
| 음성 입력 → AI 분류 | ✅ 코드 완료 | Whisper STT + Claude Haiku (API 키 필요) |
| 브레인덤프 → 태스크 파싱 | ✅ 코드 완료 | Claude Sonnet (API 키 필요) |
| AI 리포트 (데일리/위클리) | ✅ 코드 완료 | Claude Haiku (API 키 필요) |
| 크론잡 (모닝/나이트) | ✅ 코드 완료 | node-cron (API 키 필요) |
| GitHub에 Push | ✅ 완료 | `claude/review-md-plan-xWWP8` 브랜치 |

### 아직 안 된 것
| 항목 | 상태 | 필요한 것 |
|------|------|-----------|
| main 브랜치 머지 | ❌ | PR 만들어서 머지 필요 |
| VPS 배포 | ❌ | Docker로 VPS에 배포 필요 |
| API 키 설정 | ❌ | `.env` 파일에 실제 키 입력 필요 |
| React Native 앱 | ❌ | 아직 시작 안 함 |
| Apple Developer 등록 | ❌ | TestFlight 배포용 |

---

## 4. 로컬에서 실행하는 법

### 방법 A: 오프라인 대시보드 (가장 간단)

서버 없이 브라우저에서 바로 보기만 하고 싶으면:

```bash
# 1. GitHub에서 클론
git clone https://github.com/choichjj11-del/mission-control.git
cd mission-control

# 2. 브랜치 전환
git checkout claude/review-md-plan-xWWP8

# 3. 브라우저에서 열기
open dashboard-offline.html        # macOS
# 또는 그냥 파일을 더블클릭
```

이 파일은 38개 태스크 데이터가 HTML 안에 다 들어있어서 서버가 필요 없음.
체크박스 토글 가능 (새로고침하면 리셋).

### 방법 B: 풀 서버 (API 포함)

태스크 추가/삭제/음성/AI 기능까지 전부 쓰려면:

```bash
# 1. GitHub에서 클론
git clone https://github.com/choichjj11-del/mission-control.git
cd mission-control

# 2. 브랜치 전환
git checkout claude/review-md-plan-xWWP8

# 3. 서버 의존성 설치
cd server
npm install

# 4. 환경변수 설정 (AI 기능 쓸 경우)
cp .env.example .env
# .env 파일 열어서 API 키 입력:
#   ANTHROPIC_API_KEY=sk-ant-...   (Claude AI용)
#   OPENAI_API_KEY=sk-...          (Whisper 음성인식용)
#   TELEGRAM_BOT_TOKEN=...         (선택: 텔레그램 알림)
#   GITHUB_TOKEN=ghp_...           (선택: GitHub MD 자동 동기화)

# 5. 서버 실행
npm start
# → http://localhost:3000 에서 대시보드 열림

# 개발 모드 (파일 변경 시 자동 재시작):
npm run dev
```

### 방법 C: Docker

```bash
docker-compose up -d
# → http://localhost:3000
```

---

## 5. API 엔드포인트 요약

서버 실행 후 사용 가능:

| Method | URL | 설명 |
|--------|-----|------|
| GET | `/api/tasks` | 전체 태스크 목록 |
| POST | `/api/tasks` | 태스크 추가 |
| PATCH | `/api/tasks/:id` | 태스크 수정/완료 토글 |
| DELETE | `/api/tasks/:id` | 태스크 삭제 |
| GET | `/api/objectives` | 목표 목록 |
| PATCH | `/api/objectives/:id` | 목표 업데이트 |
| POST | `/api/voice/upload` | 음성→AI 태스크 업데이트 |
| POST | `/api/voice/todo` | 음성→할일 등록 |
| POST | `/api/braindump` | 텍스트→AI 태스크 파싱 |
| GET | `/api/report/daily` | 데일리 AI 리포트 |
| GET | `/api/report/weekly` | 위클리 AI 리포트 |
| GET | `/api/report/stats` | 통계 |
| POST | `/api/sync/github` | GitHub에 MD 동기화 |
| GET | `/api/health` | 서버 상태 확인 |

---

## 6. 핵심 아키텍처 원칙

### 토큰 절약형 3-Layer 구조
```
프론트엔드 (HTML)  →  백엔드 (Express)  →  AI (최소한만 호출)
   UI만 담당            CRUD + Whisper       Haiku 분류기 ~300토큰
   AI 호출 없음          데이터 관리           Sonnet은 브레인덤프만
```

### 예상 월 비용: ~$3.3/월
- Whisper STT: ~$1.8
- Haiku 분류기: ~$0.15
- Sonnet 파서: ~$1.35
- Haiku 리포트: ~$0.02

---

## 7. 데이터 구조 (tasks.json)

```json
{
  "id": 1,
  "name": "트렌딩 뮤직 90%+ 적용",
  "desc": "현재 52% → 에디츠 앱에서 수동 적용",
  "category": "content|auto|growth|infra",
  "priority": "즉시|단기|중기|장기",
  "section": "갓템홈 개선",
  "status": "todo|done",
  "done_at": null,
  "day": 1,
  "duration_min": 15,
  "tags": ["highlight", "high"],
  "created_at": "2026-02-17T00:00:00Z"
}
```

---

## 8. Git 브랜치 상황

```
main (origin/main)                ← 초기 커밋만 있음
claude/review-md-plan-xWWP8      ← 모든 개발 내용 여기에 있음 (9개 커밋)
```

### 커밋 히스토리 (최신 순)
1. `a53b2ce` — 오프라인 HTML 대시보드 추가
2. `32e671d` — 서버 0.0.0.0 바인딩 (외부 접속용)
3. `a870478` — 음성 버튼 텍스트 라벨 수정
4. `bb0bdc4` — 헤더 음성 버튼 SVG 아이콘 수정
5. `547e304` — 음성→할일 기능 + 완료 확인 플로우
6. `693311f` — 전체 UI (음성, 브레인덤프, CRUD, AI 리포트)
7. `e6cc2ee` — 백엔드 API 서버 추가
8. `7642460` — 파일 업로드
9. `c72553f` — 최초 커밋

### main에 머지하려면:
```bash
# GitHub에서 PR 만들기
gh pr create --base main --head claude/review-md-plan-xWWP8

# 또는 로컬에서 직접 머지
git checkout main
git merge claude/review-md-plan-xWWP8
git push origin main
```

---

## 9. 다음에 할 것 (우선순위 순)

1. **로컬에서 서버 띄워보기** — `npm start`로 확인
2. **main에 머지** — PR 또는 직접 머지
3. **VPS 배포** — Docker로 5.104.85.218에 배포
4. **API 키 설정** — Anthropic + OpenAI 키 .env에 넣기
5. **React Native 앱** — Expo로 모바일 앱 개발 시작

---

## 10. 참고 문서

| 파일 | 내용 |
|------|------|
| `MISSION_CONTROL_MASTER.md` | 전체 설계 (아키텍처, API, 음성 플로우, 크론잡) |
| `INFRA_SETUP.md` | VPS 정보, SSH, Nginx, Docker 설정 |
| `master_tasks.md` | 38개 태스크 원본 (사람이 읽는 용) |
