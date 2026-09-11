// 순수 함수 회귀 테스트. 의존성 없다.
//   node tools/test_util.mjs
// util.js 를 고쳤으면 반드시 한 번 돌린다. 여기서 깨지면 날짜·시간이 전부 어긋난다.

import {
  ymd, addDays, daysBetween, labelShort,
  toSec, splitSec, fmtSec, fmtDur, fmtClock, describe, round1,
} from '../js/util.js';

let bad = 0;
const eq = (name, got, want) => {
  const okay = JSON.stringify(got) === JSON.stringify(want);
  if (!okay) bad += 1;
  console.log(`${okay ? 'ok  ' : 'FAIL'} ${name}${okay ? '' : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

// 시간 — 구글 설문의 소수 인코딩을 걷어낸 자리라 여기가 제일 중요하다
eq('toSec 47분37초', toSec(47, 37), 2857);
eq('toSec 빈칸', toSec(null, 30), 30);
eq('splitSec', splitSec(2857), { min: 47, sec: 37 });
eq('fmtSec', fmtSec(2857), '47분 37초');
eq('fmtSec 정각', fmtSec(3600), '60분');
eq('fmtClock', fmtClock(2857), '47:37');
eq('fmtClock 초 패딩', fmtClock(305), '5:05');
eq('fmtDur 2시간 미만은 분', fmtDur(5400), '90분');
eq('fmtDur 누적', fmtDur(1500803), '416시간 53분');
eq('fmtDur 정시', fmtDur(7200), '2시간');

// 날짜 — toISOString 을 쓰면 KST 에서 하루가 밀린다. 밤 운동 앱이라 치명적
eq('ymd 밤 11시', ymd(new Date(2026, 8, 10, 23, 59)), '2026-09-10');
eq('ymd 새벽 1시', ymd(new Date(2026, 8, 11, 1, 0)), '2026-09-11');
eq('addDays 월말', addDays('2026-02-28', 1), '2026-03-01');
eq('addDays 윤년', addDays('2024-02-28', 1), '2024-02-29');
eq('addDays 역방향', addDays('2026-01-01', -1), '2025-12-31');
eq('daysBetween', daysBetween('2026-01-01', '2026-03-01'), 59);
eq('labelShort', labelShort('2026-09-04'), '9/4');

// 표시
eq('round1', round1(4.26), 4.3);
eq('describe 달리기',
   describe({ reps: null, duration_sec: 2857, distance_km: 6.2, laps: null }, '달리기'),
   '달리기 47분 37초 · 6.2km');
eq('describe 푸쉬업',
   describe({ reps: 410, duration_sec: null, distance_km: null, laps: null }, '푸쉬업'),
   '푸쉬업 410개');

console.log(bad ? `\n실패 ${bad}건` : '\n전부 통과');
process.exit(bad ? 1 : 0);
