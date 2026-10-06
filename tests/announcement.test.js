const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const Announcement = require('../models/announcementModel');
const { validateAnnouncement, validTargetUrl } = require('../helpers/announcementValidation');
const { CustomError } = require('../errors/CustomErrorHandler');
const evaluate = (file, dependencies, extra = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, exports: module.exports, require: (name) => dependencies[name], ...extra,
  });
  return module.exports;
};
const id = (n) => String(n).padStart(24, '0');
function setup() {
  const rows = new Map();
  const events = [];
  let sequence = 0;
  let failSave = false;
  let queue = Promise.resolve();
  class Model {
    constructor(fields = {}) { Object.assign(this, { _id: id(++sequence), text: '', badge: { type: 'info', text: '' }, isActive: false, targetUrl: '' }, fields); }
    set(key, value) {
      if (key.startsWith('badge.')) this.badge[key.slice(6)] = value;
      else this[key] = value;
    }
    async save({ session }) {
      assert.ok(session); events.push('save');
      if (failSave) throw new Error('Simulated write failure');
      rows.set(this._id, this); return this;
    }
    static findById(key) { return { session: async (session) => { assert.ok(session); events.push('read'); return rows.get(key); } }; }
    static async updateMany() { throw new Error('Announcements must not deactivate each other'); }
    static find(filter = {}) { return { sort: (order) => ({ lean: async () => {
      if (filter.isActive) {
        assert.equal(order.createdAt, 1); assert.equal(order._id, 1);
        return [...rows.values()].filter((row) => row.isActive).sort((a, b) => a._id.localeCompare(b._id));
      }
      return [...rows.values()];
    } }) }; }
  }
  const Lock = { updateOne: async (filter, update, options) => { events.push(options.session ? 'lock' : 'initialize'); } };
  const fakeMongoose = { startSession: async () => {
    const session = { endSession: async () => events.push('end'), withTransaction: async (work) => {
      const run = queue.then(async () => {
        const backup = [...rows.values()].map((row) => JSON.parse(JSON.stringify(row)));
        try { await work(); }
        catch (error) { rows.clear(); backup.forEach((row) => rows.set(row._id, new Model(row))); throw error; }
      });
      queue = run.catch(() => {}); return run;
    } }; return session;
  } };
  const controller = evaluate('controllers/announcementController.js', {
    mongoose: fakeMongoose, '../models/announcementModel': Model, '../models/announcementLockModel': Lock,
    '../errors/CustomErrorHandler': { CustomError }, '../helpers/announcementValidation': { validateAnnouncement },
  });
  return { rows, events, fail: () => { failSave = true; }, invoke: async (method, body, key) => {
    let data, error, status = 200;
    const response = { set() {}, status(value) { status = value; return this; }, json(value) { data = value; } };
    await controller[method]({ body, params: { id: key } }, response, (value) => { error = value; });
    return { data, error, status };
  } };
}
test('public endpoint returns an empty array or all active documents in stable creation order', async () => {
  const app = setup();
  assert.equal((await app.invoke('getActive')).data.length, 0);
  const created = await app.invoke('create', { text: 'Free shipping!', badge: { type: 'offer', text: 'OFFER' }, isActive: true });
  assert.equal(created.status, 201);
  assert.equal(created.error, undefined);
  const second = (await app.invoke('create', { text: 'New launch', isActive: true })).data;
  await app.invoke('create', { text: 'Hidden' });
  await app.invoke('update', { text: 'Updated shipping' }, created.data._id);
  const active = (await app.invoke('getActive')).data;
  assert.equal(active.map((row) => row._id).join(','), [created.data._id, second._id].join(','));
  assert.equal(active[0].text, 'Updated shipping');
  assert.equal((await app.invoke('getAll')).data.length, 3);
});

test('create, update and toggle preserve other active announcements and support explicit status', async () => {
  const app = setup();
  const first = (await app.invoke('create', { text: 'First', isActive: true })).data;
  const second = (await app.invoke('create', { text: 'Second', isActive: true })).data;
  assert.equal(first.isActive, true); assert.equal(second.isActive, true);
  await app.invoke('update', { is_active: true, badge_text: 'HOT', badge_type: 'alert', target_url: 'https://example.com/sale' }, first._id);
  assert.equal(first.badge.text, 'HOT'); assert.equal(second.isActive, true);
  await app.invoke('toggle', {}, second._id);
  assert.equal(first.isActive, true); assert.equal(second.isActive, false);
  await app.invoke('toggle', { isActive: true }, second._id);
  await app.invoke('toggle', { isActive: true }, second._id);
  assert.equal((await app.invoke('getActive')).data.length, 2);
  await app.invoke('toggle', { isActive: false }, second._id);
  await app.invoke('toggle', { isActive: false }, first._id);
  assert.equal((await app.invoke('getActive')).data.length, 0);
});

test('concurrent activations retain both active documents; same-document toggles serialize', async () => {
  const app = setup();
  const first = (await app.invoke('create', { text: 'One' })).data;
  const second = (await app.invoke('create', { text: 'Two' })).data;
  app.events.length = 0;
  const results = await Promise.all([app.invoke('toggle', {}, first._id), app.invoke('toggle', {}, second._id)]);
  results.forEach((result) => assert.equal(result.error, undefined));
  assert.equal([...app.rows.values()].filter((row) => row.isActive).length, 2);
  assert.deepEqual(app.events.filter((event) => !['initialize', 'end'].includes(event)), ['lock', 'read', 'save', 'lock', 'read', 'save']);
  await Promise.all([app.invoke('toggle', {}, first._id), app.invoke('toggle', {}, first._id)]);
  assert.equal(first.isActive, true); assert.equal(second.isActive, true);
});

test('failed activation and invalid or missing IDs preserve existing visibility', async () => {
  const app = setup();
  const first = (await app.invoke('create', { text: 'One', isActive: true })).data;
  const second = (await app.invoke('create', { text: 'Two' })).data;
  assert.equal((await app.invoke('toggle', {}, 'bad-id')).error.statusCode, 400);
  assert.equal((await app.invoke('toggle', {}, id(999))).error.statusCode, 404);
  app.fail();
  assert.match((await app.invoke('toggle', {}, second._id)).error.message, /write failure/);
  const active = (await app.invoke('getActive')).data;
  assert.equal(active.length, 1); assert.equal(active[0]._id, first._id);
});
test('reject invalid text, badge styles, labels, booleans, and unsafe action URLs before writes', async () => {
  const app = setup();
  for (const change of [{ text: '' }, { text: ' '.repeat(5) }, { text: 'a'.repeat(256) }, { text: 1 },
    { badge: { text: 'x'.repeat(16) } }, { badge: { type: 'unknown' } }, { badge: null },
    { isActive: 'true' }, { targetUrl: 'javascript:alert(1)' }, { targetUrl: '//example.com' },
    { targetUrl: 'https://user:password@example.com' }]) {
    assert.equal((await app.invoke('create', { text: 'Valid', ...change })).error.statusCode, 400);
  }
  assert.equal(app.rows.size, 0);
  assert.equal(app.events.length, 0);
  assert.equal(validTargetUrl('https://example.com/products?q=offers'), true);
  assert.equal(validTargetUrl(''), true);
  assert.equal(validTargetUrl('ftp://example.com'), false);
});
test('Mongo schema independently enforces lengths, style enum and URL protocol', () => {
  assert.equal(new Announcement({ text: 'x'.repeat(255), badge: { type: 'new_launch', text: 'x'.repeat(15) } }).validateSync(), undefined);
  for (const fields of [{ text: 'x'.repeat(256) }, { badge: { text: 'x'.repeat(16) } }, { badge: { type: 'invalid' } }, { targetUrl: 'javascript:alert(1)' }]) {
    assert.ok(new Announcement({ text: 'Valid', ...fields }).validateSync());
  }
});

test('every management endpoint rejects anonymous/customer access and accepts signed admin JWTs', async (t) => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const secret = 'announcement-test-secret';
  let role = 'Admin', writes = 0;
  const auth = evaluate('middlewares/auth.js', {
    jsonwebtoken: jwt, '../models/userModel': { findById: () => ({ select: async () => ({ role }) }) },
    '../errors/CustomErrorHandler': { CustomError },
  }, { process: { env: { JWT_SECRET: secret } }, console });
  const ok = (req, res) => { writes++; res.json({ ok: true }); };
  const router = evaluate('routes/adminAnnouncementRoutes.js', {
    express, '../middlewares/auth': auth, '../controllers/announcementController': { getAll: ok, create: ok, update: ok, toggle: ok },
  });
  const app = express(); app.use('/api/admin/announcements', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/announcements`;
  for (const [method, suffix] of [['GET', ''], ['POST', ''], ['PUT', `/${id(1)}`], ['PATCH', `/${id(1)}/toggle`]]) {
    assert.equal((await fetch(base + suffix, { method })).status, 401);
    role = 'Customer';
    const token = jwt.sign({ id: id(1) }, secret);
    assert.equal((await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${token}` } })).status, 403);
    role = 'Admin';
    assert.equal((await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${token}` } })).status, 200);
  }
  assert.equal(writes, 4);
  assert.equal((await fetch(base, { headers: { Authorization: 'Bearer forged' } })).status, 400);
});

test('admin login issues a verifiable JWT only for verified admin accounts with valid credentials', async (t) => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  let user = { _id: id(1), password: 'hashed-test-password', role: 'Admin', isOtpVerify: true };
  const secret = 'admin-login-test-secret';
  const router = evaluate('routes/adminAuthRoutes.js', {
    express, bcrypt: { compare: async (password) => password === 'test-password' }, jsonwebtoken: jwt,
    '../models/userModel': { findOne: async () => user }, '../errors/CustomErrorHandler': { CustomError },
    '../middlewares/auth': { authMiddleware: (req, res, next) => next(), roleMiddleware: () => (req, res, next) => next() },
  }, { process: { env: { JWT_SECRET: secret } } });
  const app = express(); app.use(express.json()); app.use('/api/admin', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const login = (body) => fetch(`http://127.0.0.1:${server.address().port}/api/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const response = await login({ identifier: 'test@example.com', password: 'test-password' });
  assert.equal(response.status, 200);
  assert.equal(jwt.verify((await response.json()).token, secret).id, id(1));
  assert.equal((await login({ identifier: 'test@example.com', password: 'incorrect' })).status, 401);
  user.role = 'Customer'; assert.equal((await login({ identifier: 'test@example.com', password: 'test-password' })).status, 401);
  user.role = 'Admin'; user.isOtpVerify = false;
  assert.equal((await login({ identifier: 'test@example.com', password: 'test-password' })).status, 403);
  assert.equal((await login({ identifier: { $ne: null }, password: 'test-password' })).status, 400);
});
