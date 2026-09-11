// 대시보드. 서버 집계 없이, 기간 원본을 한 번 받아 브라우저에서 계산한다.
// 4년 치가 2천 행 남짓이라 이 방식이 훨씬 단순하고 충분히 빠르다.
import Chart from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/auto/+esm';
import { EXERCISES, EX_BY_CODE, SETTINGS, PEOPLE } from './data.js';
import * as db from './db.js';
import { state, person } from './state.js';
import {
  $, el, mount, ymd, addDays, daysBetween, labelShort, fmtNum, fmtSec, fmtDur, fmtClock, round1,
} from './util.js';

Chart.defaults.color = '#8B99AB';
Chart.defaults.font.family = "'Pretendard Variable', Pretendard, system-ui, sans-serif";
Chart.defaults.font.size = 11;
Chart.defaults.animation = { duration: 220 };

const METRICS = {
  reps:     { unit: '개',  get: (r) => r.reps ?? 0 },
  time:     { unit: '분',  get: (r) => (r.duration_sec ?? 0) / 60 },
  distance: { unit: 'km',  get: (r) => Number(r.distance_km ?? 0) },
  laps:     { unit: '회',  get: (r) => Number(r.laps ?? 0) },
};

const PERIODS = [
  { key: '30',   label: '30일',   days: 30 },
  { key: '90',   label: '90일',   days: 90 },
  { key: '180',  label: '6개월',  days: 180 },
  { key: '365',  label: '1년',    days: 365 },
  { key: 'ytd',  label: '올해',   days: null },
  { key: 'all',  label: '전체',   days: null },
];

let view = 'recent';
let chipCode = 'pushup';
let periodKey = '30';
let charts = [];
let cache = null;   // { from, to, logs, notes }

// ── 데이터 ──────────────────────────────────────────────────────
export function invalidate() { cache = null; }

async function fetchRange(from, to) {
  if (cache && cache.from <= from && cache.to >= to) return cache;
  const [logs, notes] = await Promise.all([db.loadLogs(from, to), db.loadNotes(from, to)]);
  cache = { from, to, logs, notes };
  return cache;
}

const mine = (rows) => rows.filter((r) => r.person_id === state.personId);

function periodBounds() {
  const today = ymd();
  const p = PERIODS.find((x) => x.key === periodKey);
  if (p.key === 'ytd') return [`${new Date().getFullYear()}-01-01`, today];
  if (p.key === 'all') return ['2022-01-01', today];
  return [addDays(today, -(p.days - 1)), today];
}

// ── 진입점 ──────────────────────────────────────────────────────
export function bindDash() {
  for (const b of $('#dashSeg').children) {
    b.onclick = () => { view = b.dataset.view; renderDash(); };
  }
}

export async function renderDash() {
  for (const b of $('#dashSeg').children) {
    b.setAttribute('aria-pressed', String(b.dataset.view === view));
  }
  charts.forEach((c) => c.destroy());
  charts = [];
  const body = $('#dashBody');
  mount(body, el('p', { class: 'empty', text: '집계하는 중…' }));

  try {
    if (view === 'recent') await viewRecent(body);
    else if (view === 'period') await viewPeriod(body);
    else await viewBest(body);
  } catch (e) {
    mount(body, el('p', { class: 'empty', text: `불러오지 못했다: ${e.message}` }));
  }
}

// ── 공통 조각 ───────────────────────────────────────────────────
const statCard = (value, unit, label) =>
  el('div', { class: 'stat' }, [
    el('b', { class: 'num' }, [String(value), unit ? el('small', { text: unit }) : null]),
    el('span', { text: label }),
  ]);

/** Chart.js 는 maintainAspectRatio:false 일 때 '높이가 정해진 부모'를 요구한다.
    canvas 에 높이를 주면 라이브러리가 덮어써서 0px 로 무너진다. 반드시 래퍼로 감싼다. */
function chartBox(build, height = 200) {
  const canvas = el('canvas');
  const box = el('div', { class: 'chartbox' }, [
    el('div', { class: 'canvas-wrap', style: `height:${height}px` }, [canvas]),
  ]);
  queueMicrotask(() => charts.push(build(canvas)));
  return box;
}

/** 날짜별 집계: {['2026-09-01']: 값} */
function byDay(rows, code, metric) {
  const out = {};
  for (const r of rows) {
    if (r.exercise !== code) continue;
    out[r.logged_on] = (out[r.logged_on] ?? 0) + METRICS[metric].get(r);
  }
  return out;
}

const activeDays = (rows) => new Set(rows.map((r) => r.logged_on));

function streak(rows) {
  const days = activeDays(rows);
  let cursor = ymd();
  if (!days.has(cursor)) cursor = addDays(cursor, -1);   // 오늘은 아직 안 했을 수 있다
  let n = 0;
  while (days.has(cursor)) { n += 1; cursor = addDays(cursor, -1); }
  return n;
}

// ── 1) 최근 ─────────────────────────────────────────────────────
async function viewRecent(body) {
  const days = SETTINGS.recentDays;
  const from = addDays(ymd(), -(days - 1));
  const { logs } = await fetchRange(addDays(ymd(), -365), ymd());
  const my = mine(logs);
  const recent = my.filter((r) => r.logged_on >= from);

  const last7 = activeDays(my.filter((r) => r.logged_on >= addDays(ymd(), -6))).size;
  const month = ymd().slice(0, 7);
  const thisMonth = activeDays(my.filter((r) => r.logged_on.startsWith(month))).size;

  const codes = [...new Set(my.filter((r) => r.logged_on >= addDays(ymd(), -90))
    .map((r) => r.exercise))];
  if (!codes.includes(chipCode)) chipCode = codes[0] ?? 'pushup';

  const ex = EX_BY_CODE[chipCode] ?? { name: chipCode, fields: ['reps'] };
  const labels = [];
  for (let i = days - 1; i >= 0; i -= 1) labels.push(addDays(ymd(), -i));

  const datasets = ex.fields.slice(0, 2).map((f, i) => {
    const map = byDay(recent, chipCode, f);
    return {
      label: METRICS[f].unit,
      data: labels.map((d) => round1(map[d] ?? 0)),
      yAxisID: i === 0 ? 'y' : 'y2',
      borderColor: i === 0 ? person().color : '#8B99AB',
      backgroundColor: i === 0 ? person().color : '#8B99AB',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      tension: 0.25,
      spanGaps: true,
    };
  });

  mount(body,
    el('div', { class: 'stats' }, [
      statCard(last7, '일', '최근 7일 운동'),
      statCard(streak(my), '일', '연속 기록'),
      statCard(thisMonth, '일', '이번 달 운동'),
    ]),
    el('div', { class: 'chips' }, codes.map((c) =>
      el('button', {
        text: EX_BY_CODE[c]?.name ?? c,
        'aria-pressed': String(c === chipCode),
        onclick: () => { chipCode = c; renderDash(); },
      }))),
    chartBox((cv) => new Chart(cv, {
      type: 'line',
      data: { labels: labels.map(labelShort), datasets },
      options: {
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: datasets.length > 1, labels: { boxWidth: 10, boxHeight: 10 } },
          title: { display: true, text: `${ex.name} · 최근 ${days}일`, color: '#E9EEF5',
                   font: { size: 13, weight: '700' }, padding: { bottom: 8 } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
          y: { beginAtZero: true, grid: { color: '#2E3A48' }, position: 'left' },
          y2: { display: datasets.length > 1, beginAtZero: true,
                grid: { display: false }, position: 'right' },
        },
      },
    })),
    recentTable(recent),
    compareRow(logs),
  );
}

function recentTable(rows) {
  const codes = [...new Set(rows.map((r) => r.exercise))];
  if (!codes.length) return el('p', { class: 'empty', text: '최근 기록이 없다.' });
  return el('table', { class: 'grid' }, [
    el('thead', {}, el('tr', {}, [
      el('th', { text: '종목' }), el('th', { text: '일수' }), el('th', { text: '합계' }),
    ])),
    el('tbody', {}, codes.map((c) => {
      const sub = rows.filter((r) => r.exercise === c);
      const ex = EX_BY_CODE[c] ?? { name: c, fields: ['reps'] };
      const f = ex.fields[0];
      const total = sub.reduce((s, r) => s + METRICS[f].get(r), 0);
      const text = f === 'time' ? fmtDur(sub.reduce((s, r) => s + (r.duration_sec || 0), 0))
                                : `${fmtNum(round1(total))}${METRICS[f].unit}`;
      return el('tr', {}, [
        el('td', { text: ex.name }),
        el('td', { class: 'v', text: String(activeDays(sub).size) }),
        el('td', { class: 'v', text }),
      ]);
    })),
  ]);
}

/** 두 사람 최근 30일 운동일수 한 줄 비교 */
function compareRow(allLogs) {
  const from = addDays(ymd(), -29);
  return el('div', { class: 'block' }, [
    el('h3', { text: '최근 30일 운동일수' }),
    el('table', { class: 'grid' }, el('tbody', {}, PEOPLE.map((p) => {
      const n = activeDays(allLogs.filter((r) => r.person_id === p.id && r.logged_on >= from)).size;
      return el('tr', {}, [
        el('td', { text: p.name }),
        el('td', { class: 'v', text: `${n}일` }),
        el('td', { class: 'sub', text: `${Math.round((n / 30) * 100)}%` }),
      ]);
    }))),
  ]);
}

// ── 2) 기간 ─────────────────────────────────────────────────────
async function viewPeriod(body) {
  const [from, to] = periodBounds();
  const { logs, notes } = await fetchRange(from, to);
  const my = mine(logs).filter((r) => r.logged_on >= from);
  const span = daysBetween(from, to) + 1;
  const done = activeDays(my).size;

  const codes = [...new Set(my.map((r) => r.exercise))];
  const counts = codes.map((c) => activeDays(my.filter((r) => r.exercise === c)).size);

  const weights = mine(notes)
    .filter((n) => n.logged_on >= from && n.weight_kg != null)
    .map((n) => ({ d: n.logged_on, w: Number(n.weight_kg) }));

  mount(body,
    el('div', { class: 'period' }, PERIODS.map((p) =>
      el('button', {
        text: p.label, 'aria-pressed': String(p.key === periodKey),
        onclick: () => { periodKey = p.key; renderDash(); },
      }))),
    el('div', { class: 'stats' }, [
      statCard(done, '일', '운동한 날'),
      statCard(`${Math.round((done / span) * 100)}`, '%', `${span}일 중 실행률`),
      statCard(my.length, '건', '세션 수'),
    ]),
    codes.length ? chartBox((cv) => new Chart(cv, {
      type: 'doughnut',
      data: {
        labels: codes.map((c) => EX_BY_CODE[c]?.name ?? c),
        datasets: [{
          data: counts,
          backgroundColor: ['#45B3E0', '#F2B441', '#5BD6A0', '#FF7A66', '#A78BFA',
                            '#4ADE80', '#F472B6', '#38BDF8', '#FBBF24', '#94A3B8'],
          borderColor: '#1B232D', borderWidth: 2,
        }],
      },
      options: {
        maintainAspectRatio: false, cutout: '58%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, padding: 8 } },
          title: { display: true, text: '종목별 운동일수 비중', color: '#E9EEF5',
                   font: { size: 13, weight: '700' }, padding: { bottom: 6 } },
        },
      },
    }), 230) : el('p', { class: 'empty', text: '이 기간에는 기록이 없다.' }),
    periodTable(my, codes),
    weights.length > 1 ? el('div', { class: 'block' }, [
      el('h3', { text: '몸무게' }),
      chartBox((cv) => new Chart(cv, {
        type: 'line',
        data: {
          labels: weights.map((x) => labelShort(x.d)),
          datasets: [{
            data: weights.map((x) => x.w), borderColor: person().color,
            backgroundColor: person().color, borderWidth: 2, pointRadius: 2, tension: 0.3,
          }],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { grid: { display: false }, ticks: { maxRotation: 0 } },
                    y: { grid: { color: '#2E3A48' } } },
        },
      }), 170),
    ]) : null,
  );
}

function periodTable(rows, codes) {
  if (!codes.length) return null;
  return el('div', { class: 'block' }, [
    el('h3', { text: '종목별 합계' }),
    el('table', { class: 'grid' }, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: '종목' }), el('th', { text: '일수' }),
        el('th', { text: '합계' }), el('th', { text: '1회 평균' }),
      ])),
      el('tbody', {}, codes.map((c) => {
        const sub = rows.filter((r) => r.exercise === c);
        const ex = EX_BY_CODE[c] ?? { name: c, fields: ['reps'] };
        const f = ex.fields[0];
        const total = sub.reduce((s, r) => s + METRICS[f].get(r), 0);
        const avg = total / sub.length;
        const fmt = (v, long) => (f === 'time'
          ? (long ? fmtDur : fmtSec)(Math.round(v * 60))
          : `${fmtNum(round1(v))}${METRICS[f].unit}`);
        return el('tr', {}, [
          el('td', { text: ex.name }),
          el('td', { class: 'v', text: String(activeDays(sub).size) }),
          el('td', { class: 'v', text: fmt(total, true) }),
          el('td', { class: 'sub', text: fmt(avg, false) }),
        ]);
      })),
    ]),
  ]);
}

// ── 3) 최고 ─────────────────────────────────────────────────────
async function viewBest(body) {
  const { logs } = await fetchRange('2022-01-01', ymd());
  const my = mine(logs);
  const shortFrom = addDays(ymd(), -(SETTINGS.bestWindowDays - 1));

  const blocks = EXERCISES
    .map((ex) => ({ ex, rows: my.filter((r) => r.exercise === ex.code) }))
    .filter((x) => x.rows.length)
    .map(({ ex, rows }) => {
      const recent = rows.filter((r) => r.logged_on >= shortFrom);
      const lines = [];

      for (const f of ex.fields) {
        const pick = (list) => list.reduce(
          (best, r) => (METRICS[f].get(r) > (best ? METRICS[f].get(best) : 0) ? r : best), null);
        const all = pick(rows); const rec = pick(recent);
        if (!all || METRICS[f].get(all) <= 0) continue;
        const show = (r) => {
          if (!r || METRICS[f].get(r) <= 0) return '–';
          return f === 'time' ? fmtClock(r.duration_sec)
                              : `${fmtNum(round1(METRICS[f].get(r)))}${METRICS[f].unit}`;
        };
        lines.push([
          f === 'reps' ? '한 번에 최다' : f === 'time' ? '최장 시간'
            : f === 'distance' ? '최장 거리' : '최다 왕복',
          show(all), all.logged_on.slice(2).replace(/-/g, '.'), show(rec),
        ]);
      }

      // 달리기·사이클은 페이스도 기록으로 친다 (1km 이상 세션만)
      if (ex.fields.includes('time') && ex.fields.includes('distance')) {
        const paced = rows.filter((r) => r.duration_sec > 0 && Number(r.distance_km) >= 1);
        if (paced.length) {
          const best = paced.reduce((b, r) =>
            (r.duration_sec / r.distance_km < b.duration_sec / b.distance_km ? r : b));
          const recPaced = paced.filter((r) => r.logged_on >= shortFrom);
          const bestRec = recPaced.length ? recPaced.reduce((b, r) =>
            (r.duration_sec / r.distance_km < b.duration_sec / b.distance_km ? r : b)) : null;
          const pace = (r) => (r ? `${fmtClock(Math.round(r.duration_sec / r.distance_km))}/km` : '–');
          lines.push(['최고 페이스', pace(best), best.logged_on.slice(2).replace(/-/g, '.'), pace(bestRec)]);
        }
      }

      if (!lines.length) return null;
      return el('div', { class: 'block' }, [
        el('h3', { text: `${ex.icon ?? ''} ${ex.name}` }),
        el('table', { class: 'grid' }, [
          el('thead', {}, el('tr', {}, [
            el('th', { text: '' }), el('th', { text: '역대' }), el('th', { text: '날짜' }),
            el('th', { text: `최근 ${SETTINGS.bestWindowDays}일` }),
          ])),
          el('tbody', {}, lines.map(([k, v, d, r]) => el('tr', {}, [
            el('td', { text: k }),
            el('td', { class: 'v', text: v }),
            el('td', { class: 'sub', text: d }),
            el('td', { class: 'v', text: r }),
          ]))),
        ]),
      ]);
    })
    .filter(Boolean);

  mount(body,
    ...(blocks.length ? blocks : [el('p', { class: 'empty', text: '아직 기록이 없다.' })]),
  );
}
