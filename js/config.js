// Supabase 접속 정보. 이 두 줄만 내 프로젝트 값으로 바꾸면 앱이 붙는다.
// Supabase 대시보드 > Project Settings > Data API 에서 복사한다.
//
// anon key 는 공개돼도 되는 키다. 실제 방어는 RLS(01_schema.sql)와
// 로그인이 한다. service_role 키는 절대 여기 넣지 않는다.

export const SUPABASE_URL = 'https://여기에-프로젝트-ref.supabase.co';
export const SUPABASE_ANON_KEY = '여기에-anon-public-키';
