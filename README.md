# 💑 우리의 날 - 커플 앱

> 마지막 정리: 2026-11-01 · 실제 코드/파일 구조를 기준으로 작성됨

## 1. 프로젝트 개요

- **무엇**: 연인 두 사람이 초대 코드로 계정을 연결해 일정·버킷리스트·대화·추억(사진/영상)을 함께 기록하는 모바일 앱 (앱 이름 `우리의 날`, 번들 ID `com.together.ourdays`)
- **목적**: 공유 캘린더를 중심으로 데이트 기록, 가고 싶은 곳(버킷리스트 + 인스타 릴스), 다녀온 지역 지도, 실시간 채팅, 홈 화면 D-day 위젯을 한 앱에서 제공
- **대상 사용자**: 한국어를 쓰는 커플 (UI 문구·지역 데이터 모두 한국 기준)
- **플랫폼**: iOS / Android (Expo, 주 테스트 기기는 아이폰 — 확인 필요)

---

## 2. 구현 기능 목록

상태: ✅ 완료 / 🚧 진행 중 / ⏳ 예정 / ❌ 취소 · 🔍 = 코드에서 확인한 내용이며 대화 기록에는 없음(아래 5번 참고)

### 인증 / 계정
| 기능 | 상태 | 위치 |
|---|---|---|
| 이메일 회원가입·로그인 (Supabase Auth) | ✅ | `src/screens/LoginScreen.tsx`, `authApi` |
| 세션 유지 (AsyncStorage) / 로그인 상태에 따라 자동 이동 | ✅ | `app/_layout.tsx`, `app/index.tsx` |
| 프로필 편집 (이름, 아바타 사진 업로드·400px 압축) / 로그아웃 | ✅ | `app/profile-edit.tsx`, `userApi.uploadAvatar` |
| 소셜 로그인 (구글/카카오 등) | ⏳ 확인 필요 — `expo-auth-session`·`expo-web-browser`는 설치돼 있지만 코드에서 사용하지 않음 | – |

### 커플 연동
| 기능 | 상태 | 위치 |
|---|---|---|
| 초대 코드 발급 / 코드 입력으로 연동 / 코드 복사 | ✅ | `src/screens/CoupleConnectScreen.tsx`, `coupleApi` |
| 커플 설정: 사귄 날짜(기념일) 설정 | ✅ | `app/couple-settings.tsx` |
| 커플 설정: 하단 탭(버킷리스트/대화/지도) 표시 여부 — 상대방 화면에도 실시간 반영 | ✅ | `couples.menu_settings`, `useCoupleStore.updateMenuSettings` |
| 서로 부르는 별칭 (내 별칭은 상대방만 설정 가능) | ✅ | `app/nickname-settings.tsx`, `008_nicknames.sql` |
| 커플 연동 끊기 (`status='separated'`) | ✅ | `app/couple-settings.tsx` |
| 테마 색상 6종 (핑크/그린/블루/퍼플/코랄/민트, 기기별 저장) | ✅ | `src/theme.ts`, `useThemeStore` |

### 캘린더 (메인 탭)
| 기능 | 상태 | 위치 |
|---|---|---|
| 월별 공유 캘린더, 년/월 선택 모달, 날짜별 일정 패널(드래그로 닫기) | ✅ | `src/screens/CalendarScreen.tsx` |
| 일정 등록/수정/삭제, 카테고리 5종 (`date`/`anniversary`/`travel`/`daily`/`special`) | ✅ | `app/event/[id].tsx` |
| 기념일: 이모지 아이콘 지정 + **매년 반복** (다른 연도 일정을 현재 연도로 가상 매핑) | ✅ | `calendarApi.getByMonth`, `009_calendar_recurring_icon_idea.sql` |
| 일정에 사진 여러 장 업로드 (원본 + 200px 썸네일), 캐러셀·확대 보기(아래로 드래그해 닫기) | ✅ | `mediaApi.uploadImage`, `app/event/[id].tsx` |
| 캘린더 날짜 칸에 첫 번째 사진 썸네일 / 기념일 아이콘 표시 | ✅ | `CalendarScreen.tsx` |
| 일정 ↔ 버킷리스트 연결 (`date_idea_id`) | ✅ | `app/event/[id].tsx`, `009_calendar_recurring_icon_idea.sql` |
| 일정에 지역(시/군/구) 지정 (`region_code`) — 지역 즐겨찾기(기기별) | ✅ | `004_map_region.sql`, `useFavoriteRegionsStore` |

### 버킷리스트 (데이트 목록)
| 기능 | 상태 | 위치 |
|---|---|---|
| 위시리스트 → 예정 → 완료 탭, 등록/수정/삭제, 카테고리 6종 | ✅ | `src/screens/DateIdeasScreen.tsx` |
| 항목별 인스타그램 릴스/게시물 링크 여러 개 + 하트(좋아요) + 메모 | ✅ | `instagram_links` (JSONB) |
| 릴스 뷰어: 세로 스와이프, 모바일 UA로 원본 게시물 WebView 표시 | ✅ | `src/screens/ReelViewerScreen.tsx` |
| 연결된 일정 목록 표시 | ✅ | `calendarApi.getByDateIdea` |

### 대화 (채팅)
| 기능 | 상태 | 위치 |
|---|---|---|
| 실시간 채팅 (Supabase Realtime), 읽음 표시, 메시지 삭제 | ✅ | `app/(tabs)/chat.tsx`, `messageApi`, `002_messages.sql` |
| 위로 스크롤 시 과거 메시지 페이지 로딩 | ✅ | `messageApi.getOlderThan` |
| 채팅 배경 이미지 설정 (기기별 로컬 저장) | ✅ | `chat.tsx` (`chat_bg_<userId>`) |

### 지도
| 기능 | 상태 | 위치 |
|---|---|---|
| 한국 시/군/구 SVG 지도, 일정이 있는 지역 색칠, 확대·축소(최대 8배), 지역 탭 시 해당 일정 목록 시트 | ✅ | `src/screens/MapScreen.tsx`, `src/data/koreaRegions.json`, `src/data/regions.ts` |

### 푸시 알림
| 기능 | 상태 | 위치 |
|---|---|---|
| Expo 푸시 토큰 발급 후 `users.push_token`에 저장 | ✅ | `src/lib/notifications.ts`, `007_push_token.sql` |
| 상대방에게 알림 전송: 새 일정 / 새 버킷리스트 / 새 릴스 / 새 메시지 | ✅ (클라이언트에서 Expo Push API 직접 호출) | `sendPushNotification` |
| 알림 탭 시 해당 화면으로 이동 (콜드 스타트 포함) | ✅ | `resolveNotificationRoute`, `app/_layout.tsx` |

### 홈 화면 위젯 (함께한 날 D-day)
| 기능 | 상태 | 위치 |
|---|---|---|
| Android 위젯 (`react-native-android-widget`, headless task) | ✅ 코드 완료 / 실기기 동작 확인 필요 | `widgets/DdayWidget.tsx`, `widget-task-handler.tsx`, `index.js` |
| iOS 위젯 (WidgetKit + App Group `group.com.together.ourdays.widget`) | ✅ 코드 완료 / 실기기 동작 확인 필요 | `targets/widget/`, `src/lib/widgetSync.tsx` |

### 기존 README에 있었으나 현재 상태가 다른 기능
| 기능 | 상태 | 비고 |
|---|---|---|
| 캐릭터 꾸미기 (아이템 장착, 레벨업) | 🚧 화면·API는 있으나 **탭에서 숨김** (`href: null`), 진입 경로 없음. 아이템 이미지 에셋 없음 | `src/screens/CharacterScreen.tsx`, `characterApi`. 숨긴 이유·향후 계획 확인 필요 |
| 유튜브/인스타 영상 공유 & 재생 (일정별) | 🚧 화면은 있으나 **진입 경로 없음** (`/media/...`로 이동하는 코드 없음). 인스타 영상은 현재 버킷리스트 릴스 기능으로 대체된 것으로 보임 | `src/screens/MediaPlayerScreen.tsx`, `app/media/[eventId].tsx`. 확인 필요 |

---

## 3. 기술 스택 & 구조

### 스택
- **언어**: TypeScript (`typescript ~6.0.3`), Swift (iOS 위젯)
- **프레임워크**: Expo SDK 57 (`expo ^57.0.0`), React Native `0.86.3`, React `19.2.3`, Expo Router `~57.0.21` (typed routes 사용)
- **백엔드**: Supabase (`@supabase/supabase-js` — Auth, Postgres + RLS, Realtime, Storage)
- **상태관리**: `zustand` (+ `persist` 미들웨어로 AsyncStorage 저장)
- **주요 라이브러리**: `date-fns`(ko 로케일), `expo-image`, `expo-image-picker`, `expo-image-manipulator`, `expo-notifications`, `expo-clipboard`, `react-native-reanimated` 4 + `react-native-worklets`, `react-native-gesture-handler`, `react-native-svg`, `react-native-zoom-toolkit`(지도 확대), `react-native-webview`(릴스), `react-native-youtube-iframe`, `react-native-android-widget`, `@bacons/apple-targets`(iOS 위젯 타깃)
- **폰트**: Pretendard(`FONT`, 본문), 여기어때 잘난체 `Jalnan2`(`FONT_HEADING`, 제목) — `assets/fonts/`
- **빌드**: EAS Build (`eas.json`: `development`(dev client) / `preview` / `production`), EAS Update (`runtimeVersion.policy = appVersion`)

### 폴더 구조
```
couple-app/
├── app.json                    # Expo 설정 (공개해도 되는 값만)
├── app.config.js               # app.json + .env/EAS 환경 변수의 Supabase 설정을 합침
├── .env.example                # 필요한 환경 변수 이름 목록 (.env는 git 제외)
├── index.js                    # 앱 진입점: expo-router/entry + Android 위젯 task 등록
├── widget-task-handler.tsx     # Android 위젯 headless task (AsyncStorage에서 기념일 읽어 렌더)
├── widgets/DdayWidget.tsx      # Android 위젯 UI
├── targets/widget/             # iOS 위젯 (DdayWidget.swift, expo-target.config.js)
├── app/                        # Expo Router 라우트
│   ├── _layout.tsx             # 루트 Stack, 세션 감지, 폰트 로드, 푸시 토큰 동기화, 알림 탭 라우팅
│   ├── index.tsx               # 스플래시 → /login | /couple-connect | /(tabs) 리다이렉트
│   ├── login.tsx               # → LoginScreen
│   ├── couple-connect.tsx      # → CoupleConnectScreen
│   ├── couple-settings.tsx     # 커플 설정 (메뉴 표시, 별칭 진입, 기념일, 연동 끊기)
│   ├── nickname-settings.tsx   # 별칭 설정
│   ├── profile-edit.tsx        # 내 정보 편집 / 로그아웃
│   ├── event/[id].tsx          # 일정 상세·등록(id=new)·수정, 사진, 반복, 아이콘, 지역, 버킷리스트 연결
│   ├── media/[eventId].tsx     # → MediaPlayerScreen (현재 진입 경로 없음)
│   └── (tabs)/
│       ├── _layout.tsx         # 하단 탭 (menu_settings에 따라 탭 숨김)
│       ├── index.tsx           # 캘린더 → CalendarScreen
│       ├── dates.tsx           # 버킷리스트 → DateIdeasScreen
│       ├── chat.tsx            # 대화 (화면 코드가 라우트 파일에 직접 있음)
│       ├── map.tsx             # 지도 → MapScreen
│       ├── character.tsx       # 캐릭터 (탭 숨김)
│       └── profile.tsx         # 프로필 (커플 카드, 초대 코드, 테마, 내 정보/커플 설정 진입)
├── src/
│   ├── lib/
│   │   ├── supabase.ts         # Supabase 클라이언트 (expoConfig.extra에서 URL/키 읽음 — 값은 app.config.js가 env에서 주입)
│   │   ├── api.ts              # authApi, userApi, coupleApi, calendarApi, dateApi, characterApi, mediaApi, messageApi
│   │   ├── notifications.ts    # 푸시 권한/토큰, 전송, 알림→라우트 변환
│   │   └── widgetSync.tsx      # 커플 데이터 변경 시 위젯 데이터 동기화 (Android/iOS)
│   ├── store/index.ts          # useAuthStore, useCoupleStore(Realtime 구독), useThemeStore, useFavoriteRegionsStore
│   ├── screens/                # 화면 컴포넌트 (Calendar, DateIdeas, ReelViewer, Map, Login, CoupleConnect, Character, MediaPlayer)
│   ├── data/                   # 한국 시/군/구 SVG path 데이터 + 헬퍼
│   ├── types/index.ts          # DB 대응 타입
│   ├── theme.ts                # 폰트 상수, 테마 색상
│   └── assets/                 # 앱 아이콘, 스플래시
├── assets/fonts/               # Pretendard, Jalnan2, D2Coding(미사용)
└── supabase/migrations/        # SQL Editor에 순서대로 수동 실행하는 스키마 파일
```

### DB 테이블 (Supabase)
`users`, `couples`, `calendar_events`, `date_ideas`, `characters`, `character_items`, `event_media`, `messages` — 모두 RLS 적용, 같은 커플만 조회 가능.
Storage 버킷: `avatars`(프로필 사진), `event-images`(일정 사진) — **public 버킷이어야 함**, 마이그레이션에는 없음(대시보드에서 수동 생성).

---

## 4. 실행 방법

### 4-1. Supabase 설정
1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에서 `supabase/migrations/`의 파일을 번호 순서대로 실행
   - `001_initial_schema.sql` → `002_messages.sql` → `003_menu_settings.sql` → `004_map_region.sql` → `005_date_idea_instagram_link.sql` → `006_date_idea_instagram_link_like.sql` → `007_push_token.sql` → `008_nicknames.sql` → `009_calendar_recurring_icon_idea.sql`
   - `002b_messages_read_at.sql`은 **예전 버전의 002를 이미 실행한 DB에서만** 실행 (최신 002에는 이미 포함 — 둘 다 실행하면 정책 중복 에러)
   - `009`는 `ADD COLUMN IF NOT EXISTS`라서 컬럼을 이미 수동으로 추가한 운영 DB에서 실행해도 안전 (기존 컬럼 정의는 바뀌지 않음)
3. **Storage**에서 `avatars`, `event-images` 버킷을 public으로 생성
4. **Project Settings > API**에서 Project URL과 anon(publishable) key 확인

### 4-2. 환경 변수 / 설정 값 (값은 여기 적지 않음)
**환경 변수** (`.env` — git 제외. `.env.example`을 복사해서 값 채우기)

| 이름 | 용도 | 읽는 곳 |
|---|---|---|
| `SUPABASE_URL` | Supabase 프로젝트 URL | `app.config.js` → `expo.extra.supabaseUrl` |
| `SUPABASE_ANON_KEY` | Supabase anon/publishable key | `app.config.js` → `expo.extra.supabaseAnonKey` |
| `EXPO_ROUTER_DISABLE_RN_NAVIGATION_CHECK` | Expo Router의 React Navigation 버전 검사 비활성화 (`1`) | Expo CLI (`eas.json`의 각 build profile `env`에도 있음) |

**`app.json`에 그대로 두는 값** (앱 바이너리·스토어에 어차피 노출되는 식별자라 비밀이 아님)

| 이름 | 용도 |
|---|---|
| `expo.extra.eas.projectId`, `expo.updates.url` | EAS 프로젝트 ID / EAS Update 주소 (푸시 토큰 발급에도 사용) |
| `expo.ios.appleTeamId` | iOS 서명용 Apple Team ID |

**EAS 클라우드 빌드**: `.env`는 git에서 제외돼 빌드 서버에 올라가지 않으므로, 빌드 전에 EAS 환경 변수를 등록해야 함 (값은 직접 입력):
```bash
eas env:create --name SUPABASE_URL --environment production --visibility plaintext
eas env:create --name SUPABASE_ANON_KEY --environment production --visibility sensitive
# development / preview 프로필로도 빌드한다면 --environment 를 바꿔서 같은 방식으로 등록
```

### 4-3. 설치 & 실행
```bash
npm install
cp .env.example .env        # 그다음 .env에 SUPABASE_URL, SUPABASE_ANON_KEY 값 입력
npx expo install --fix      # Expo SDK와 패키지 버전 맞추기
npx expo start              # = npm start
```
- 위젯(`@bacons/apple-targets`, `react-native-android-widget`)과 `expo-dev-client`가 들어 있어 **Expo Go로는 전체 기능이 동작하지 않음** → development build 필요:
```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios       # 또는 android
npx expo start --dev-client
```

### 4-4. 빌드 / 배포
```bash
npm run build:ios           # eas build --platform ios (production 프로필)
npm run build:android       # eas build --platform android
eas submit --platform ios   # 확인 필요: 실제 사용 여부
```
- iOS 배포에는 Apple Developer 계정($99/년) 필요
- 앱 버전은 EAS 원격 관리(`appVersionSource: remote`, production `autoIncrement`)

### 4-5. 테스트 / 검사
- 테스트 코드·테스트 러너 없음
- 타입 검사: `npx tsc --noEmit` (현재 에러 있음 — 7번 참고)

---

## 5. 요청 히스토리 요약

> ⚠️ 이 README를 작성한 세션에는 이전 대화 기록이 남아 있지 않아(로컬에 남은 세션 기록은 이 README 정리 요청 하나뿐), 아래 내용은 **코드·마이그레이션·주석·기존 README에서 역추적한 것**입니다. 실제 요청 순서와 문구는 확인 필요입니다. git 이력은 2026-11-01 첫 커밋부터 시작하므로, 그 이전 변경 과정은 git으로도 확인할 수 없습니다.

| # | 요청 (추정) | 결과 |
|---|---|---|
| 1 | 커플 앱 기본 골격 (이메일 로그인, 초대 코드 연동, 공유 캘린더, 버킷리스트, 캐릭터, 영상 공유) | 기존 README + `001_initial_schema.sql` 작성 |
| 2 | 실시간 채팅 + 읽음 확인 | `002_messages.sql`, 이후 읽음 기능은 `002b`로 보강 |
| 3 | 버킷리스트/대화 탭 표시 여부를 커플이 함께 설정 | `003_menu_settings.sql`, 커플 설정 화면 |
| 4 | 일정에 지역 지정 + 지도 탭 | `004_map_region.sql`, `MapScreen`, 한국 시/군/구 데이터 |
| 5 | 지도 확대 시 탭이 씹히는 문제 수정 | 절대좌표 역산, 짧은 팬=탭 처리, longPress 보정 (`MapScreen.tsx` 주석) |
| 6 | 버킷리스트에 인스타 링크 → 여러 개 → 하트(좋아요) | `005` (단일 → 배열) → `006` (JSONB `{url, liked}`), 이후 `memo` 필드 추가(타입에만 존재) |
| 7 | 릴스를 앱 안에서 모바일처럼 보기 | `/embed/` 방식 → 모바일 UA로 원본 링크 열기로 변경 (`ReelViewerScreen.tsx` 주석) |
| 8 | 매년 반복 기념일, 기념일 아이콘, 일정↔버킷리스트 연결 | 코드 구현됨, 당시 마이그레이션 파일 없음 → #17에서 `009` 추가 |
| 9 | 일정 사진 업로드/썸네일/확대 보기 | `mediaApi.uploadImage`, `event-images` 버킷 |
| 10 | 푸시 알림 (일정/버킷리스트/릴스/채팅) + 알림 탭 시 이동 | `007_push_token.sql`, `notifications.ts` |
| 11 | 서로 부르는 별칭 | `008_nicknames.sql`, `nickname-settings.tsx` |
| 12 | 테마 색상, 프로필 사진, 채팅 배경, 지역 즐겨찾기 | `useThemeStore`, `uploadAvatar`, `chat_bg_*`, `useFavoriteRegionsStore` (기록되지 않은 구현) |
| 13 | 홈 화면 D-day 위젯 (iOS/Android) | `targets/widget`, `widgets/`, `widgetSync.tsx`, dev client 도입 |
| 14 | 캐릭터 탭 숨김 | `href: null` — 이유 확인 필요 |
| 15 | 이 README 재작성 (기존 README 내용 포함) | 본 문서 |
| 16 | 앞으로 기능 추가/제거/변경 시 README도 같이 수정 | 작업 규칙으로 등록 (7번 컨벤션 참고) |
| 17 | `.gitignore` 보강 + 누락 컬럼 마이그레이션 | `.gitignore`에 `node_modules/`, `dist/`, `.env`, `.env*.local`, `.claude/settings.local.json` 추가 / `009_calendar_recurring_icon_idea.sql` 작성 |
| 18 | 기본 브랜치 정하기 → 첫 커밋 → 원격 연결 | `master` → `main`으로 변경, 첫 커밋 완료. GitHub CLI 설치·로그인 |
| 19 | 저장소를 public으로, 중요한 값은 올리지 않기 | Supabase URL/anon key를 `app.json` → `.env` + `app.config.js`로 이동, `.env.example` 추가. 푸시 전이라 첫 커밋을 고쳐 써서 git 이력에도 남지 않게 함 |

---

## 6. 주요 결정 사항 & 이유

- **Supabase 단독 백엔드**: 별도 서버 없이 Auth·DB·Realtime·Storage를 사용. 권한은 전부 RLS로 처리.
- **마이그레이션은 SQL Editor 수동 실행**: Supabase CLI 미사용. 파일에 "이미 실행했어도 안전" 같은 재실행 고려가 들어가 있음(`IF NOT EXISTS` 등).
- **인스타 링크 저장 구조 변경**: `instagram_url`(TEXT) → `instagram_urls`(TEXT[]) → `instagram_links`(JSONB `[{url, liked, memo?}]`). 링크별 하트 상태를 저장하기 위함. 수정 시 기존 링크의 하트 상태는 유지.
- **릴스는 embed 대신 원본 링크 + 모바일 UA WebView**: embed 위젯이 PC 카드처럼 보여서, 실제 모바일 인스타 화면이 나오도록 변경.
- **매년 반복 일정은 DB에 복제하지 않고 조회 시 가상 생성**: `is_recurring` 일정 전체를 가져와 클라이언트에서 해당 월로 매핑 (`date` 타입에 LIKE가 불안정하기 때문). 2/29 같은 무효 날짜는 제외.
- **메뉴 설정은 커플 공용(DB), 테마·지역 즐겨찾기·채팅 배경은 기기별(AsyncStorage)**.
- **별칭은 상대방이 붙여줌**: `nickname_for_user1`은 user2가 설정. 본인은 자기 별칭을 바꿀 수 없음.
- **푸시는 클라이언트에서 Expo Push API 직접 호출**: 서버/Edge Function 없이 구현. 실패해도 앱 동작에 영향 없도록 무시.
- **위젯은 날짜 원본만 저장하고 D-day 계산은 위젯 쪽에서**: OS 주기 갱신(Android 1시간)만으로 날짜가 바뀌어도 숫자가 맞게 됨.
- **Expo Go → development build 전환**: 위젯 네이티브 타깃 때문에 `expo-dev-client` 추가.
- **캐릭터 탭 숨김**: 이유 확인 필요.
- **누락 컬럼은 `IF NOT EXISTS` 마이그레이션으로 보충**: 운영 DB에는 이미 컬럼이 수동으로 추가돼 있을 가능성이 높아서, 새 DB와 기존 DB 모두에서 안전하게 실행되도록 함. 새 DB 기준 정의는 `is_recurring BOOLEAN NOT NULL DEFAULT FALSE`, `icon TEXT`, `date_idea_id UUID → date_ideas(id) ON DELETE SET NULL`(버킷리스트 삭제 시 일정은 남김).
- **기본 브랜치는 `main`**: GitHub 기본값과 맞추기 위함. 커밋이 없을 때 `master`에서 이름만 바꿈.
- **GitHub 저장소는 public, Supabase 설정 값은 env로 분리**: 사용자가 public을 원함. Supabase URL/anon key만 `.env`(로컬)·EAS 환경 변수(빌드)로 옮김. EAS projectId·Apple Team ID는 빌드된 앱에 어차피 들어가는 공개 식별자이고, env로 옮기면 EAS CLI가 프로젝트를 못 찾는 등 빌드 설정이 복잡해져서 `app.json`에 남김.
- **`.claude/settings.local.json`은 git에서 제외, `.claude/settings.json`은 커밋 대상**: 개인 권한 설정과 프로젝트 공용 설정을 분리.

---

## 7. 앞으로 참고할 내용

### 지켜야 할 규칙 / 컨벤션 (코드에서 관찰된 것)
- 사용자 지적 사항 기록은 이전 대화가 없어 확인 불가 → **확인 필요**. 아래는 현재 코드 스타일 기준.
- 세미콜론 없음, 작은따옴표, 2칸 들여쓰기
- 라우트 파일(`app/`)은 가능하면 `src/screens/`의 화면을 re-export만 함 (예외: `chat.tsx`, `profile.tsx`, 설정 화면들, `event/[id].tsx`)
- Supabase 호출은 `src/lib/api.ts`의 `xxxApi` 객체에만 모으고, 에러는 `throw` → 화면에서 `Alert.alert('오류', e.message)`
- 주석·UI 문구는 한국어, 해요체 문구 (`~했어요`, `~할까요?`)
- 색상은 `THEMES[themeKey]`, 폰트는 `FONT` / `FONT_HEADING` 상수 사용
- DB 변경 시 `supabase/migrations/NNN_설명.sql` 새 파일 추가 + 상단에 "Supabase SQL Editor에 붙여넣고 실행하세요" 주석, `src/types/index.ts` 타입도 같이 수정
- 키·토큰 등 민감 정보는 README·커밋 메시지에 쓰지 않기
- **기능을 추가·제거·변경하면 같은 작업에서 이 README도 수정** (기능 목록 상태, 구조, 실행 방법, 요청 히스토리, 결정 사항, 알려진 문제/다음 할 일/확인 필요) — 사용자 요청 사항

### 알려진 문제 / 제약 / 주의점
1. **운영 DB 컬럼 정의 불일치 가능성**: `009`는 이미 있는 컬럼을 건드리지 않으므로, 운영 DB에 수동으로 추가된 `is_recurring` / `icon` / `date_idea_id`의 타입·기본값·FK가 `009`와 다를 수 있음 (확인 필요). `009`를 운영 DB에 실행했는지도 확인 필요.
2. **Storage 버킷 설정이 코드/SQL에 없음**: `avatars`, `event-images` 버킷과 정책은 대시보드에서 수동 설정.
3. **줄바꿈(LF/CRLF)**: 이 PC는 `core.autocrlf=true`라서 `git add` 때 "LF will be replaced by CRLF" 경고가 나옴. 동작에는 문제 없음. 다른 OS에서도 작업한다면 `.gitattributes`로 통일하는 것을 고려.
4. **anon key는 저장소에서 빠졌어도 앱 안에는 들어 있음**: 배포된 앱을 분석하면 Supabase URL/anon key를 꺼낼 수 있음 (Supabase 구조상 정상). 실제 데이터 보호는 **RLS 정책**에 달려 있으므로 6번 RLS 허점을 먼저 막아야 함. `service_role` 키는 절대 앱·저장소에 넣지 말 것.
5. **타입 에러**: `npx tsc --noEmit` 실패 — `StyleSheet.absoluteFillObject` 미존재(RN 0.86 타입, `chat.tsx`, `event/[id].tsx`, `profile-edit.tsx`, `CalendarScreen.tsx`, `MapScreen.tsx`), `TextInput`의 `includeFontPadding` prop(`chat.tsx`), `MediaPlayerScreen.tsx`의 암시적 `any`.
6. **RLS 허점 (보안)**:
   - `couples_select`/`couples_update`가 `status = 'pending'`인 모든 커플을 누구나 조회·수정 가능
   - 별칭 "본인은 수정 불가" 규칙은 클라이언트에서만 지켜짐 (DB 정책상 커플 멤버는 두 컬럼 모두 수정 가능)
   - `media_insert`가 `added_by`만 확인하고 해당 일정이 내 커플 것인지 확인하지 않음
   - `messages_update_read`가 `read_at` 외 컬럼 수정도 막지 않음
   - 클라이언트가 상대 `push_token`으로 직접 푸시를 보내는 구조
7. **연동 끊기 후 재연결**: `separated` 상태가 되면 새 커플을 만들어야 함. 이전 기록 복구/재연결 흐름 없음.
8. **미사용 의존성/파일**: `expo-auth-session`, `expo-web-browser`(플러그인만 등록), `@expo-google-fonts/gaegu`, `expo-updates`(설정만), `assets/fonts/D2Coding-Regular.ttf`, `react-native-calendars`(import 없음). `dist/`(웹 export 결과물로 추정, 현재 git 제외).
9. **잘못 생성된 폴더**: 루트의 `{supabase/migrations,src}` 디렉터리 (중괄호 확장이 안 된 mkdir 흔적, 비어 있음) — 삭제해도 됨.
10. **진입 불가 화면**: `CharacterScreen`(탭 숨김), `MediaPlayerScreen`(라우트는 있으나 이동 코드 없음). 캐릭터 아이템 이미지(`items/*.png`)도 없음.
11. **`002b_messages_read_at.sql`**: 최신 `002`와 함께 실행하면 `messages_update_read` 정책이 중복되어 에러.
12. **원격 저장소**: GitHub `MinHyun-code/couple-app` (public) — 생성·푸시는 사용자 최종 확인 후 진행. GitHub CLI는 `C:\Program Files\GitHub CLI\gh.exe`에 설치됨 (기존에 열려 있던 터미널에서는 PATH에 없을 수 있음).
13. **폰트 재배포 라이선스**: 공개 저장소에 `assets/fonts/`의 폰트 파일(Pretendard, Jalnan2, D2Coding)이 그대로 올라감. Pretendard·D2Coding은 SIL OFL이라 재배포 가능, Jalnan2(여기어때 잘난체)는 폰트 파일 재배포 허용 여부 확인 필요.

### 다음에 할 일 (우선순위 순)
1. GitHub public 저장소 생성 후 `git push -u origin main`
1-1. EAS 클라우드 빌드 전에 `SUPABASE_URL`, `SUPABASE_ANON_KEY`를 EAS 환경 변수로 등록 (4-2 참고) — 안 하면 빌드된 앱이 Supabase에 연결되지 않음
2. 운영 DB에서 `009` 실행 여부와 기존 컬럼 정의 확인 (Supabase Table Editor에서 `calendar_events` 컬럼 확인)
3. Storage 버킷/정책을 SQL로 문서화
4. RLS 보강 (pending 커플 조회는 초대 코드 RPC로 대체, event_media insert 시 커플 확인 등)
5. `npx tsc --noEmit` 에러 정리 (`absoluteFillObject` → `absoluteFill` 등)
6. iOS/Android 위젯 실기기 동작 확인
7. 캐릭터·일정별 영상 공유 기능: 살릴지 제거할지 결정 후 정리, 미사용 패키지 제거
8. (선택) 푸시 전송을 Supabase Edge Function/DB 트리거로 이전, 설정 값을 `app.config.js` + env로 이전

### 확인 필요 항목
- 이전 세션에서의 실제 요청 내용·순서·사용자 지적 사항(코딩 규칙 등) — 기록 없음
- Jalnan2(여기어때 잘난체) 폰트 파일을 공개 저장소에 올려도 되는지 (라이선스)
- 운영 DB의 `is_recurring` / `icon` / `date_idea_id` 컬럼 정의가 `009`와 같은지, `009`를 실행했는지
- `avatars` / `event-images` 버킷의 public 여부와 업로드 정책
- 캐릭터 탭을 숨긴 이유와 향후 계획 (❌ 취소인지 ⏳ 보류인지)
- 일정별 유튜브/인스타 영상 공유(`MediaPlayerScreen`)를 버킷리스트 릴스로 대체한 것인지
- 소셜 로그인(`expo-auth-session`) 도입 예정 여부
- iOS/Android 위젯이 실제 기기에서 동작 확인됐는지
- 주 테스트 기기(아이폰/안드로이드)와 App Store / Play Store 배포 진행 상황
- `dist/` 폴더 용도 (웹 배포 여부)