# Mission Control App — 마스터 설계 문서

> 이 문서를 Claude Code에 올리면 바로 개발 이어갈 수 있도록 전체 맥락 + 아키텍처 + 개발 가이드를 담았음.
> Last updated: 2026-02-19

---

## 1. 프로젝트 개요

### 뭘 만드는가
**AI 파워드 개인 프로젝트 매니저 앱** — Brian의 비즈니스(갓템홈 어필리에이트) 전체 태스크를 관리하는 모바일 앱.

### 핵심 기능 (우선순위 순)
1. **음성 브레인덤프** → Whisper STT → AI가 태스크 자동 파싱/업데이트
2. **실시간 진행률 추적** → 체크박스, 프로그레스 바, 월간 히트맵
3. **AI 자동 브리핑** → 데일리/위클리 진행 리포트
4. **타임라인 알림** → 크론잡 기반 리마인더 (앱 푸시 알림)
5. **Daily/Weekly/Monthly 뷰** + 캘린더

### 유저
Brian 1인 사용. 아내와 공유 가능성 있음. 추후 SaaS 확장 고려.

---

## 2. ⚡ 토큰 절약형 아키텍처 (가장 중요)

### 원칙: AI는 최소한만 호출한다

```
❌ 나쁜 구조 (토큰 폭발):
  음성 입력 → 전체 MD(38개 태스크) Claude에 전송 → 분석 → 전체 MD 반환
  = 매번 입력 3,000~5,000 토큰 + 출력 3,000~5,000 토큰
  = 하루 20번 × $15/M tokens = 하루 $0.3~1.5, 월 $9~45

✅ 좋은 구조 (토큰 90% 절약):
  음성 입력 → Whisper STT → 분류기(Haiku) → 해당 섹션만 업데이트
  = 매번 입력 200~500 토큰 + 출력 100~300 토큰
  = 하루 20번 × $0.25/M tokens = 하루 $0.003, 월 $0.09
```

### 3-Layer 아키텍처

```
┌─────────────────────────────────────────────────┐
│  LAYER 1: 프론트엔드 (React Native 앱)          │
│                                                  │
│  - UI 렌더링 (Sunsama 스타일)                    │
│  - 음성 녹음 → API 전송                         │
│  - 체크박스 토글 → API 전송                      │
│  - 푸시 알림 수신                                │
│  - 로컬 캐시 (SQLite/AsyncStorage)              │
│                                                  │
│  ⚡ AI 호출 없음. 순수 UI만.                     │
└──────────────────┬──────────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────────┐
│  LAYER 2: 백엔드 API (VPS: Node.js or Python)   │
│                                                  │
│  - CRUD: 태스크 읽기/쓰기/수정/삭제              │
│  - 데이터: JSON 파일 or SQLite (경량)            │
│  - GitHub 자동 push (MD 백업)                    │
│  - 크론잡: 데일리 리포트, 리마인더               │
│  - 음성 파일 → Whisper API 호출 → 텍스트 반환   │
│                                                  │
│  ⚡ AI 호출: Whisper STT만 (저렴)               │
└──────────────────┬──────────────────────────────┘
                   │ 필요할 때만 호출
┌──────────────────▼──────────────────────────────┐
│  LAYER 3: AI 처리 (최소한만 호출)                │
│                                                  │
│  3a. 분류기 (Haiku — 가장 저렴)                  │
│      입력: STT 텍스트 (짧음)                     │
│      출력: {action, task_id, update}             │
│      용도: "트렌딩뮤직 했어" → task #1 done      │
│      토큰: ~300 입출력 합계                      │
│                                                  │
│  3b. 브레인덤프 파서 (Sonnet — 중간)             │
│      입력: 긴 음성 텍스트 + 현재 태스크 목록     │
│      출력: 새 태스크 추가/수정 JSON              │
│      용도: 새 아이디어 정리                      │
│      호출 빈도: 하루 1~3번                       │
│      토큰: ~1,000 입출력 합계                    │
│                                                  │
│  3c. 데일리 리포트 (Haiku — 저렴)                │
│      입력: 오늘 변경된 태스크만 (diff)            │
│      출력: 브리핑 텍스트                         │
│      호출 빈도: 하루 1번 (크론잡)                │
│      토큰: ~500 입출력 합계                      │
│                                                  │
│  ⚡ 절대 안 하는 것:                             │
│    - 전체 태스크 목록을 매번 보내기               │
│    - UI 렌더링용 데이터를 AI가 생성              │
│    - 단순 CRUD를 AI가 처리                       │
└─────────────────────────────────────────────────┘
```

### 예상 월 비용

| 항목 | 단가 | 일 호출 | 월 비용 |
|------|------|---------|---------|
| Whisper STT | $0.006/분 | 20회 × 0.5분 | ~$1.8 |
| Haiku 분류기 | $0.25/$1.25/M | 20회 × 300tok | ~$0.15 |
| Sonnet 파서 | $3/$15/M | 3회 × 1,000tok | ~$1.35 |
| Haiku 리포트 | $0.25/$1.25/M | 1회 × 500tok | ~$0.02 |
| **합계** | | | **~$3.3/월** |

→ 나쁜 구조 대비 **90%+ 절약**

---

## 3. 데이터 구조

### 왜 JSON이 MD보다 나은가
- MD는 사람이 읽기 좋지만 프로그래밍으로 파싱/수정이 번거로움
- JSON은 프로그래밍 친화적이고 부분 업데이트가 쉬움
- **MD는 백업/공유용**, **JSON은 런타임용**으로 이원화

### tasks.json (런타임 데이터)

```json
{
  "version": 1,
  "updated_at": "2026-02-19T18:00:00Z",
  "tasks": [
    {
      "id": 1,
      "name": "트렌딩 뮤직 90%+ 적용",
      "desc": "현재 52% → 에디츠 앱에서 수동 적용",
      "category": "content",
      "priority": "즉시",
      "section": "갓템홈 개선",
      "status": "todo",
      "done_at": null,
      "day": 1,
      "duration_min": 15,
      "tags": [],
      "created_at": "2026-02-17T00:00:00Z"
    }
  ],
  "objectives": [
    {
      "id": "obj-1",
      "title": "월 수익 1,000만원",
      "target": 10000000,
      "current": 0,
      "unit": "won"
    }
  ],
  "brain_dumps": [
    {
      "id": "bd-001",
      "text": "뷰티 카테고리 해외에서도 먹힐 것 같은데...",
      "audio_url": null,
      "parsed": true,
      "created_at": "2026-02-19T20:00:00Z",
      "resulting_actions": [{"type": "add_task", "task_id": 39}]
    }
  ]
}
```

### master_tasks.md (백업/공유용)
- 서버에서 tasks.json 변경 시 → 자동으로 MD 재생성 → GitHub push
- 사람이 읽을 수 있는 형태 유지
- Claude Code나 다른 AI 도구에 올릴 때 사용

---

## 4. API 엔드포인트 설계

### 백엔드: Express.js (Node) or FastAPI (Python)

```
GET    /api/tasks                    → 전체 태스크 (캐시)
GET    /api/tasks/:id                → 단일 태스크
PATCH  /api/tasks/:id                → 태스크 수정 (체크, 이름 등)
POST   /api/tasks                    → 태스크 추가
DELETE /api/tasks/:id                → 태스크 삭제

GET    /api/objectives               → 목표 목록
PATCH  /api/objectives/:id           → 목표 업데이트

POST   /api/voice/upload             → 음성 파일 업로드
  → Whisper STT → 텍스트 반환
  → Haiku 분류기 → 액션 판단
  → 자동 태스크 업데이트
  → 응답: {transcript, actions_taken}

POST   /api/braindump                → 텍스트 브레인덤프
  → Sonnet 파서 → 새 태스크 추출
  → tasks.json 업데이트
  → 응답: {new_tasks, updated_tasks}

GET    /api/report/daily             → 오늘 리포트
GET    /api/report/weekly            → 주간 리포트

POST   /api/sync/github              → GitHub에 MD push
```

---

## 5. 음성 → 태스크 업데이트 플로우 (상세)

```
[Brian 음성] "트렌딩 뮤직 오늘 3개 다 적용했어"
       │
       ▼
[Whisper STT] → "트렌딩 뮤직 오늘 3개 다 적용했어"
       │
       ▼
[Haiku 분류기] 
  시스템 프롬프트 (고정, 짧음):
  "당신은 태스크 업데이트 분류기입니다.
   유저 입력을 분석해서 JSON으로 반환하세요.
   가능한 action: check, uncheck, add, update, note
   태스크 목록(ID와 이름만): {id:1,name:'트렌딩뮤직'}, {id:2,name:'포스팅빈도'}..."
  
  유저 입력: "트렌딩 뮤직 오늘 3개 다 적용했어"
  
  출력: {"action":"check","task_id":1,"note":"3개 적용 완료"}
       │
       ▼
[백엔드] tasks.json에서 task #1 → status: "done", done_at: now
       │
       ▼
[앱] UI 실시간 업데이트 (WebSocket or polling)
```

### 분류기 프롬프트 최적화 (토큰 절약 핵심)

```
⚡ 핵심: 태스크 목록을 ID+이름만 보냄 (설명, 비고 제외)

나쁜 예 (토큰 낭비):
  "task 1: 트렌딩 뮤직 90%+ 적용, 현재 52% → 에디츠 앱에서 수동 적용, 하루 1개만..."

좋은 예 (토큰 절약):  
  "1:트렌딩뮤직 2:포스팅빈도 3:영상길이 4:벤치마킹 5:뷰티테스트 6:캡션hook"

→ 38개 태스크 전체를 200토큰 이내로 압축 가능
```

---

## 6. 크론잡 설계

```
매일 07:00 KST — 모닝 브리핑
  → Haiku에 어제 변경사항(diff)만 전송
  → "어제 3개 완료, 오늘 즉시실행 6개 남음" 생성
  → 앱 푸시 알림 (or 텔레그램 백업)

매일 22:00 KST — 나이트 리뷰
  → 오늘 완료 태스크 요약
  → 내일 추천 태스크 3개
  → 앱 푸시 알림

매주 일요일 10:00 KST — 주간 리포트
  → 이번 주 완료율, 다음 주 플랜
  → GitHub에 weekly_report_YYYY-MM-DD.md push
```

---

## 7. 기술 스택 결정

### 프론트엔드: React Native (Expo)
- iOS/Android 동시 배포
- 프로젝트 2 (동기부여 알람앱)과 코드 공유 가능
- Expo Push Notification으로 알림

### 백엔드: Node.js + Express
- VPS(5.104.85.218)에 배포
- SQLite 또는 JSON 파일 (가볍게)
- Docker 컨테이너

### AI 서비스
- **Whisper API** → STT (음성→텍스트)
- **Claude Haiku** → 분류기 (태스크 매칭), 리포트
- **Claude Sonnet** → 브레인덤프 파서 (복잡한 분석만)

### 인프라 (이미 있음)
- VPS: Contabo 5.104.85.218
- 도메인: dashboard.lucyhome.ai (Nginx 설정 완료)
- GitHub: choichjj11-del/mission-control
- Telegram Bot: 백업 알림용

---

## 8. 현재 상태 & 완료된 것

### ✅ 완료
- [x] UI 프로토타입 (Sunsama 스타일 HTML) — dashboard.lucyhome.ai에 배포됨
- [x] 38개 태스크 데이터 정의 (master_tasks.md)
- [x] VPS 인프라 (n8n, postgres, daily-manager, inpock-selenium)
- [x] Nginx 리버스 프록시 설정
- [x] Cloudflare DNS 연결
- [x] GitHub 레포 + VPS SSH deploy key
- [x] 경쟁 분석 완료 (13채널 700릴스)
- [x] INFRA_SETUP.md (전체 인프라 환경 정보)

### 🔜 다음 개발 단계
1. **백엔드 API 서버** 만들기 (Node.js + Express)
   - tasks.json CRUD
   - /api/voice/upload → Whisper → Haiku 분류기
   - /api/braindump → Sonnet 파서
   - GitHub 자동 push
2. **React Native 앱 프로젝트** 초기화
   - Expo 프로젝트 생성
   - Sunsama 스타일 UI 포팅 (HTML → React Native)
3. **음성 입력 연동** (Whisper + Haiku 분류기)
4. **크론잡** (데일리 브리핑, 리마인더)
5. **Apple Developer 등록 + TestFlight 배포**

---

## 9. 파일 참조

| 파일 | 위치 | 용도 |
|------|------|------|
| UI 프로토타입 | dashboard.lucyhome.ai (GitHub: mission-control/index.html) | 현재 정적 HTML |
| 태스크 마스터 | master_tasks.md | 38개 태스크 원본 |
| 인프라 정보 | INFRA_SETUP.md | VPS, API, 계정 등 환경 정보 |
| 경쟁 분석 | godtemhome_final_analysis.html | 13채널 분석 대시보드 |
| 채널 아이템 분석 | godtemhome_channel_items_analysis.html | 카테고리별 성과 |

---

## 10. 개발 시작 가이드 (Claude Code용)

### Step 1: 백엔드 API 먼저
```bash
# VPS에서
mkdir -p /opt/mission-control-api
cd /opt/mission-control-api
npm init -y
npm install express cors
```

### Step 2: tasks.json 초기 데이터 생성
master_tasks.md의 38개 태스크를 JSON 형태로 변환해서 tasks.json 생성.

### Step 3: API 서버 구현
위 섹션 4의 엔드포인트 구현. 토큰 절약형 음성 처리 파이프라인 (섹션 5) 반드시 따를 것.

### Step 4: Nginx에 API 라우팅 추가
```
api.lucyhome.ai → localhost:3000 (API 서버)
dashboard.lucyhome.ai → /opt/mission-control (정적 HTML)
```

### Step 5: React Native 앱
Expo로 초기화, HTML UI를 컴포넌트로 포팅.

---

## 11. 핵심 제약 조건

1. **토큰 비용 월 $5 이하 유지** — 이게 가장 중요한 제약. 위 아키텍처 반드시 따를 것.
2. **Haiku 우선, Sonnet은 브레인덤프만** — 분류기는 무조건 Haiku.
3. **전체 태스크를 AI에 보내지 않기** — ID+이름만 압축해서 전송.
4. **JSON 런타임 + MD 백업** 이원화 — AI가 MD를 직접 파싱하지 않음.
5. **기존 VPS 인프라 활용** — 새 서버 안 만듦.
