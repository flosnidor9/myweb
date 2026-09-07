/**
 * passwords.enc.json 생성 유틸리티
 *
 * 사용법:
 *   1. .private-board-source/passwords.json 을 아래 형식으로 작성 (커밋 금지)
 *      { "board-id": "비밀번호(16자 이상)", ... }
 *   2. 환경변수 설정 후 실행
 *      BOARD_CONTENT_MASTER_KEY=<마스터키> node scripts/generate-passwords-enc.mjs
 *   3. 생성된 .private-board-source/passwords.enc.json 을 private 저장소에 커밋
 */

import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve(process.env.BOARD_SOURCE_DIR || '.private-board-source');
const masterKey = process.env.BOARD_CONTENT_MASTER_KEY;
const iterations = 300000;

if (!masterKey) {
  console.error('오류: BOARD_CONTENT_MASTER_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const passwordsPath = path.join(source, 'passwords.json');
if (!fs.existsSync(passwordsPath)) {
  console.error(`오류: ${passwordsPath} 파일이 없습니다.`);
  console.error('아래 형식으로 작성해 주세요:');
  console.error('  { "게시판-id": "비밀번호(16자 이상)", ... }');
  process.exit(1);
}

const passwords = JSON.parse(fs.readFileSync(passwordsPath, 'utf8'));

// boards.json과 대조해서 누락된 게시판 경고
const boardsPath = path.join(source, 'boards.json');
if (fs.existsSync(boardsPath)) {
  const { boards = [] } = JSON.parse(fs.readFileSync(boardsPath, 'utf8'));
  for (const board of boards) {
    if (!passwords[board.id]) {
      console.warn(`경고: '${board.id}' 게시판의 비밀번호가 없습니다.`);
    }
  }
}

// 비밀번호 최소 길이 검증
for (const [id, pw] of Object.entries(passwords)) {
  if (typeof pw !== 'string' || pw.length < 16) {
    console.error(`오류: '${id}' 비밀번호는 16자 이상이어야 합니다.`);
    process.exit(1);
  }
}

function encrypt(plaintext, password) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iterations,
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    ciphertext: encrypted.toString('hex'),
    authTag: cipher.getAuthTag().toString('hex'),
  };
}

const payload = encrypt(JSON.stringify(passwords), masterKey);
const outputPath = path.join(source, 'passwords.enc.json');
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`완료: ${outputPath} 생성됨`);
console.log('이 파일을 private 저장소에 커밋하세요.');
console.log('passwords.json 은 커밋하지 마세요 (gitignore에 추가 권장).');
