import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { buildEncryptedBoards, source } from './build-encrypted-boards.mjs';

let rebuilding = false;
let rebuildQueued = false;
let timer;

function rebuild(server) {
  if (rebuilding) { rebuildQueued = true; return; }
  rebuilding = true;
  try {
    buildEncryptedBoards({ localBypass: true });
    server.ws.send({ type: 'full-reload' });
  } catch (error) {
    // Do not print configuration values or decrypted board data.
    console.error(`게시판 생성 실패: ${error.message}`);
  } finally {
    rebuilding = false;
    if (rebuildQueued) { rebuildQueued = false; rebuild(server); }
  }
}

buildEncryptedBoards({ localBypass: true });
const localBoardMiddleware = (req, res, next) => {
  const id = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
  if (!/^[a-z0-9-]{1,40}$/.test(id)) return next();
  const contentPath = path.join(source, 'boards', `${id}.json`);
  if (!fs.existsSync(contentPath)) return next();
  try {
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    if (!Array.isArray(content.posts)) throw new Error('invalid board content');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(content));
  } catch {
    res.statusCode = 500;
    res.end();
  }
};
const server = await createServer({
  plugins: [{
    name: 'local-private-board-reader',
    configureServer(viteServer) {
      // Plugin middleware runs before Vite's SPA fallback.
      viteServer.middlewares.use('/__local-board', localBoardMiddleware);
    },
  }],
});
await server.listen();
server.printUrls();

if (fs.existsSync(source)) {
  fs.watch(source, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(server), 150);
  });
  console.log(`게시판 원본 변경을 감지합니다: ${source}`);
}

const close = async () => { await server.close(); process.exit(0); };
process.once('SIGINT', close);
process.once('SIGTERM', close);
