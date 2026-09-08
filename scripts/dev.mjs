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
const stickerRoot = path.resolve('public', 'stickers');
const stickerManifest = path.join(stickerRoot, 'stickers.json');
const windowLayoutManifest = path.resolve('public', 'window-layout.json');
const windowIds = new Set(['win-profile', 'win-stickers', 'win-clock', 'win-welcome', 'win-diary', 'win-board', 'win-typing', 'win-guestbook', 'win-music']);
const validSticker = (item) => item && typeof item === 'object'
  && typeof item.id === 'string' && /^[a-z0-9-]{20,80}$/i.test(item.id)
  && typeof item.imageUrl === 'string' && /^\/stickers\/[a-zA-Z0-9._-]{1,140}$/.test(item.imageUrl)
  && typeof item.alt === 'string' && item.alt.length <= 80
  && (item.mediaType === 'image' || item.mediaType === 'video')
  && typeof item.attachedTo === 'string' && item.attachedTo.length <= 40
  && Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isFinite(item.size) && Number.isFinite(item.rotation) && Number.isInteger(item.mobileOrder);
const localStickerMiddleware = (req, res, next) => {
  if (req.method !== 'POST' || req.url.split('?')[0] !== '/__local-stickers') return next();
  let size = 0; const chunks = [];
  req.on('data', (chunk) => { size += chunk.length; if (size <= 22 * 1024 * 1024) chunks.push(chunk); });
  req.on('end', () => {
    if (size > 22 * 1024 * 1024) { res.statusCode = 413; return res.end(); }
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!Array.isArray(payload.stickers) || !Array.isArray(payload.files) || !payload.stickers.every(validSticker)) throw new Error('invalid sticker payload');
      fs.mkdirSync(stickerRoot, { recursive: true });
      for (const file of payload.files) {
        if (!file || typeof file.name !== 'string' || !/^[a-zA-Z0-9._-]{1,140}$/.test(file.name) || typeof file.data !== 'string') throw new Error('invalid sticker file');
        const buffer = Buffer.from(file.data, 'base64');
        const video = file.name.endsWith('.mp4'); const image = /\.(png|jpe?g|gif|apng)$/i.test(file.name);
        if ((!video && !image) || buffer.length === 0 || buffer.length > (video ? 15 : 5) * 1024 * 1024) throw new Error('invalid sticker media');
        fs.writeFileSync(path.join(stickerRoot, file.name), buffer);
      }
      fs.writeFileSync(stickerManifest, `${JSON.stringify({ stickers: payload.stickers }, null, 2)}\n`, 'utf8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end('{"ok":true}'); server.ws.send({ type: 'full-reload' });
    } catch { res.statusCode = 400; res.end(); }
  });
};
const cleanWindowLayout = (windows) => {
  if (!windows || typeof windows !== 'object' || Array.isArray(windows)) return null;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const cleaned = {};
  for (const [id, item] of Object.entries(windows)) {
    if (!windowIds.has(id) || !item || typeof item !== 'object') continue;
    if (![item.x, item.y].every(Number.isFinite)) continue;
    if (id !== 'win-typing' && ![item.width, item.height].every(Number.isFinite)) continue;
    cleaned[id] = {
      x: clamp(item.x, 0, 1), y: clamp(item.y, 0, 1),
    };
    if (id !== 'win-typing') {
      cleaned[id].width = Math.round(clamp(item.width, 160, 10000));
      cleaned[id].height = Math.round(clamp(item.height, 110, 10000));
    }
  }
  return cleaned;
};
const localWindowLayoutMiddleware = (req, res, next) => {
  if (req.method !== 'POST' || req.url.split('?')[0] !== '/__local-window-layout') return next();
  let size = 0; const chunks = [];
  req.on('data', (chunk) => { size += chunk.length; if (size <= 16 * 1024) chunks.push(chunk); });
  req.on('end', () => {
    if (size > 16 * 1024) { res.statusCode = 413; return res.end(); }
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const windows = cleanWindowLayout(payload.windows);
      if (!windows) throw new Error('invalid layout');
      fs.writeFileSync(windowLayoutManifest, `${JSON.stringify({ windows }, null, 2)}\n`, 'utf8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end('{"ok":true}'); server.ws.send({ type: 'full-reload' });
    } catch { res.statusCode = 400; res.end(); }
  });
};
const server = await createServer({
  plugins: [{
    name: 'local-private-board-reader',
    configureServer(viteServer) {
      // Plugin middleware runs before Vite's SPA fallback.
      viteServer.middlewares.use('/__local-board', localBoardMiddleware);
      viteServer.middlewares.use(localStickerMiddleware);
      viteServer.middlewares.use(localWindowLayoutMiddleware);
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
