import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';

const MAX_ENTRIES = 50;
const MAX_COMMENTS = 100;

function formatDate(timestamp) {
  if (!timestamp?.toDate) return '방금 전';
  const value = timestamp.toDate();
  const pad = (number) => String(number).padStart(2, '0');
  return `${value.getFullYear()}.${pad(value.getMonth() + 1)}.${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function initGuestbook() {
  const form = document.getElementById('guestbook-form');
  const list = document.getElementById('guestbook-list');
  const status = document.getElementById('guestbook-status');
  const counter = document.getElementById('guestbook-count');
  const messageInput = document.getElementById('guestbook-message');
  const nameInput = document.getElementById('guestbook-name');
  const nameLabel = document.querySelector('label[for="guestbook-name"]');
  let db = null;
  let isAdmin = false;
  let entries = [];
  let commentUnsubscribers = [];

  const setStatus = (message = '') => { status.textContent = message; };
  const adminBadge = () => { const badge = document.createElement('span'); badge.className = 'guestbook-admin-badge'; badge.setAttribute('role', 'img'); badge.setAttribute('aria-label', '관리자'); badge.title = '관리자'; badge.textContent = '★'; return badge; };
  const deleteButton = (path, successMessage) => {
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'guestbook-delete'; remove.textContent = '삭제';
    remove.addEventListener('click', async () => {
      try { await deleteDoc(path); setStatus(successMessage); }
      catch (error) { setStatus('삭제하지 못했습니다. 관리자 권한을 확인하세요.'); console.error(error); }
    });
    return remove;
  };
  const renderComments = (container, entryId, comments) => {
    container.replaceChildren();
    comments.forEach((comment) => {
      const item = document.createElement('article'); item.className = 'guestbook-comment';
      const head = document.createElement('div'); head.className = 'guestbook-comment-head';
      if (comment.data.isAdmin === true) head.append(adminBadge());
      else { const name = document.createElement('strong'); name.textContent = comment.data.name; head.append(name); }
      const date = document.createElement('time'); date.textContent = formatDate(comment.data.createdAt); head.append(date);
      if (isAdmin) head.append(deleteButton(doc(db, 'guestbookEntries', entryId, 'comments', comment.id), '댓글을 삭제했습니다.'));
      const body = document.createElement('p'); body.textContent = comment.data.message;
      item.append(head, body); container.append(item);
    });
  };
  const commentForm = (entryId) => {
    const formEl = document.createElement('form'); formEl.className = 'guestbook-comment-form';
    const name = document.createElement('input'); name.name = 'name'; name.maxLength = 30; name.required = true; name.placeholder = '이름'; name.setAttribute('aria-label', '댓글 작성자 이름');
    const message = document.createElement('input'); message.name = 'message'; message.maxLength = 500; message.required = true; message.placeholder = '댓글을 남겨 주세요'; message.setAttribute('aria-label', '댓글 내용');
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '댓글';
    if (!isAdmin) formEl.append(name);
    else formEl.classList.add('is-admin');
    formEl.append(message, submit);
    formEl.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!db) return;
      const author = isAdmin ? '관리자' : name.value.trim(); const text = message.value.trim();
      if (!author || !text) return;
      submit.disabled = true;
      try {
        const data = { name: author, message: text, createdAt: serverTimestamp() };
        if (isAdmin) data.isAdmin = true;
        await addDoc(collection(db, 'guestbookEntries', entryId, 'comments'), data);
        formEl.reset(); setStatus('댓글을 남겼습니다.');
      } catch (error) { setStatus('댓글을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.'); console.error(error); }
      finally { submit.disabled = false; }
    });
    return formEl;
  };
  const render = () => {
    commentUnsubscribers.forEach((unsubscribe) => unsubscribe()); commentUnsubscribers = [];
    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('p'); empty.className = 'guestbook-empty'; empty.textContent = '첫 번째 인사를 남겨 주세요!'; list.append(empty); return;
    }
    entries.forEach((entry) => {
      const card = document.createElement('article'); card.className = 'guestbook-entry';
      const head = document.createElement('div'); head.className = 'guestbook-entry-head';
      if (entry.data.isAdmin === true) head.append(adminBadge());
      else { const name = document.createElement('strong'); name.className = 'guestbook-entry-name'; name.textContent = entry.data.name; head.append(name); }
      const date = document.createElement('time'); date.className = 'guestbook-entry-date'; date.textContent = formatDate(entry.data.createdAt); head.append(date);
      if (isAdmin) head.append(deleteButton(doc(db, 'guestbookEntries', entry.id), '방명록을 삭제했습니다.'));
      const body = document.createElement('p'); body.className = 'guestbook-entry-message'; body.textContent = entry.data.message;
      const comments = document.createElement('section'); comments.className = 'guestbook-comments'; comments.setAttribute('aria-label', '댓글');
      card.append(head, body, comments, commentForm(entry.id)); list.append(card);
      if (db) {
        const commentQuery = query(collection(db, 'guestbookEntries', entry.id, 'comments'), orderBy('createdAt', 'asc'), limit(MAX_COMMENTS));
        commentUnsubscribers.push(onSnapshot(commentQuery, (snapshot) => renderComments(comments, entry.id, snapshot.docs.map((item) => ({ id: item.id, data: item.data() }))), (error) => { console.error('댓글을 불러오지 못했습니다.', error); }));
      }
    });
  };

  messageInput.addEventListener('input', () => { counter.textContent = `${messageInput.value.length} / 500`; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!db) { setStatus('방명록 연결을 준비 중이에요.'); return; }
    const data = new FormData(form); const name = isAdmin ? '관리자' : String(data.get('name')).trim(); const message = String(data.get('message')).trim();
    if (!name || !message) { setStatus('이름과 메시지를 입력해 주세요.'); return; }
    const submit = form.querySelector('button[type="submit"]'); submit.disabled = true;
    try {
      const entry = { name, message, createdAt: serverTimestamp() };
      if (isAdmin) entry.isAdmin = true;
      await addDoc(collection(db, 'guestbookEntries'), entry);
      form.reset(); counter.textContent = '0 / 500'; setStatus('방명록을 남겼어요. 고마워요 ♡');
    } catch (error) { setStatus('방명록을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.'); console.error(error); }
    finally { submit.disabled = false; }
  });

  return {
    render,
    connect: (database) => {
      db = database;
      onSnapshot(query(collection(db, 'guestbookEntries'), orderBy('createdAt', 'desc'), limit(MAX_ENTRIES)), (snapshot) => { entries = snapshot.docs.map((item) => ({ id: item.id, data: item.data() })); render(); }, (error) => { setStatus('방명록을 불러오지 못했습니다. Firestore 규칙을 확인해 주세요.'); console.error(error); });
    },
    setAdmin: (enabled) => {
      isAdmin = enabled;
      nameLabel.hidden = enabled;
      nameInput.hidden = enabled;
      nameInput.required = !enabled;
      if (enabled) nameInput.value = '';
      render();
    },
  };
}
