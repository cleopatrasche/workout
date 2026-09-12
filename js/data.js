// =============================================================
//  이 파일이 앱의 '마스터 파일'이다. 여기만 고치면 앱이 바뀐다.
//  DB 손댈 필요 없음. 커밋하면 1~2분 뒤 GitHub Pages에 반영된다.
// =============================================================

// ── 1. 사람 ────────────────────────────────────────────────────
// id 는 Supabase people 테이블의 id 와 반드시 같아야 한다.
export const PEOPLE = [
  { id: 1, code: 'HEY', name: '황의영', color: '#45B3E0' },
  { id: 2, code: 'KIG', name: '박휘경', color: '#F2B441' },
];

// ── 2. 운동 종목 ───────────────────────────────────────────────
//
//  새 종목 추가법: 아래 배열에 한 줄 붙이고 저장하면 끝.
//
//    { code: 'plank', name: '플랭크', group: '맨몸', fields: ['time'] },
//
//  code    : 영문 소문자. DB에 이 문자열이 그대로 들어간다. 한 번 정하면 바꾸지 말 것
//            (바꾸면 과거 기록이 다른 종목으로 갈라진다).
//  group   : 대시보드 도넛차트에서 묶이는 단위.
//  fields  : 입력 화면에 뜨는 칸. 아래 4가지만 쓴다.
//              'reps'     개수     -> reps
//              'time'     분·초    -> duration_sec (초로 저장)
//              'distance' 거리 km  -> distance_km
//              'laps'     왕복     -> laps (편도는 0.5)
//  active  : false 로 두면 입력 화면 타일에서 숨는다. 과거 기록과 대시보드는 그대로 남는다.
//  goal    : (선택) 하루 목표치. 입력 화면 타일에 옅게 표시된다.

export const EXERCISES = [
  { code: 'pushup',    name: '푸쉬업',   group: '맨몸',   icon: '💪', fields: ['reps'],               goal: 400 },
  { code: 'pullup',    name: '풀업',     group: '맨몸',   icon: '🧗', fields: ['reps'],               goal: 100  },
  { code: 'core',      name: '복부',     group: '맨몸',   icon: '🔥', fields: ['reps'],               goal: 400 },
  { code: 'leg',       name: '하체',     group: '맨몸',   icon: '🦵', fields: ['reps'],               goal: 1000 },
  { code: 'run',       name: '달리기',   group: '유산소', icon: '🏃', fields: ['time', 'distance'] },
  { code: 'swim_free', name: '자유형',   group: '수영',   icon: '🏊', fields: ['time', 'laps'] },
  { code: 'swim_back', name: '배영',     group: '수영',   icon: '🌊', fields: ['time', 'laps'], active: false },
  { code: 'swim_breast', name: '평영',   group: '수영',   icon: '🐸', fields: ['time', 'laps'], active: false },
  { code: 'cycling',   name: '사이클',   group: '유산소', icon: '🚲', fields: ['time', 'distance'] },
  { code: 'badminton', name: '배드민턴', group: '기타',   icon: '🏸', fields: ['time'] },
  { code: 'hiking',    name: '등산',     group: '기타',   icon: '⛰️', fields: ['time', 'distance'] },
  { code: 'plank',     name: '플랭크',   group: '맨몸',   icon: '🧘', fields: ['reps'] },
  { code: 'etc',       name: '기타',     group: '기타',   icon: '➕', fields: ['time'] },
];

// ── 3. 운동 매뉴얼 링크 ─────────────────────────────────────────
//  카테고리째로 추가·삭제 자유. 순서대로 매뉴얼 탭에 뜬다.
export const MANUALS = [
  {
    category: '맨몸운동',
    links: [
      { title: 'push-up 챌린지',            url: 'https://www.instagram.com/reel/DCOz2qCPb_K/' },
      { title: '전신 터는 법',              url: 'https://www.instagram.com/reel/DF94j48xk6b/' },
      { title: 'One Rep Push Up Challenge', url: 'https://www.instagram.com/reel/DDzVOiJtIua/' },
      { title: '권상우 전신 운동 루틴',      url: 'https://www.instagram.com/reel/DFko729zej2/' },
    ],
  },
  {
    category: '수영',
    links: [
      { title: '수영 코치들의 다양한 수영 비유', url: 'https://www.instagram.com/p/DGeuRGxvgFQ/' },
      { title: '자유형 발차기',                 url: 'https://www.instagram.com/reel/C-204t6SG1z/' },
      { title: '자유형 시선처리',               url: 'https://www.instagram.com/reel/DA2kXDByeO8/' },
      { title: '자유형 스피드',                 url: 'https://www.instagram.com/reel/DDwwX53RV1J/' },
    ],
  },
];

// ── 4. 잡다한 설정 ─────────────────────────────────────────────
export const SETTINGS = {
  recentDays: 14,        // '최근' 탭 꺾은선 그래프에 보여줄 일수 (모바일은 14가 한계)
  bestWindowDays: 90,    // '최고' 탭의 단기 최고기록 기준 기간
  poolLengthM: 25,       // 수영장 길이. 왕복 1회 = 50m 계산에 쓴다
};

// ── 파생값 (건드릴 필요 없음) ──────────────────────────────────
export const EX_BY_CODE = Object.fromEntries(EXERCISES.map((e) => [e.code, e]));
export const PERSON_BY_ID = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
export const exName = (code) => EX_BY_CODE[code]?.name ?? code;
export const exGroup = (code) => EX_BY_CODE[code]?.group ?? '기타';
