import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { firebaseConfig } from '../../firebase-config.js';

export function createFirebase() {
  if (!firebaseConfig || firebaseConfig.apiKey === 'PASTE_YOUR_API_KEY') throw new Error('Firebase configuration is unavailable.');
  const app = initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}
