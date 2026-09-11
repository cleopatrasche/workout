// 화면끼리 공유하는 최소 상태. 여기 값을 바꾼 쪽이 해당 화면 render()를 직접 부른다.
// (프레임워크 없이 가는 프로젝트라 반응형 바인딩은 일부러 두지 않았다.)
import { ymd } from './util.js';

export const state = {
  personId: 1,     // 지금 보고 있는 사람
  day: ymd(),      // 기록 화면의 날짜 'YYYY-MM-DD'
  people: [],      // DB people 테이블
  email: null,     // 로그인한 계정
};

export const person = () => state.people.find((p) => p.id === state.personId) ?? state.people[0];

/** 선택된 사람 색을 CSS 변수에 반영한다. 화면 전체 강조색이 사람에 따라 바뀐다. */
export function applyAccent() {
  document.documentElement.style.setProperty('--accent', person()?.color ?? '#45B3E0');
}
