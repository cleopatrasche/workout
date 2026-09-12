// Supabase 접속 정보. 이 두 줄만 내 프로젝트 값으로 바꾸면 앱이 붙는다.
// Supabase 대시보드 > Project Settings > Data API 에서 복사한다.
//
// anon key 는 공개돼도 되는 키다. 실제 방어는 RLS(01_schema.sql)와
// 로그인이 한다. service_role 키는 절대 여기 넣지 않는다.

export const SUPABASE_URL = 'https://hhklyfzvqikhoxihsdmn.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhoa2x5Znp2cWlraG94aWhzZG1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNTM5ODAsImV4cCI6MjEwNDcyOTk4MH0.vckX811ASz0nVfftZE7lqSDxZDPYBpQCbAuYGuyYWO0';

