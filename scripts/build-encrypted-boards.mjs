import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const siblingPrivateSource = path.resolve('..', 'myweb-private');
const fallbackPrivateSource = path.resolve('.private-board-source');
export const source = path.resolve(process.env.BOARD_SOURCE_DIR || (fs.existsSync(siblingPrivateSource) ? siblingPrivateSource : fallbackPrivateSource));
const output = path.resolve('board-data');
const masterKey = process.env.BOARD_CONTENT_MASTER_KEY;
const iterations = 300000;
fs.mkdirSync(output, { recursive: true });

function writeManifest(boards) { fs.writeFileSync(path.join(output, 'manifest.json'), `${JSON.stringify({ boards }, null, 2)}\n`); }
function decrypt(payload, password) {
  const key = pbkdf2Sync(password, Buffer.from(payload.salt, 'hex'), 300000, 32, 'sha256');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'hex')); decipher.setAuthTag(Buffer.from(payload.authTag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'hex')), decipher.final()]).toString('utf8');
}
function encrypt(plaintext, password) {
  const salt = randomBytes(16); const iv = randomBytes(12); const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv); const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { iterations, salt: salt.toString('hex'), iv: iv.toString('hex'), ciphertext: encrypted.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

export function buildEncryptedBoards({ localBypass = false } = {}) {
  if (!fs.existsSync(source)) { writeManifest([]); console.log('비공개 게시판 소스가 없어 빈 게시판 목록을 생성했습니다.'); return; }
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(source, 'boards.json'), 'utf8'));
  const boards = Array.isArray(sourceManifest.boards) ? sourceManifest.boards : [];
  if (boards.length === 0) { writeManifest([]); console.log('등록된 게시판이 없어 빈 게시판 목록을 생성했습니다.'); return; }
  const hasPrivateBoards = boards.some((b) => !b.public);
  if (hasPrivateBoards && !masterKey && !localBypass) throw new Error('BOARD_CONTENT_MASTER_KEY가 필요합니다.');
  const passwords = hasPrivateBoards && !localBypass ? JSON.parse(decrypt(JSON.parse(fs.readFileSync(path.join(source, 'passwords.enc.json'), 'utf8')), masterKey)) : {};
  const publicBoards = [];
  for (const board of boards) {
    if (!/^[a-z0-9-]{1,40}$/.test(board?.id) || typeof board.name !== 'string' || typeof board.description !== 'string') throw new Error('boards.json 게시판 형식이 올바르지 않습니다.');
    const contentPath = path.join(source, 'boards', `${board.id}.json`); const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    if (!Array.isArray(content.posts)) throw new Error(`${board.id} 게시판 콘텐츠 형식이 올바르지 않습니다.`);
    if (board.public) {
      fs.writeFileSync(path.join(output, `${board.id}.json`), `${JSON.stringify(content, null, 2)}\n`);
      publicBoards.push({ id: board.id, name: board.name.slice(0, 40), description: board.description.slice(0, 160), public: true });
    } else if (!localBypass) {
      const password = passwords[board.id]; if (typeof password !== 'string' || password.length === 0) throw new Error(`${board.id} 게시판의 비밀번호를 입력해야 합니다.`);
      fs.writeFileSync(path.join(output, `${board.id}.enc.json`), `${JSON.stringify(encrypt(JSON.stringify(content), password))}\n`);
      publicBoards.push({ id: board.id, name: board.name.slice(0, 40), description: board.description.slice(0, 160) });
    } else {
      // Local development serves private content from the Vite process only.
      publicBoards.push({ id: board.id, name: board.name.slice(0, 40), description: board.description.slice(0, 160) });
    }
  }
  writeManifest(publicBoards); console.log(`${publicBoards.length}개 게시판을 처리했습니다.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) buildEncryptedBoards();
