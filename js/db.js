// Supabase 호출은 전부 여기 모은다. 화면 코드에서 supabase 객체를 직접 만지지 않는다.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** 실패하면 호출한 쪽에서 잡아 toast 를 띄운다. 여기서 삼키지 않는다. */
function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ── 인증 ────────────────────────────────────────────────────────
export async function signIn(email, password) {
  return ok(await sb.auth.signInWithPassword({ email, password }));
}

export const signOut = () => sb.auth.signOut();

export async function currentSession() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

// ── 조회 ────────────────────────────────────────────────────────
export async function loadPeople() {
  return ok(await sb.from('people').select('*').order('id'));
}

/** 기간 내 운동 세션 전체 (두 사람 모두). 대시보드는 이걸 한 번 받아 클라이언트에서 집계한다. */
export async function loadLogs(from, to) {
  return ok(
    await sb.from('workout_logs').select('*')
      .gte('logged_on', from).lte('logged_on', to)
      .order('logged_on', { ascending: true }),
  );
}

export async function loadDayLogs(personId, day) {
  return ok(
    await sb.from('workout_logs').select('*')
      .eq('person_id', personId).eq('logged_on', day)
      .order('id', { ascending: true }),
  );
}

export async function loadNotes(from, to) {
  return ok(
    await sb.from('daily_notes').select('*')
      .gte('logged_on', from).lte('logged_on', to)
      .order('logged_on', { ascending: true }),
  );
}

export async function loadDayNote(personId, day) {
  const rows = ok(
    await sb.from('daily_notes').select('*')
      .eq('person_id', personId).eq('logged_on', day).limit(1),
  );
  return rows[0] ?? null;
}

// ── 기록 ────────────────────────────────────────────────────────
export async function addLog(row) {
  return ok(await sb.from('workout_logs').insert(row).select().single());
}

export async function updateLog(id, patch) {
  return ok(await sb.from('workout_logs').update(patch).eq('id', id).select().single());
}

export async function deleteLog(id) {
  return ok(await sb.from('workout_logs').delete().eq('id', id));
}

/** 하루 메모는 (person_id, logged_on) 유니크라서 upsert 한 방으로 끝낸다. */
export async function saveDayNote(personId, day, patch) {
  return ok(
    await sb.from('daily_notes')
      .upsert({ person_id: personId, logged_on: day, ...patch },
              { onConflict: 'person_id,logged_on' })
      .select().single(),
  );
}
