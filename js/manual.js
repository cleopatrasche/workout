// 매뉴얼 탭. 내용은 js/data.js 의 MANUALS 가 전부다. 링크 고칠 때 이 파일은 볼 필요 없다.
import { MANUALS } from './data.js';
import { $, el, mount } from './util.js';

export function renderManual() {
  const box = $('#sc-manual');
  if (box.dataset.built) return;      // 정적이라 한 번만 그린다
  box.dataset.built = '1';
  mount(box,
    ...MANUALS.flatMap((group) => [
      el('h3', { text: group.category }),
      ...group.links.map((l) =>
        el('a', { href: l.url, target: '_blank', rel: 'noopener', text: l.title })),
    ]),
  );
}
