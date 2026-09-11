// 날짜·시간·숫자 변환. 화면 코드에서 절대 직접 계산하지 말고 여기 함수를 쓴다.

// ── 날짜 ────────────────────────────────────────────────────────
/** Date -> 'YYYY-MM-DD' (로컬 시간 기준. toISOString 쓰면 KST에서 하루 밀린다) */
export function ymd(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 'YYYY-MM-DD' -> Date (로컬 자정) */
export function parseYmd(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s, n) {
  const d = parseYmd(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function daysBetween(a, b) {
  return Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

export function labelDate(s) {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
}

export function labelShort(s) {
  const d = parseYmd(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** [from, to] 사이의 모든 날짜 문자열 */
export function dateRange(from, to) {
  const out = [];
  for (let s = from; s <= to; s = addDays(s, 1)) out.push(s);
  return out;
}

// ── 시간 ────────────────────────────────────────────────────────
export const toSec = (min, sec) => (Number(min) || 0) * 60 + (Number(sec) || 0);

export const splitSec = (total) => ({
  min: Math.floor((total || 0) / 60),
  sec: (total || 0) % 60,
});

/** 2857 -> '47분 37초' / 3600 -> '60분' */
export function fmtSec(total) {
  if (total == null) return '';
  const { min, sec } = splitSec(total);
  return sec ? `${min}분 ${sec}초` : `${min}분`;
}

/** 누적 합계용. 2시간을 넘으면 '417시간 13분' 으로 접는다.
    (4년 치 달리기 합계를 '25013분' 이라고 쓰면 아무도 못 읽는다) */
export function fmtDur(total) {
  if (total == null) return '';
  if (total < 7200) return fmtSec(total);
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return m ? `${h.toLocaleString('ko-KR')}시간 ${m}분` : `${h.toLocaleString('ko-KR')}시간`;
}

/** 2857 -> '47:37' (그래프 축·표에서 자리 절약용) */
export function fmtClock(total) {
  if (total == null) return '';
  const { min, sec } = splitSec(total);
  return `${min}:${String(sec).padStart(2, '0')}`;
}

// ── 숫자 ────────────────────────────────────────────────────────
export const round1 = (n) => Math.round(n * 10) / 10;

export function fmtNum(n) {
  if (n == null || Number.isNaN(n)) return '–';
  return Number.isInteger(n) ? n.toLocaleString('ko-KR') : round1(n).toLocaleString('ko-KR');
}

/** 종목 한 세션을 사람이 읽는 한 줄로. 예: '달리기 47분 37초 · 6.2km' */
export function describe(row, name) {
  const parts = [];
  if (row.reps != null) parts.push(`${fmtNum(row.reps)}개`);
  if (row.duration_sec != null) parts.push(fmtSec(row.duration_sec));
  if (row.distance_km != null) parts.push(`${fmtNum(row.distance_km)}km`);
  if (row.laps != null) parts.push(`${fmtNum(row.laps)}회`);
  return `${name} ${parts.join(' · ')}`.trim();
}

// ── DOM ─────────────────────────────────────────────────────────
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** replaceChildren 은 null 을 'null' 텍스트로 넣어 버린다. 항상 이걸 쓴다. */
export function mount(node, ...children) {
  node.replaceChildren(...children.flat(Infinity).filter((c) => c != null));
}

export function toast(msg, tone = 'ok') {
  const box = $('#toast');
  box.textContent = msg;
  box.dataset.tone = tone;
  box.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => box.classList.remove('is-on'), 2200);
}
