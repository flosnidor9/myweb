const DATA_PATH = 'board-data';
const PRIVATE_REPOSITORY = 'flosnidor9/myweb-private';
const PBKDF2_ITERATIONS = 300000;

function hexToBytes(hex) { const bytes = new Uint8Array(hex.length / 2); for (let index = 0; index < hex.length; index += 2) bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16); return bytes; }
function bytesToHex(bytes) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); }
function encodeBase64(value) { const bytes = new TextEncoder().encode(value); let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); }); return btoa(binary); }
function decodeBase64(value) { const binary = atob(value.replace(/\s/g, '')); const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0)); return new TextDecoder().decode(bytes); }
async function deriveKey(password, salt, usage) { const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, usage); }
async function decrypt(data, password) { const ciphertext = hexToBytes(data.ciphertext); const authTag = hexToBytes(data.authTag); const combined = new Uint8Array(ciphertext.length + authTag.length); combined.set(ciphertext); combined.set(authTag, ciphertext.length); const key = await deriveKey(password, hexToBytes(data.salt), ['decrypt']); const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: hexToBytes(data.iv) }, key, combined); return JSON.parse(new TextDecoder().decode(plaintext)); }
async function encrypt(value, password) { const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12)); const key = await deriveKey(password, salt, ['encrypt']); const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value))); const tagLength = 16; return { salt: bytesToHex(salt), iv: bytesToHex(iv), ciphertext: bytesToHex(encrypted.slice(0, -tagLength)), authTag: bytesToHex(encrypted.slice(-tagLength)) }; }
function githubUrl(path) { return `https://api.github.com/repos/${PRIVATE_REPOSITORY}/contents/${path}`; }
function headers(token) { return { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}` }; }
async function getPrivateFile(path, token, optional = false) { const response = await fetch(githubUrl(path), { headers: headers(token) }); if (optional && response.status === 404) return null; if (!response.ok) throw new Error('private read failed'); const file = await response.json(); return { sha: file.sha, text: decodeBase64(file.content) }; }
async function savePrivateFile(path, text, message, token, sha) { const response = await fetch(githubUrl(path), { method: 'PUT', headers: { ...headers(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content: encodeBase64(text), ...(sha ? { sha } : {}) }) }); if (!response.ok) throw new Error('private write failed'); }

export function initBoard() {
  const title       = document.getElementById('board-title');
  const guide       = document.getElementById('board-guide');
  const list        = document.getElementById('board-list');
  const posts       = document.getElementById('board-posts');
  const back        = document.getElementById('board-back');
  const unlockForm  = document.getElementById('board-unlock-form');
  const pwInput     = document.getElementById('board-password-input');
  const adminForm   = document.getElementById('board-admin-form');
  const newPostForm = document.getElementById('board-new-post-form');
  const adminToggle = document.getElementById('board-admin-toggle');
  const status      = document.getElementById('board-status');

  let boards = [], selected = null, isAdmin = false, currentPosts = [];
  let navLevel = 1; // 1=게시판 목록, 2=글 목록, 3=글 상세

  const setStatus = (msg = '') => { status.textContent = msg; };
  const sharePostsWithTyping = (items) => {
    if (!selected || !Array.isArray(items)) return;
    window.dispatchEvent(new CustomEvent('board-content-available', {
      detail: { board: { id: selected.id, name: selected.name, public: Boolean(selected.public) }, posts: items },
    }));
  };

  const savePostsToRepo = async (arr, token) => {
    const path = `boards/${selected.id}.json`;
    const file = await getPrivateFile(path, token);
    const data = JSON.parse(file.text);
    data.posts = arr;
    await savePrivateFile(path, `${JSON.stringify(data, null, 2)}\n`, `Update posts in board: ${selected.id}`, token, file.sha);
  };

  // ── 레벨 1: 게시판 목록 ──
  const showList = () => {
    navLevel = 1; selected = null;
    title.textContent = '게시판 목록';
    guide.textContent = '들어갈 게시판을 선택해 주세요.';
    back.hidden = true;
    list.hidden = false; posts.hidden = true;
    unlockForm.hidden = true; adminForm.hidden = true; newPostForm.hidden = true;
    pwInput.value = ''; setStatus('');
    if (!adminToggle.hidden) { adminToggle.textContent = '+ 새 게시판'; }
  };

  // ── 레벨 2: 글 목록 (제목+미리보기 행) ──
  const showPostList = (items) => {
    currentPosts = items; navLevel = 2;
    sharePostsWithTyping(items);
    back.hidden = false; back.textContent = '◀ 게시판 목록';
    list.hidden = true; posts.hidden = false;
    unlockForm.hidden = true; newPostForm.hidden = true;
    if (isAdmin) { adminToggle.hidden = false; adminToggle.textContent = '+ 새 게시글'; }
    posts.replaceChildren(); setStatus('');

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'board-posts-empty';
      empty.textContent = '아직 게시글이 없어요.';
      posts.append(empty);
      return;
    }

    items.forEach((item, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.className = 'board-post-row';

      const titleEl = document.createElement('span');
      titleEl.className = 'board-post-row-title';
      titleEl.textContent = item.title;

      const bottom = document.createElement('div');
      bottom.className = 'board-post-row-bottom';
      const preview = document.createElement('span');
      preview.className = 'board-post-row-preview';
      preview.textContent = (item.content || '').slice(0, 60);
      const meta = document.createElement('time');
      meta.className = 'board-post-row-meta';
      meta.textContent = item.date ? new Date(item.date).toLocaleDateString('ko-KR') : '';
      bottom.append(preview, meta);

      btn.append(titleEl, bottom);
      btn.addEventListener('click', () => showPostDetail(item, idx));
      posts.append(btn);
    });
  };

  // ── 레벨 3: 글 상세 ──
  const showPostDetail = (item, idx) => {
    navLevel = 3;
    back.hidden = false; back.textContent = '◀ 목록';
    list.hidden = true; posts.hidden = false; newPostForm.hidden = true;
    if (isAdmin) adminToggle.hidden = true;

    const mkTokenInput = () => {
      const inp = document.createElement('input');
      inp.type = 'password'; inp.placeholder = 'GitHub 쓰기 토큰';
      inp.required = true; inp.autocomplete = 'off';
      return inp;
    };

    const renderView = () => {
      posts.replaceChildren();
      const article = document.createElement('article');
      article.className = 'board-post board-post--detail';

      const hdr = document.createElement('div');
      hdr.className = 'board-post-detail-header';
      const h = document.createElement('strong'); h.textContent = item.title;
      hdr.append(h);
      if (item.date) {
        const t = document.createElement('time'); t.className = 'board-post-meta';
        t.textContent = new Date(item.date).toLocaleDateString('ko-KR');
        hdr.append(t);
      }

      const body = document.createElement('div');
      body.className = 'board-post-body'; body.textContent = item.content;

      article.append(hdr, body);

      if (isAdmin) {
        const actions = document.createElement('div');
        actions.className = 'board-post-actions';
        const editBtn = document.createElement('button');
        editBtn.type = 'button'; editBtn.className = 'board-post-action'; editBtn.textContent = '편집';
        const delBtn = document.createElement('button');
        delBtn.type = 'button'; delBtn.className = 'board-post-action board-post-action--danger'; delBtn.textContent = '삭제';
        editBtn.addEventListener('click', renderEdit);
        delBtn.addEventListener('click', renderDelete);
        actions.append(editBtn, delBtn);
        article.append(actions);
      }
      posts.append(article);
    };

    const renderEdit = () => {
      posts.replaceChildren();
      const article = document.createElement('article'); article.className = 'board-post';
      const form = document.createElement('form'); form.className = 'board-post-form';
      const titleInp = document.createElement('input');
      titleInp.type = 'text'; titleInp.value = item.title; titleInp.required = true; titleInp.maxLength = 100;
      const contentArea = document.createElement('textarea'); contentArea.value = item.content; contentArea.required = true;
      const tokenInp = mkTokenInput();
      const btnRow = document.createElement('div'); btnRow.className = 'board-post-form-actions';
      const saveBtn = document.createElement('button'); saveBtn.type = 'submit'; saveBtn.textContent = '저장';
      const cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.textContent = '취소';
      cancelBtn.addEventListener('click', renderView);
      btnRow.append(saveBtn, cancelBtn);
      form.append(titleInp, contentArea, tokenInp, btnRow);
      article.append(form); posts.append(article);

      form.addEventListener('submit', async (e) => {
        e.preventDefault(); saveBtn.disabled = true; setStatus('수정하는 중…');
        try {
          const updated = { ...item, title: titleInp.value.trim(), content: contentArea.value.trim() };
          const next = currentPosts.map((p, i) => i === idx ? updated : p);
          await savePostsToRepo(next, tokenInp.value);
          currentPosts = next; item = updated; setStatus('수정했습니다.'); renderView();
        } catch { setStatus('수정하지 못했습니다.'); saveBtn.disabled = false; }
      });
    };

    const renderDelete = () => {
      posts.replaceChildren();
      const article = document.createElement('article'); article.className = 'board-post';
      const form = document.createElement('form'); form.className = 'board-post-form';
      const warning = document.createElement('p'); warning.textContent = `"${item.title}" 게시글을 삭제합니다.`;
      const tokenInp = mkTokenInput();
      const btnRow = document.createElement('div'); btnRow.className = 'board-post-form-actions';
      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'submit'; confirmBtn.className = 'board-post-action--danger'; confirmBtn.textContent = '삭제 확인';
      const cancelBtn = document.createElement('button'); cancelBtn.type = 'button'; cancelBtn.textContent = '취소';
      cancelBtn.addEventListener('click', renderView);
      btnRow.append(confirmBtn, cancelBtn);
      form.append(warning, tokenInp, btnRow);
      article.append(form); posts.append(article);

      form.addEventListener('submit', async (e) => {
        e.preventDefault(); confirmBtn.disabled = true; setStatus('삭제하는 중…');
        try {
          const next = currentPosts.filter((_, i) => i !== idx);
          await savePostsToRepo(next, tokenInp.value);
          setStatus('삭제했습니다.'); showPostList(next);
          if (isAdmin) adminToggle.hidden = false;
        } catch { setStatus('삭제하지 못했습니다.'); confirmBtn.disabled = false; }
      });
    };

    renderView();
  };

  // ── 게시판 열기 ──
  const openBoard = (board) => {
    selected = board;
    title.textContent = board.name;
    guide.textContent = board.description || (board.public ? '공개 게시판입니다.' : '암호화된 게시판입니다.');
    back.hidden = false; list.hidden = true;
    adminForm.hidden = true; newPostForm.hidden = true; setStatus('');
    if (!adminToggle.hidden) adminToggle.textContent = '+ 새 게시글';

    if (board.public) {
      posts.hidden = false; unlockForm.hidden = true;
      setStatus('게시글을 불러오는 중…');
      fetch(`${DATA_PATH}/${encodeURIComponent(board.id)}.json`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error('not found')))
        .then(data => { if (!Array.isArray(data.posts)) throw new Error('invalid'); showPostList(data.posts); })
        .catch(() => setStatus('게시글을 불러오지 못했습니다.'));
    } else {
      // Only the local Vite development server implements this endpoint.
      // Static deployments receive 404 and retain password-based decryption.
      fetch(`__local-board/${encodeURIComponent(board.id)}`, { cache: 'no-store' })
        .then(r => r.ok ? r.json() : Promise.reject(new Error('not local development')))
        .then(data => {
          if (!Array.isArray(data.posts)) throw new Error('invalid');
          posts.hidden = false; unlockForm.hidden = true;
          showPostList(data.posts);
        })
        .catch(() => { posts.hidden = true; unlockForm.hidden = false; pwInput.value = ''; pwInput.focus(); });
    }
  };

  // ── 게시판 카드 렌더 ──
  const render = () => {
    list.replaceChildren();
    if (!boards.length) {
      const empty = document.createElement('p'); empty.className = 'board-empty';
      empty.textContent = '아직 준비된 게시판이 없어요.'; list.append(empty); return;
    }
    boards.forEach((board) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'board-card';
      const icon = document.createElement('span'); icon.className = 'board-card-icon'; icon.textContent = '▤';
      const copy = document.createElement('span'); copy.className = 'board-card-copy';
      const name = document.createElement('strong'); name.textContent = board.name;
      const description = document.createElement('span'); description.textContent = board.description || '비밀번호가 필요한 게시판';
      const access = document.createElement('span'); access.className = 'board-access';
      access.textContent = board.public ? '공개' : '비밀번호';
      copy.append(name, description); button.append(icon, copy, access);
      button.addEventListener('click', () => openBoard(board));
      list.append(button);
    });
  };

  // ── 이벤트 리스너 ──
  back.addEventListener('click', () => {
    if (navLevel === 3) { showPostList(currentPosts); if (isAdmin) adminToggle.hidden = false; }
    else showList();
  });

  unlockForm.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!selected || !pwInput.value) return;
    setStatus('암호화된 게시글을 여는 중…');
    try {
      const response = await fetch(`${DATA_PATH}/${encodeURIComponent(selected.id)}.enc.json`, { cache: 'no-store' });
      if (!response.ok) throw new Error('not found');
      const content = await decrypt(await response.json(), pwInput.value);
      if (!Array.isArray(content.posts)) throw new Error('invalid content');
      unlockForm.hidden = true; pwInput.value = ''; posts.hidden = false;
      showPostList(content.posts); setStatus('');
    } catch { pwInput.value = ''; setStatus('비밀번호가 맞지 않거나 게시판을 불러오지 못했습니다.'); }
  });

  adminToggle.addEventListener('click', () => {
    if (navLevel >= 2) newPostForm.hidden = !newPostForm.hidden;
    else adminForm.hidden = !adminForm.hidden;
  });

  newPostForm.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!isAdmin || !selected) return;
    const data = new FormData(newPostForm);
    const postTitle = String(data.get('title')).trim();
    const postContent = String(data.get('content')).trim();
    const token = String(data.get('token'));
    if (!postTitle) { setStatus('제목을 입력해 주세요.'); return; }
    if (!postContent) { setStatus('내용을 입력해 주세요.'); return; }
    if (!token) { setStatus('GitHub 토큰을 입력해 주세요.'); return; }
    const submit = newPostForm.querySelector('button[type="submit"]');
    submit.disabled = true; setStatus('게시글을 등록하는 중…');
    try {
      const path = `boards/${selected.id}.json`;
      const file = await getPrivateFile(path, token);
      const boardData = JSON.parse(file.text);
      if (!Array.isArray(boardData.posts)) boardData.posts = [];
      boardData.posts.unshift({ title: postTitle, content: postContent, date: new Date().toISOString() });
      await savePrivateFile(path, `${JSON.stringify(boardData, null, 2)}\n`, `Add post to board: ${selected.id}`, token, file.sha);
      newPostForm.reset(); newPostForm.hidden = true;
      setStatus('등록했습니다. 잠시 후 반영됩니다.');
    } catch { setStatus('등록하지 못했습니다. 토큰을 확인해 주세요.'); }
    finally { submit.disabled = false; }
  });

  adminForm.querySelectorAll('input[name="boardType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const isPrivate = adminForm.querySelector('input[name="boardType"]:checked').value === 'private';
      const pwRow = document.getElementById('board-admin-password-row');
      const pwField = document.getElementById('board-admin-password');
      const mkRow = document.getElementById('board-admin-master-row');
      const mkField = document.getElementById('board-admin-master');
      pwRow.style.display = isPrivate ? '' : 'none'; pwField.required = isPrivate;
      mkRow.style.display = isPrivate ? '' : 'none'; mkField.required = isPrivate;
    });
  });

  adminForm.addEventListener('reset', () => {
    document.getElementById('board-admin-password-row').style.display = '';
    document.getElementById('board-admin-password').required = true;
    document.getElementById('board-admin-master-row').style.display = '';
    document.getElementById('board-admin-master').required = true;
  });

  adminForm.addEventListener('submit', async (event) => {
    event.preventDefault(); if (!isAdmin) { setStatus('관리자 로그인이 필요합니다.'); return; }
    const data = new FormData(adminForm);
    const isPublic = data.get('boardType') === 'public';
    const id = String(data.get('id')).trim();
    const name = String(data.get('name')).trim();
    const description = String(data.get('description')).trim();
    const password = String(data.get('password'));
    const masterKey = String(data.get('masterKey'));
    const token = String(data.get('token'));
    if (!/^[a-z0-9-]{1,40}$/.test(id)) { setStatus('게시판 ID는 영소문자·숫자·하이픈(-)만 사용할 수 있어요.'); return; }
    if (!name) { setStatus('게시판 이름을 입력해 주세요.'); return; }
    if (!isPublic && password.length < 16) { setStatus('비공개 게시판 비밀번호는 16자 이상이어야 해요.'); return; }
    if (!isPublic && !masterKey) { setStatus('마스터키를 입력해 주세요.'); return; }
    if (!token) { setStatus('GitHub 토큰을 입력해 주세요.'); return; }
    const submit = adminForm.querySelector('button[type="submit"]');
    submit.disabled = true;
    setStatus(isPublic ? 'private 저장소에 공개 게시판을 등록하는 중…' : 'private 저장소에 암호화된 게시판을 등록하는 중…');
    try {
      const manifestFile = await getPrivateFile('boards.json', token);
      const manifest = JSON.parse(manifestFile.text);
      const boardList = Array.isArray(manifest.boards) ? manifest.boards : [];
      if (boardList.some((board) => board.id === id)) throw new Error('duplicate');
      boardList.push({ id, name, description, ...(isPublic ? { public: true } : {}) });
      await savePrivateFile(`boards/${id}.json`, JSON.stringify({ posts: [] }, null, 2), `Create ${isPublic ? 'public' : 'encrypted'} board: ${id}`, token);
      await savePrivateFile('boards.json', `${JSON.stringify({ boards: boardList }, null, 2)}\n`, `Add board: ${id}`, token, manifestFile.sha);
      if (!isPublic) {
        const passwordFile = await getPrivateFile('passwords.enc.json', token, true);
        const passwords = passwordFile ? await decrypt(JSON.parse(passwordFile.text), masterKey) : {};
        passwords[id] = password;
        await savePrivateFile('passwords.enc.json', `${JSON.stringify(await encrypt(JSON.stringify(passwords, null, 2), masterKey))}\n`, `Set password for board: ${id}`, token, passwordFile?.sha);
      }
      adminForm.reset(); adminForm.hidden = true;
      setStatus('등록했습니다. private 저장소의 자동 배포가 시작됩니다.');
    } catch { setStatus('등록하지 못했습니다. 토큰 권한, 마스터키, 게시판 ID를 확인해 주세요.'); }
    finally { submit.disabled = false; }
  });

  const reload = () => {
    showList();
    fetch(`${DATA_PATH}/manifest.json`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('not found')))
      .then(data => { boards = Array.isArray(data.boards) ? data.boards.filter((board) => typeof board?.id === 'string' && typeof board?.name === 'string') : []; render(); })
      .catch(() => { setStatus('게시판을 준비 중이에요.'); render(); });
  };

  reload();
  return { reload, render, setAdmin: (enabled) => { isAdmin = enabled; adminToggle.hidden = !enabled; if (!enabled) { adminForm.hidden = true; newPostForm.hidden = true; } } };
}
