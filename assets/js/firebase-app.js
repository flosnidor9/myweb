import { createFirebase } from './firebase.js';
import { initAuthControls } from './auth-controls.js';
import { initDiary } from './diary.js';
import { initGuestbook } from './guestbook.js';
import { initProfile } from './profile.js';
import { initWelcome } from './welcome.js';

const profile = initProfile();
const welcome = initWelcome();
const diary = initDiary();
const guestbook = initGuestbook();
const features = [profile, welcome, diary, guestbook];
features.forEach((feature) => feature.render());

try {
  const { auth, db } = createFirebase();
  features.forEach((feature) => feature.connect(db));
  initAuthControls({ auth, db, onAdminChange: (isAdmin) => features.forEach((feature) => feature.setAdmin(isAdmin)) });
} catch (error) {
  profile.setStatus('Firebase 설정 후 프로필을 연결할 수 있습니다.');
  console.error(error);
}
