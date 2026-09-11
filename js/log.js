// 기록 화면: 날짜 이동 → 종목 타일 탭 → 그 종목 칸만 뜨는 시트 → 저장.
import { EXERCISES, EX_BY_CODE, SETTINGS } from './data.js';
import * as db from './db.js';
import { state } from './state.js';
import {
  $, el, mount, ymd, addDays, labelDate, fmtNum, fmtSec, toSec, splitSec, describe, toast, round1,
} from './util.js';

let dayRows = [];     // 이 날짜·이 사람의 workout_logs
let dayNote = null;   // daily_notes 한 줄
let editing = null;   // { code, row|null }

// ── 화면 전체 그리기 ────────────────────────────────────────────
export async function renderLog() {
  $('#dayLabel').innerHTML =
    `${labelDate(state.day)}<small>${state.day === ymd() ? '오늘' : '탭하면 오늘로'}</small>`;
  try {
    [dayRows, dayNote] = await Promise.all([
      db.loadDayLogs(state.personId, state.day),
      db.loadDayNote(state.personId, state.day),
    ]);
  } catch (e) {
    toast(`불러오지 못했다: ${e.message}`, 'err');
    return;
  }
  drawTiles();
  drawRows();
  drawDayCard();
}

/** 종목별 그날 합계 (타일에 찍는 숫자) */
function tileValue(code) {
  const rows = dayRows.filter((r) => r.exercise === code);
  if (!rows.length) return null;
  const f = EX_BY_CODE[code]?.fields ?? [];
  if (f.includes('reps')) {
    const n = rows.reduce((s, r) => s + (r.reps || 0), 0);
    return { text: fmtNum(n), unit: '개' };
  }
  if (f.includes('time')) {
    const n = rows.reduce((s, r) => s + (r.duration_sec || 0), 0);
    if (n) return { text: fmtNum(Math.round(n / 60)), unit: '분' };
  }
  if (f.includes('distance')) {
    const n = rows.reduce((s, r) => s + Number(r.distance_km || 0), 0);
    if (n) return { text: fmtNum(round1(n)), unit: 'km' };
  }
  if (f.includes('laps')) {
    const n = rows.reduce((s, r) => s + Number(r.laps || 0), 0);
    if (n) return { text: fmtNum(n), unit: '회' };
  }
  return { text: '✓', unit: '' };
}

function drawTiles() {
  const box = $('#tiles');
  mount(box,
    ...EXERCISES.filter((e) => e.active !== false).map((e) => {
      const v = tileValue(e.code);
      return el('button', {
        class: 'tile', 'data-done': v ? '1' : '0',
        onclick: () => openSheet(e.code),
      }, [
        el('span', { class: 'ico', text: e.icon ?? '•' }),
        el('span', {}, [
          el('span', { class: 'nm', text: e.name }),
          el('br'),
          v
            ? el('span', { class: 'val num' }, [v.text, el('small', { text: v.unit })])
            : el('span', { class: 'val num', text: '·', style: 'color:var(--dim)' }),
        ]),
      ]);
    }),
  );
}

function drawRows() {
  const box = $('#dayRows');
  $('#dayCount').textContent =
    dayRows.length ? `이 날의 기록 ${dayRows.length}건` : '이 날의 기록';
  if (!dayRows.length) {
    mount(box, el('p', { class: 'empty', text: '아직 없다. 위에서 종목을 누르면 된다.' }));
    return;
  }
  mount(box, ...dayRows.map((r) => {
    const name = EX_BY_CODE[r.exercise]?.name ?? r.exercise;
    return el('div', { class: 'row' }, [
      el('div', { class: 'main', onclick: () => openSheet(r.exercise, r) }, [
        el('b', { text: describe(r, name) }),
        r.note ? el('span', { class: 'memo', text: r.note }) : null,
      ]),
      el('button', { class: 'del', text: '삭제', onclick: () => removeRow(r) }),
    ]);
  }));
}

async function removeRow(r) {
  if (!confirm(`${EX_BY_CODE[r.exercise]?.name ?? r.exercise} 기록을 지운다?`)) return;
  try {
    await db.deleteLog(r.id);
    toast('지웠다');
    await renderLog();
  } catch (e) { toast(e.message, 'err'); }
}

// ── 하루 메모 카드 ──────────────────────────────────────────────
function drawDayCard() {
  $('#weight').value = dayNote?.weight_kg ?? '';
  $('#dayNote').value = dayNote?.note ?? '';
  $('#isRest').checked = !!dayNote?.is_rest;
}

async function saveDayCard() {
  const w = $('#weight').value.trim();
  const patch = {
    weight_kg: w === '' ? null : Number(w),
    note: $('#dayNote').value.trim() || null,
    is_rest: $('#isRest').checked,
  };
  try {
    dayNote = await db.saveDayNote(state.personId, state.day, patch);
    toast('저장했다');
  } catch (e) { toast(e.message, 'err'); }
}

// ── 입력 시트 ──────────────────────────────────────────────────
export function openSheet(code, row = null) {
  const ex = EX_BY_CODE[code];
  if (!ex) return;
  editing = { code, row };

  $('#sheetTitle').textContent = ex.name;
  $('#sheetSub').textContent = row ? '고치는 중' : (ex.goal ? `목표 ${fmtNum(ex.goal)}` : '');

  const box = $('#sheetFields');
  mount(box, ...ex.fields.map((f) => fieldBlock(f, row)),
    el('div', { class: 'inputrow' }, [
      el('label', { for: 'sheetNote', text: '메모 (선택)' }),
      el('input', {
        class: 'field', id: 'sheetNote', type: 'text',
        placeholder: '집에서, 아침에, 힘들었음…', value: row?.note ?? '',
      }),
    ]),
    row ? el('div', { class: 'quick' }, [
      el('button', { text: '이 종목 새 기록으로 추가', onclick: () => { editing.row = null; $('#sheetSub').textContent = '새 기록'; toast('새 기록으로 저장된다'); } }),
    ]) : null,
  );

  $('#sheet').hidden = false;
  setTimeout(() => box.querySelector('input')?.focus(), 60);
}

export function closeSheet() {
  $('#sheet').hidden = true;
  editing = null;
}

function numInput(id, value, opts = {}) {
  return el('input', {
    class: 'big num', id, type: 'number',
    inputmode: opts.decimal ? 'decimal' : 'numeric',
    step: opts.step ?? '1', min: '0',
    placeholder: opts.ph ?? '0',
    value: value ?? '',
  });
}

function fieldBlock(kind, row) {
  if (kind === 'reps') {
    const input = numInput('f_reps', row?.reps);
    const bump = (n) => () => { input.value = (Number(input.value) || 0) + n; };
    return el('div', { class: 'inputrow' }, [
      el('label', { for: 'f_reps', text: '개수' }),
      el('div', { class: 'pair' }, [input, el('span', { text: '개' })]),
      el('div', { class: 'quick' }, [10, 20, 50, 100].map((n) =>
        el('button', { text: `+${n}`, onclick: bump(n) }))),
    ]);
  }
  if (kind === 'time') {
    const { min, sec } = splitSec(row?.duration_sec ?? null);
    return el('div', { class: 'inputrow' }, [
      el('label', { for: 'f_min', text: '시간' }),
      el('div', { class: 'pair' }, [
        numInput('f_min', row?.duration_sec == null ? null : min, { ph: '분' }),
        el('span', { text: '분' }),
        numInput('f_sec', row?.duration_sec == null ? null : sec, { ph: '초' }),
        el('span', { text: '초' }),
      ]),
    ]);
  }
  if (kind === 'distance') {
    return el('div', { class: 'inputrow' }, [
      el('label', { for: 'f_km', text: '거리' }),
      el('div', { class: 'pair' }, [
        numInput('f_km', row?.distance_km, { decimal: true, step: '0.1', ph: '0.0' }),
        el('span', { text: 'km' }),
      ]),
    ]);
  }
  if (kind === 'laps') {
    return el('div', { class: 'inputrow' }, [
      el('label', { for: 'f_laps', text: `왕복 (편도는 0.5 · 1회 = ${SETTINGS.poolLengthM * 2}m)` }),
      el('div', { class: 'pair' }, [
        numInput('f_laps', row?.laps, { decimal: true, step: '0.5', ph: '0' }),
        el('span', { text: '회' }),
      ]),
    ]);
  }
  return el('div');
}

async function saveSheet() {
  if (!editing) return;
  const ex = EX_BY_CODE[editing.code];
  const g = (id) => {
    const node = $(`#${id}`);
    return node && node.value !== '' ? Number(node.value) : null;
  };

  const payload = { reps: null, duration_sec: null, distance_km: null, laps: null };
  if (ex.fields.includes('reps')) payload.reps = g('f_reps');
  if (ex.fields.includes('time')) {
    const m = g('f_min'); const s = g('f_sec');
    payload.duration_sec = (m == null && s == null) ? null : toSec(m, s);
  }
  if (ex.fields.includes('distance')) payload.distance_km = g('f_km');
  if (ex.fields.includes('laps')) payload.laps = g('f_laps');
  payload.note = $('#sheetNote').value.trim() || null;

  const hasValue = ['reps', 'duration_sec', 'distance_km', 'laps'].some((k) => payload[k] != null);
  if (!hasValue) { toast('숫자를 하나는 넣어야 한다', 'err'); return; }

  try {
    if (editing.row) {
      await db.updateLog(editing.row.id, payload);
    } else {
      await db.addLog({
        person_id: state.personId, logged_on: state.day,
        exercise: editing.code, source: 'app', ...payload,
      });
    }
    closeSheet();
    toast(`${ex.name} 저장`);
    await renderLog();
  } catch (e) { toast(e.message, 'err'); }
}

// ── 이벤트 묶기 (app.js 부팅 때 한 번) ──────────────────────────
export function bindLog() {
  $('#dayPrev').onclick = () => { state.day = addDays(state.day, -1); renderLog(); };
  $('#dayNext').onclick = () => { state.day = addDays(state.day, 1); renderLog(); };
  $('#dayLabel').onclick = () => { state.day = ymd(); renderLog(); };

  $('#sheetSave').onclick = saveSheet;
  $('#sheetClose').onclick = closeSheet;
  $('#sheet').onclick = (e) => { if (e.target.id === 'sheet') closeSheet(); };

  for (const id of ['#weight', '#dayNote']) $(id).onblur = saveDayCard;
  $('#isRest').onchange = saveDayCard;
}
