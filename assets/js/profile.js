import { doc, onSnapshot, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const defaults = { name: '홈피 주인', status: '오늘도 반짝반짝 ♡', info: '🌸 방문자: 1,234\n♡ 친구: 12명\n✦ 방명록: 56개' };
const safeImageUrl = (value) => {
  try { const url = new URL(String(value || '').trim()); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
};

export function initProfile() {
  const name = document.getElementById('profile-name');
  const status = document.getElementById('profile-status');
  const info = document.getElementById('profile-info');
  const image = document.getElementById('profile-avatar-image');
  const fallback = document.getElementById('profile-avatar-fallback');
  const editor = document.getElementById('profile-editor');
  const imageInput = document.getElementById('profile-image-url-input');
  const preview = document.getElementById('profile-image-preview');
  const windowEl = document.getElementById('win-profile');
  const edit = document.getElementById('profile-edit');
  const cancel = document.getElementById('profile-edit-cancel');
  const authStatus = document.getElementById('profile-auth-status');
  let db; let isAdmin = false;
  const setStatus = (message) => { authStatus.hidden = false; authStatus.textContent = message; };
  const showImage = (value) => {
    const url = safeImageUrl(value); image.hidden = !url; fallback.hidden = Boolean(url); preview.hidden = !url;
    if (url) { image.src = url; preview.src = url; } else { image.removeAttribute('src'); preview.removeAttribute('src'); }
  };
  const render = (data = defaults) => {
    const profile = { ...defaults, ...data }; name.textContent = profile.name; status.textContent = profile.status;
    info.replaceChildren(); profile.info.split('\n').forEach((line, index) => { if (index) info.append(document.createElement('br')); info.append(document.createTextNode(line)); });
    editor.elements.name.value = profile.name; editor.elements.status.value = profile.status; editor.elements.info.value = profile.info; editor.elements.imageUrl.value = profile.imageUrl || ''; showImage(profile.imageUrl);
  };
  const setEditorOpen = (open) => { editor.hidden = !open; windowEl.classList.toggle('editing', open); };
  imageInput.addEventListener('input', () => showImage(imageInput.value));
  image.addEventListener('error', () => { image.hidden = true; fallback.hidden = false; }); preview.addEventListener('error', () => { preview.hidden = true; });
  edit.addEventListener('click', () => { if (isAdmin) setEditorOpen(true); }); cancel.addEventListener('click', () => setEditorOpen(false));
  editor.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!isAdmin || !db) return; const form = new FormData(editor); const imageUrl = safeImageUrl(form.get('imageUrl'));
    if (String(form.get('imageUrl')).trim() && !imageUrl) return setStatus('http 또는 https 사진 링크를 입력하세요.');
    try { await setDoc(doc(db, 'siteContent', 'profile'), { name: form.get('name').trim(), status: form.get('status').trim(), imageUrl, info: form.get('info').trim(), updatedAt: serverTimestamp() }, { merge: true }); setStatus('프로필을 저장했습니다.'); setEditorOpen(false); }
    catch (error) { setStatus('저장하지 못했습니다. 관리자 설정을 확인하세요.'); console.error(error); }
  });
  return { render, setStatus, connect: (database) => { db = database; onSnapshot(doc(db, 'siteContent', 'profile'), (snapshot) => render(snapshot.data()), (error) => { setStatus('프로필을 불러오지 못했습니다.'); console.error(error); }); }, setAdmin: (enabled) => { isAdmin = enabled; edit.hidden = !enabled; if (!enabled) setEditorOpen(false); } };
}
