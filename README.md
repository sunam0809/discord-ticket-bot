# 🎫 Discord 티켓봇

슬래시 명령어로 티켓 패널을 생성하고, 유저가 버튼을 눌러 1:1 티켓 채널을 열 수 있는 디스코드 봇입니다.

## 기능

- `/티켓봇생성` — 티켓 패널 생성 (지정된 관리자 역할만 사용 가능)
  - 제목, 설명, 관리자 역할 지정 가능
- 유저가 버튼 클릭 → 비공개 티켓 채널 자동 생성
- 티켓 채널은 해당 유저 + 관리자 역할만 열람 가능
- `/티켓닫기` 또는 "티켓 닫기" 버튼으로 채널 삭제

## 환경 변수

| 변수명 | 설명 |
|---|---|
| `DISCORD_TOKEN` | 디스코드 봇 토큰 |
| `DISCORD_CLIENT_ID` | 애플리케이션 ID |
| `PORT` | HTTP 서버 포트 (기본값: 3000) |

## 로컬 실행

```bash
npm install
cp .env.example .env
# .env 파일에 토큰 입력
npm start
```

## 봇 초대

[디스코드 개발자 포털](https://discord.com/developers/applications)에서 봇을 서버에 초대할 때 아래 권한이 필요합니다:
- Manage Channels
- Send Messages
- Read Message History
- View Channels
- Use Slash Commands
