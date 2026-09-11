# CLAUDE.md — 근육저축(운동 기록 앱) 작업 가이드

이 파일은 이 프로젝트를 이어서 개발하는 사람(또는 Claude)이 처음 읽는 문서다.
사용자 요청은 한국어로 오고, 답변도 한국어로 한다.
설치와 사용법은 `README.md`에 있다. 여기에는 **고칠 때 필요한 것**만 적는다.

## 1. 프로젝트 한눈에

- **무엇**: 부부 2명이 평생 쓰려고 만든 개인 운동 기록·대시보드. GitHub Pages(정적) + Supabase(Postgres + Auth).
- **누가 쓰나**: 황의영·박휘경 두 명뿐. **입력도 조회도 거의 100% 휴대폰/태블릿**이다. 헬스장에서 달리기를 끝낸 직후, 지친 상태에서 한 손으로 3초 안에 입력하는 것이 이 앱의 성패다.
  - **PC 화면 최적화에 시간을 쓰지 말 것.** 모바일 세로가 기준이고 PC는 그냥 넓게 보이면 된다.
  - **uv 프로젝트가 아니다.** 빌드 도구·번들러·npm 없음. 브라우저가 `js/*.js`를 ES 모듈로 직접 읽는다. 사용자가 회사 PC에서 github.dev로 파일 하나 고치고 커밋하면 그게 바로 배포다. **번들러를 도입하자는 제안을 하지 말 것** — 이 무빌드 구조가 이 앱의 유지보수성 그 자체다.
  - 사용자는 오피스 프로그램을 싫어한다. 설정을 엑셀·CSV 마스터로 빼지 말고 **`js/data.js` 코드로** 둔다.
- **실행**: 정적 파일이라 그냥 열면 된다. 로컬 확인은 `python -m http.server 8000` 후 `http://localhost:8000` (ES 모듈은 `file://`에서 CORS로 막힌다).
- **장기 유지 전제**: 수십 년 쓸 생각으로 만들었다. CDN 의존성은 전부 **버전 고정**이다(`@2.45.4`, `@4.4.4`, Pretendard `v1.3.9`). 함부로 `latest`로 바꾸면 몇 년 뒤 조용히 깨진다.

## 2. 디렉터리

```
index.html                 화면 뼈대 전부. 로그인 게이트 / 3개 screen / 시트 / 하단 탭
css/style.css              단일 스타일시트. CSS 변수 --accent 가 선택된 사람 색으로 바뀐다
js/
  config.js                Supabase URL·anon key. 사용자가 직접 채우는 유일한 비밀 파일
  data.js                  ★ 마스터. 사람·운동 종목·매뉴얼 링크·설정. 기능 추가는 대개 여기서 끝난다
  util.js                  날짜·시간 변환, el() DOM 헬퍼, toast. 계산은 전부 여기 모은다
  state.js                 화면끼리 공유하는 상태 4개 (personId, day, people, email)
  db.js                    Supabase 호출 전담. 화면 코드는 sb 객체를 직접 만지지 않는다
  log.js                   기록 화면 + 입력 시트
  dash.js                  대시보드 3개 뷰(recent/period/best) + Chart.js
  manual.js                매뉴얼 탭. data.js 를 그리기만 한다
  app.js                   부팅·로그인·탭 전환. 화면 로직 없음
supabase/01_schema.sql     테이블·인덱스·RLS. 두 번 돌려도 안전
tools/migrate_gform.py     구글 설문 TSV -> 적재용 CSV. 1회성이지만 재현용으로 남긴다
tools/test_util.mjs        util.js 회귀 테스트. node 로 바로 돈다
data/*.csv                 위 스크립트 산출물(이관 완료분). git 에 넣어 둔다
archive/                   원본 구글 설문 TSV. 손대지 않는다
```

## 3. 핵심 설계 결정 (바꾸기 전에 이유를 확인할 것)

| 결정 | 이유 |
|---|---|
| `workout_logs.exercise` 는 FK 가 아니라 그냥 **text** | 사용자 요구 1순위가 "새 운동 종목을 내가 직접 추가"였다. FK로 묶으면 종목 추가마다 SQL을 돌려야 한다. text 로 두면 `data.js`에 한 줄 넣는 것으로 끝난다. 무결성을 잃는 대신 얻은 것이 이것이다. **되돌리지 말 것** |
| wide(종목=컬럼) 가 아니라 **long(1행=1세션)** | 구글 설문이 wide 여서 "종목 하나만 입력하려는데 전 컬럼을 지나가야" 하는 문제가 있었다. long 이면 한 종목만 넣는 것이 자연스럽고, 같은 날 2회 운동(원본에 실제로 20여 건 있다)도 그냥 2행이다 |
| 시간은 **항상 초(integer)** 로 저장 | 원본은 `47.6분` 같은 소수 인코딩이었다(0.6 = 37~42초). 소수는 합·평균이 미묘하게 틀리고 사람이 매번 변환표를 봐야 했다. 초로 통일하고 입력은 분/초 두 칸으로 받는다. **변환표 UI를 다시 만들지 말 것** — 그걸 없애는 게 이번 개편의 목적이었다 |
| 대시보드 집계를 **서버(뷰·RPC)가 아니라 브라우저**에서 | 4년 치가 1,873행이다. 평생 모아도 2만 행 수준이라 통째로 받아 계산하는 게 빠르고, SQL 뷰가 늘면 종목 추가 때 또 DB를 손대야 한다(위 결정과 충돌) |
| RLS 는 "로그인했으면 전부 허용" 한 줄 | 부부 둘만 쓰고 서로 기록을 보고 대신 입력하는 것도 원한다. 사람별 격리 정책은 요구사항이 아니라 오히려 방해다. 방어선은 **로그인** 하나 |
| 프레임워크·번들러 없음 | 회사 PC에서 github.dev로 파일 하나 고쳐 커밋하는 것이 유일한 배포 경로다. 빌드 단계가 생기는 순간 이 경로가 죽는다 |
| Chart.js (Plotly·D3 아님) | 모바일에서 탭 툴팁이 기본 동작하고 UMD/ESM 단일 파일이다. 태블로 수준 인터랙션은 처음부터 포기했다 |
| `daily_notes` 를 세션과 분리 | 몸무게·"오늘 쉼" 은 세션이 0건인 날에도 있어야 한다. `(person_id, logged_on)` 유니크 + upsert |
| 과거 데이터의 `팔`→`pushup`, `수영`→`swim_free` | 사용자 지시. 풀업·배영·평영은 새 코드로 분리했고 과거 기록은 없다 |
| PWA·오프라인 캐시 안 넣음 | 헬스장 와이파이/LTE 로 충분하고, service worker 캐시는 "고쳤는데 안 바뀐다" 사고의 단골이다. 요청받기 전엔 넣지 말 것 |

## 4. 코드 관례

### DOM 은 문자열 HTML 이 아니라 `el()` 로 만든다

```js
import { el } from './util.js';

el('div', { class: 'row', onclick: () => openSheet(code) }, [
  el('b', { text: name }),          // text: 는 textContent. innerHTML 쓰지 않는다
  cond ? el('span', { text: memo }) : null,   // null 은 알아서 걸러진다
]);
```

`innerHTML +=` 로 화면을 만들지 말 것. 이벤트가 날아가고 사용자 메모에 `<` 가 들어가면 깨진다.

### 시간·날짜 계산은 반드시 `util.js` 를 거친다

```js
toSec(47, 37)        // 2857
splitSec(2857)       // { min: 47, sec: 37 }
fmtSec(2857)         // '47분 37초'   화면용
fmtClock(2857)       // '47:37'       표·축용
ymd()                // 오늘 'YYYY-MM-DD' — 로컬 기준
```

`new Date().toISOString().slice(0,10)` 을 쓰면 **KST 오전 9시 전에 하루가 밀린다**. 밤 운동 앱이라 치명적이다. 반드시 `ymd()`.

### Supabase 호출은 `db.js` 에만

```js
export async function loadDayLogs(personId, day) {
  return ok(await sb.from('workout_logs').select('*')
    .eq('person_id', personId).eq('logged_on', day).order('id'));
}
```

`ok()` 가 error 를 throw 로 바꾼다. 화면 쪽에서 `try/catch` 하고 `toast(e.message, 'err')` 로 띄운다. db.js 안에서 에러를 삼키지 않는다.

### 화면 갱신은 `render*()` 전체 다시 그리기

부분 갱신·상태 바인딩 없다. 저장 후엔 `await renderLog()` 로 통째로 다시 그린다. 데이터가 작아서 이게 제일 안전하다.

## 5. 기능 추가 절차

1. **`js/data.js` 로 되는 일인지 먼저 본다.** 새 운동 종목·매뉴얼 링크·목표치·기간 설정은 여기 한 줄이면 끝이고 DB·다른 파일을 건드리면 안 된다.
2. 새 입력 단위(예: 무게 kg, 세트 수)가 필요하면 → ① `01_schema.sql` 에 컬럼 추가(`alter table ... add column if not exists`) ② `data.js` 의 `fields` 에 키 추가 ③ `log.js` 의 `fieldBlock()` 에 분기 추가 ④ `dash.js` 의 `METRICS` 에 추출 함수 추가. **네 군데가 세트다. 하나 빠지면 조용히 안 보인다.**
3. 대시보드 뷰 추가는 `dash.js` 에 `viewXxx(body)` 를 만들고 `renderDash()` 분기 + `index.html` 의 `#dashSeg` 에 버튼 하나.
4. 로컬에서 `python -m http.server` 로 띄워 모바일 폭(390px)으로 확인한다.
5. **`CHANGELOG.md` 와 이 문서를 갱신한다.**

## 6. 테스트

```bash
node tools/test_util.mjs                                          # 순수 함수 20건. 의존성 없음
node --check js/dash.js                                           # 문법만 볼 때
python -m http.server 8000                                        # 브라우저 확인 (file:// 는 안 됨)
python tools/migrate_gform.py archive/구글설문_220611-260904.tsv   # 이관 재현
```

`test_util.mjs` 가 지키는 것은 두 가지다. **① 날짜가 KST 에서 하루 밀리지 않는가**(`toISOString` 을 쓰면 오전 9시 전에 밀린다 — 밤 운동 앱이라 치명적) **② 분·초 ↔ 초 변환이 왕복하는가.** `util.js` 를 고쳤으면 반드시 돌린다.

이관 스크립트는 몇 번을 돌려도 같은 CSV 를 낸다. 기대값: 세션 1,873행 / 하루단위 335행 / 휴식 165일.

화면은 자동 테스트가 없다. 손으로 볼 목록: ① 밤 11시대에 날짜가 오늘로 뜨는가 ② 같은 종목 두 번 저장 시 2행이 되는가 ③ 사람 전환 시 강조색과 데이터가 같이 바뀌는가 ④ 시트에서 빈 값 저장 시 막히는가 ⑤ 대시보드 3탭에 `null` 글자가 안 보이는가.

## 7. 알려진 함정

- **`file://` 로 열면 안 뜬다.** ES 모듈 CORS 때문이다. 반드시 http 서버나 GitHub Pages 로 연다.
- **Supabase 무료 프로젝트는 1주 미사용 시 일시정지**된다. 매일 쓰면 문제없지만, 장기 여행 후 첫 접속에서 로그인이 실패하면 대시보드에서 Restore 를 눌러야 한다. 앱 버그로 오해하지 말 것.
- **무료 플랜 프로젝트는 계정당 2개까지.** 사용자는 이미 다른 앱에 하나 쓰고 있어 이 앱이 두 번째다. 세 번째가 필요해지면 기존 프로젝트에 스키마를 얹는 쪽을 먼저 검토한다.
- **`data.js` 의 `PEOPLE[].id` 와 DB `people.id` 가 어긋나면** 기록이 엉뚱한 사람에게 붙는다. 사람을 추가할 때는 SQL insert 와 `data.js` 를 반드시 같이 고친다(자녀 추가 요청이 언젠가 온다).
- **운동 `code` 를 나중에 바꾸면 과거 기록이 갈라진다.** 이름(`name`)만 바꾸는 것은 안전하다. code 는 영구 키다.
- 과거 수영·달리기 시간은 소수 분 인코딩을 초로 되돌린 값이라 **±5초 오차**가 있다. 최고기록 표시가 1~2초 어긋나 보여도 버그가 아니다.
- `daily_notes` upsert 는 `onConflict: 'person_id,logged_on'` 문자열이 유니크 제약과 정확히 같아야 한다. 스키마를 고칠 때 같이 본다.
- **`el()` 로 만든 버튼은 `addEventListener` 를 쓴다.** `btn.onclick()` 으로 부르면 undefined 다(`app.js`·`log.js` 의 고정 버튼만 `.onclick =` 대입식). 테스트나 코드에서 프로그램적으로 누를 때는 `.click()` 을 쓴다.
- **`replaceChildren(null)` 은 화면에 `null` 이라는 글자를 찍는다.** 조건부 자식이 하나라도 있으면 `util.js` 의 `mount()` 를 쓴다. 첫 버전에서 실제로 밟은 함정이다.
- **Chart.js 는 `maintainAspectRatio:false` 일 때 높이가 정해진 부모를 요구한다.** canvas 에 직접 높이를 주면 라이브러리가 덮어써서 0px 로 무너진다. `chartBox()` 의 `.canvas-wrap` 래퍼를 없애지 말 것.
- 구글 설문 원본에는 같은 날짜 행이 23건 있었다(2회 운동 또는 빈 중복 행). 이관 스크립트가 비고를 ` / ` 로 이어 붙여 살렸다. 다시 이관할 일이 생기면 이 동작을 유지할 것.

## 8. 앞으로 넣을 만한 것

- 종목별 목표 대비 진행률(월 목표 6,000개 중 3,200개) — `data.js` 의 `goal` 을 월 단위로 확장하면 된다.
- 주간 요약을 카카오톡으로 공유할 이미지 만들기(canvas 캡처).
- 자녀 2명 추가 — 성인이 되면. `people` insert + `data.js` 두 줄.
- 수영 페이스(100m당 시간) 최고기록. `laps × 50m` 로 이미 계산 가능하다.
- 기록 없는 날 알림 — 정적 사이트라 푸시는 불가. 하려면 별도 워커가 필요하다(무거움).
