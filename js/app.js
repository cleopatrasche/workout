// 부팅 · 로그인 · 탭 전환. 화면별 로직은 log.js / dash.js / manual.js 가 갖는다.
import * as db from './db.js';
import { PEOPLE } from './data.js';
import { state, applyAccent } from './state.js';
import { renderLog, bindLog } from './log.js';
import { renderDash, bindDash, invalidate } from './dash.js';
import { renderManual } from './manual.js';
import { $, el, toast } from './util.js';

const TITLES = { log: '기록', dash: '대시보드', manual: '매뉴얼' };
let screen = 'log';

// ── 로그인 ──────────────────────────────────────────────────────
$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = $('#loginBtn');
  btn.disabled = true;
  try {
    await db.signIn($('#email').value.trim(), $('#pw').value);
    await start();
  } catch (err) {
    toast('아이디나 비밀번호가 맞지 않는다', 'err');
  } finally {
    btn.disabled = false;
  }
});

$('#logoutBtn').onclick = async () => {
  await db.signOut();
  location.reload();
};

// ── 부팅 ────────────────────────────────────────────────────────
async function start() {
  const session = await db.currentSession();
  if (!session) return;

  state.email = session.user.email;
  try {
    state.people = await db.loadPeople();
  } catch (e) {
    toast(`people 테이블을 못 읽었다: ${e.message}`, 'err');
    state.people = PEOPLE;   // 01_schema.sql 을 아직 안 돌린 경우 대비
  }

  // 로그인한 계정과 같은 사람을 기본 선택
  state.personId = state.people.find((p) => p.email === state.email)?.id ?? state.people[0].id;
  applyAccent();

  $('#gate').classList.add('hidden');
  for (const id of ['#topbar', '#app', '#tabs']) $(id).hidden = false;

  buildWhoSwitch();
  bindLog();
  bindDash();
  bindTabs();
  await renderLog();
}

function buildWhoSwitch() {
  $('#whoSwitch').replaceChildren(...state.people.map((p) =>
    el('button', {
      text: p.name,
      'aria-pressed': String(p.id === state.personId),
      onclick: () => {
        state.personId = p.id;
        applyAccent();
        buildWhoSwitch();
        invalidate();
        refresh();
      },
    })));
}

function bindTabs() {
  for (const b of $('#tabs').children) {
    b.onclick = () => {
      screen = b.dataset.screen;
      for (const x of $('#tabs').children) {
        x.setAttribute('aria-pressed', String(x.dataset.screen === screen));
      }
      for (const s of ['log', 'dash', 'manual']) {
        $(`#sc-${s}`).classList.toggle('is-on', s === screen);
      }
      $('#screenTitle').textContent = TITLES[screen];
      window.scrollTo(0, 0);
      refresh();
    };
  }
}

function refresh() {
  if (screen === 'log') renderLog();
  else if (screen === 'dash') { invalidate(); renderDash(); }
  else renderManual();
}

// 새로고침해도 로그인 유지 (Supabase가 세션을 localStorage에 들고 있다)
start();
