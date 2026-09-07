import { doc, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const defaults = { title: '★ 어서오세요~ ★', message: '나의 소중한 미니홈피에 오신 것을 환영해요! ♡\n편히 쉬다 가세요~' };
export function initWelcome() {
  const title = document.getElementById('welcome-title'); const message = document.getElementById('welcome-message'); const editor = document.getElementById('welcome-editor');
  const menu = document.getElementById('welcome-file-menu'); const dropdown = document.getElementById('welcome-file-dropdown'); const edit = document.getElementById('welcome-edit'); const cancel = document.getElementById('welcome-edit-cancel');
  let db; let isAdmin = false;
  const render = (data = defaults) => { const welcome = { ...defaults, ...data }; title.textContent = welcome.title; message.replaceChildren(); welcome.message.split('\n').forEach((line, index) => { if (index) message.append(document.createElement('br')); message.append(document.createTextNode(line)); }); editor.elements.title.value = welcome.title; editor.elements.message.value = welcome.message; };
  menu.addEventListener('click', () => { if (!isAdmin) { dropdown.hidden = true; window.showToast('관리자 로그인 후 편집할 수 있어요.'); return; } dropdown.hidden = !dropdown.hidden; });
  document.addEventListener('click', (event) => { if (!event.target.closest('.menu')) dropdown.hidden = true; });
  edit.addEventListener('click', () => { dropdown.hidden = true; if (isAdmin) editor.hidden = false; }); cancel.addEventListener('click', () => { editor.hidden = true; });
  editor.addEventListener('submit', async (event) => { event.preventDefault(); if (!isAdmin || !db) return; const form = new FormData(editor); const welcome = { title: form.get('title').trim(), message: form.get('message').trim(), updatedAt: serverTimestamp() }; try { await setDoc(doc(db, 'siteContent', 'welcome'), welcome, { merge: true }); render(welcome); editor.hidden = true; window.showToast('홈 문구를 저장했습니다.'); } catch (error) { window.showToast('홈 문구를 저장하지 못했습니다.'); console.error(error); } });
  return { render, connect: (database) => { db = database; onSnapshot(doc(db, 'siteContent', 'welcome'), (snapshot) => render(snapshot.data()), (error) => console.error('홈 문구를 불러오지 못했습니다.', error)); }, setAdmin: (enabled) => { isAdmin = enabled; edit.hidden = !enabled; if (!enabled) editor.hidden = true; } };
}
