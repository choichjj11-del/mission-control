# 🖥️ Brian's Infrastructure Setup

> Last updated: 2026-02-19
> 이 문서를 각 프로젝트/대화에 올려서 환경 정보 참조용으로 사용

---

## VPS (Contabo Cloud VPS 2)

| 항목 | 값 |
|------|---|
| Provider | Contabo |
| Hostname | `vmi3077036` |
| IP | `5.104.85.218` |
| OS | Ubuntu 24.04 |
| Spec | 4 vCPU / 8GB RAM / 200GB SSD |
| SSH | `ssh root@5.104.85.218` |
| 비밀번호 | Contabo 패널에서 리셋 가능 |

---

## 서비스 & 포트

| 서비스 | 포트 | 상태 | 경로 |
|--------|------|------|------|
| n8n | `:5678` | ✅ Running | `/opt/moltbot/` |
| PostgreSQL | `:5432` | ✅ Running | `/opt/moltbot/` |
| Daily Manager Bot | — | ✅ Running (polling) | `/root/daily_manager_agent/` |
| Inpock Selenium | — | ✅ Cron 스케줄 | `/root/inpock-selenium/` |
| OpenClaw/Moltbot | — | ⏸️ 비활성 | `/root/.openclaw/` |
| Mission Control | `:8080` | 🆕 배포 예정 | `/opt/mission-control/` |

### n8n 접속
```
http://5.104.85.218:5678
```

---

## Docker 컨테이너 구성

### `/opt/moltbot/docker-compose.yml`
- `postgres` — DB (moltbot 데이터베이스)
- `n8n` — 워크플로우 자동화

### `/root/inpock-selenium/docker-compose.yml`
- `selenium` — Chrome 브라우저 (상시 실행)
- `inpock-bot` — 인포크 자동 업로드 (cron으로 실행)

### `/root/daily_manager_agent/`
- `daily-manager` — 텔레그램 데일리 매니저 봇

---

## Cron 스케줄 (KST 기준)

| 시간 (KST) | UTC | 작업 |
|-------------|-----|------|
| 10:00 | 01:00 | 인포크 자동 업로드 |
| 14:00 | 05:00 | 인포크 자동 업로드 |
| 02:00 | 17:00 | 인포크 자동 업로드 |

---

## API Keys & Credentials

> ⚠️ 실제 키는 여기에 적지 않음. 위치만 참조.

| 서비스 | 용도 | 키 위치 |
|--------|------|---------|
| Anthropic API | Claude Sonnet/Haiku 호출 | n8n credentials / OpenClaw config |
| ElevenLabs | TTS 음성 생성 (Pro 플랜, 150만 크레딧) | n8n credentials |
| OpenAI | Whisper STT | n8n credentials |
| Box | 파일 공유 (편집팀) | n8n credentials |
| Telegram Bot | 알림/매니저 봇 | `.env` 파일들 |
| Apify | 인스타그램 크롤링 | n8n credentials |
| 쿠팡파트너스 | 어필리에이트 링크 | 인포크 계정 내 |

### 텔레그램 봇 정보
| 항목 | 값 |
|------|---|
| Bot Token | `8279443905:AAF...` (각 `.env` 참조) |
| Brian Chat ID | `7853728816` |

### ElevenLabs Voice ID
| 목소리 | 이름 |
|--------|------|
| 남성 | (SHOP) CJ v3.0 |
| 여성 | (SHOP) EA v3.0 |

---

## 소셜 미디어 계정

| 플랫폼 | 계정명 | 용도 |
|--------|--------|------|
| Instagram | `godtem.home` (갓템홈) | 메인 홈 리빙 채널 |
| Instagram | 다국어 계정 예정 | `godtem.home.en` / `.jp` / `.vn` |
| TikTok | 갓템홈 | 크로스포스팅 |
| Facebook Page | 갓템홈 | ManyChat 연동 예정 |
| Naver Clip | 갓템홈 | 네이버 트래픽 |
| 인포크 (Inpock) | `godtem.home` | 어필리에이트 링크 관리 |

---

## GitHub Repos (Private)

| 레포 | 용도 | VPS 연결 |
|------|------|----------|
| `inpock-selenium` | 인포크 자동 업로드 | SSH deploy key 설정 완료 |
| `daily_manager_agent` | 텔레그램 데일리 매니저 | VPS에 clone 완료 |

> VPS → GitHub 인증: SSH key (`~/.ssh/github_inpock`)

---

## 로컬 환경 (Brian PC)

| 항목 | 값 |
|------|---|
| OS | Windows |
| GPU | RTX 5070 |
| 상시 가동 | ✅ (365일 거의 안 끔) |
| Claude Desktop | 설치됨 (MCP 연결용) |
| Claude Code | 사용 중 |

---

## 프로젝트 5개 우선순위

1. **UGC 인플루언서 육성** — 영어/한국어 계정, 매일 상품리뷰
2. **동기부여 알람앱** — 다짐 읽어야 알람 꺼짐, React Native/Flutter
3. **OpenClaw 자율에이전트** — VPS 배포, 텔레그램 연동, 자동화
4. **AI UGC 영상 자동화** — Arcads/MakeUGC + ElevenLabs + Kling
5. **어필리에이트 퍼널** — 무료 가이드 → 쿠팡 → 컨설팅

---

## Quick Commands

```bash
# VPS 접속
ssh root@5.104.85.218

# 서비스 상태 확인
docker ps

# n8n 로그
cd /opt/moltbot && docker compose logs -f n8n

# 인포크 수동 실행
cd /root/inpock-selenium && docker compose run --rm inpock-bot

# 데일리 매니저 로그
docker logs daily-manager --tail 50

# Mission Control 서빙
cd /opt/mission-control && python3 -m http.server 8080 --bind 0.0.0.0 &
```
