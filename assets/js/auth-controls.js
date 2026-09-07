import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

export function initAuthControls({ auth, db, onAdminChange }) {
  const button = document.getElementById('admin-login');
  const label = document.getElementById('admin-login-label');
  const menu = document.getElementById('start-menu');
  const toggle = document.getElementById('start-menu-toggle');
  const status = document.getElementById('profile-auth-status');
  const setState = async (user) => {
    onAdminChange(false);
    if (!user) { label.textContent = '관리자 로그인'; button.title = 'Google로 관리자 로그인'; status.hidden = true; return; }
    status.hidden = false; label.textContent = '로그아웃'; button.title = '로그아웃'; status.textContent = '관리자 권한을 확인하는 중...';
    try {
      const admin = await getDoc(doc(db, 'admins', user.uid));
      const enabled = admin.exists() && admin.data().enabled === true;
      onAdminChange(enabled);
      status.textContent = `${user.email || user.uid} · ${enabled ? '관리자' : '읽기 전용'}`;
    } catch (error) { status.textContent = '관리자 권한을 확인할 수 없습니다.'; console.error(error); }
  };
  button.addEventListener('click', async () => {
    menu.hidden = true;
    try { if (auth.currentUser) await signOut(auth); else await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (error) { status.hidden = false; status.textContent = 'Google 로그인에 실패했습니다.'; console.error(error); }
  });
  const mobileToggle = document.getElementById('mobile-admin-btn');
  toggle.addEventListener('click', () => { menu.hidden = !menu.hidden; });
  if (mobileToggle) mobileToggle.addEventListener('click', () => { menu.hidden = !menu.hidden; });
  document.addEventListener('click', (event) => { if (!event.target.closest('#start-menu, #start-menu-toggle, #mobile-admin-btn')) menu.hidden = true; });
  onAuthStateChanged(auth, setState);
}
