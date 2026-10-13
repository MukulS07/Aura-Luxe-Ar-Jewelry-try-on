// Dependency-free backend: catalog, uploads, expiring photo links. Default-deny; admin routes need ADMIN_TOKEN.
import http from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync, statSync } from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';

const PORT = Number(process.env.PORT ?? 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? ''; // no default: admin disabled when unset
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? ''; // URL a visitor's phone can reach (TODO(confirm))
const RETENTION_HOURS = Number(process.env.PHOTO_TTL_HOURS ?? 24); // TODO(confirm) retention
const MAX_PHOTO = 5 * 1024 * 1024;
const MAX_UPLOAD = 8 * 1024 * 1024; // TODO(confirm) "few MB" cap for .glb
const DATA = resolve('data'), PHOTOS = join(DATA, 'photos'), UPLOADS = join(DATA, 'uploads'), DIST = resolve('dist');
const CATALOG = join(DATA, 'catalog.json');
[PHOTOS, UPLOADS].forEach((d) => mkdirSync(d, { recursive: true }));
if (!existsSync(CATALOG)) writeFileSync(CATALOG, readFileSync('public/catalog.json'));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.wasm': 'application/wasm', '.task': 'application/octet-stream', '.svg': 'image/svg+xml' };
const UP_EXT = new Set(['.glb', '.jpg', '.jpeg', '.png', '.webp']);

const send = (res, code, body, type = 'application/json', extra = {}) => {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const isAdmin = (req) => {
  if (!ADMIN_TOKEN) return false;
  const got = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer /, ''));
  const want = Buffer.from(ADMIN_TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
};
const readBody = (req, max) => new Promise((ok, fail) => {
  const chunks = []; let n = 0;
  req.on('data', (c) => { n += c.length; if (n > max) { fail(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => ok(Buffer.concat(chunks)));
  req.on('error', fail);
});
const meta = (id) => { try { return JSON.parse(readFileSync(join(PHOTOS, `${id}.json`), 'utf8')); } catch { return null; } };
const validPhoto = (id, t) => {
  if (!/^[a-f0-9]{16}$/.test(id)) return null;
  const m = meta(id);
  if (!m || Date.now() > m.expires || !t || t.length !== m.token.length || !timingSafeEqual(Buffer.from(t), Buffer.from(m.token))) return null;
  return m;
};
const removePhoto = (id) => [`${id}.jpg`, `${id}.json`].forEach((f) => { try { unlinkSync(join(PHOTOS, f)); } catch { /* already gone */ } });
const sweep = () => { for (const f of readdirSync(PHOTOS)) if (f.endsWith('.json')) { const id = f.slice(0, -5); const m = meta(id); if (!m || Date.now() > m.expires) removePhoto(id); } };
sweep(); setInterval(sweep, 10 * 60 * 1000).unref();

const serveFile = (res, path, extra = {}) => {
  if (!existsSync(path) || !statSync(path).isFile()) return send(res, 404, { error: 'not found' });
  res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream', ...extra });
  createReadStream(path).pipe(res);
};
const safeJoin = (root, rel) => { const p = normalize(join(root, rel)); return p.startsWith(root) ? p : null; };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const path = decodeURIComponent(url.pathname);
    const base = PUBLIC_BASE_URL || `http://${req.headers.host}`;

    if (path === '/api/config') return send(res, 200, { retentionHours: RETENTION_HOURS, publicBase: base, adminEnabled: !!ADMIN_TOKEN });
    if (path === '/api/catalog' && req.method === 'GET') {
      const all = JSON.parse(readFileSync(CATALOG, 'utf8'));
      return send(res, 200, isAdmin(req) && url.searchParams.has('all') ? all : all.filter((i) => i.active));
    }
    if (path === '/api/catalog' && req.method === 'PUT') {
      if (!isAdmin(req)) return send(res, 401, { error: 'unauthorised' });
      const list = JSON.parse((await readBody(req, 1e6)).toString());
      if (!Array.isArray(list) || list.some((i) => !i.id || !i.name || !['earrings', 'necklace'].includes(i.type) || !i.model)) return send(res, 400, { error: 'Catalog entry missing id, name, type or model.' });
      writeFileSync(CATALOG, JSON.stringify(list, null, 2));
      return send(res, 200, { ok: true });
    }
    if (path === '/api/upload' && req.method === 'POST') {
      if (!isAdmin(req)) return send(res, 401, { error: 'unauthorised' });
      const name = (url.searchParams.get('name') ?? '').replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!UP_EXT.has(extname(name).toLowerCase())) return send(res, 400, { error: 'File type not allowed.' });
      const body = await readBody(req, MAX_UPLOAD).catch(() => null);
      if (!body) return send(res, 413, { error: 'Model is larger than the allowed size.' });
      writeFileSync(join(UPLOADS, name), body);
      return send(res, 200, { path: `/uploads/${name}` });
    }
    if (path.startsWith('/uploads/')) { const p = safeJoin(UPLOADS, path.slice(9)); return p ? serveFile(res, p, { 'Cache-Control': 'public, max-age=3600' }) : send(res, 400, {}); }

    if (path === '/api/photos' && req.method === 'POST') {
      const body = await readBody(req, MAX_PHOTO).catch(() => null);
      if (!body || body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8) return send(res, 400, { error: 'JPEG photo required (max 5 MB).' });
      const id = randomBytes(8).toString('hex'), token = randomBytes(16).toString('hex');
      const expires = Date.now() + RETENTION_HOURS * 3600e3;
      writeFileSync(join(PHOTOS, `${id}.jpg`), body);
      writeFileSync(join(PHOTOS, `${id}.json`), JSON.stringify({ token, expires }));
      return send(res, 200, { id, token, expires, url: `${base}/share.html?p=${id}&t=${token}` });
    }
    const m = path.match(/^\/api\/photos\/([a-f0-9]{16})(\/meta)?$/);
    if (m) {
      const info = validPhoto(m[1], url.searchParams.get('t'));
      if (!info) return send(res, 404, { error: 'gone' }, 'application/json', { 'X-Robots-Tag': 'noindex' });
      if (req.method === 'DELETE') { removePhoto(m[1]); return send(res, 200, { ok: true }); }
      if (m[2]) return send(res, 200, { expires: info.expires }, 'application/json', { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' });
      return serveFile(res, join(PHOTOS, `${m[1]}.jpg`), { 'X-Robots-Tag': 'noindex', 'Cache-Control': 'no-store' });
    }
    if (path.startsWith('/api/')) return send(res, 404, { error: 'not found' });

    // static app (production build)
    const rel = path === '/' ? '/index.html' : path;
    let p = safeJoin(DIST, rel);
    if (!p || !existsSync(p)) p = safeJoin(DIST, '/index.html');
    return p ? serveFile(res, p) : send(res, 404, 'not found', 'text/plain');
  } catch {
    send(res, 500, { error: 'server error' });
  }
}).listen(PORT, () => console.log(`API on :${PORT} · admin ${ADMIN_TOKEN ? 'enabled' : 'DISABLED (set ADMIN_TOKEN)'}`));
