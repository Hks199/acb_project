const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const Model = require('../models/popupCampaignModel');
const validation = require('../helpers/popupValidation');
const { CustomError } = require('../errors/CustomErrorHandler');
const evaluate = (file, dependencies, extra = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { module, exports: module.exports, require: (name) => dependencies[name], ...extra });
  return module.exports;
};
const id = (n) => String(n).padStart(24, '0');
const defaults = { title: 'A special offer', ctaText: 'Shop now', ctaUrl: '/products', displayType: 'promotion', backgroundTheme: 'glass_dark', isActive: true };
function setup() {
  let sequence = 0, serial = Promise.resolve();
  const documents = new Map(), subscriptions = new Map(), uploads = [], events = [];
  function query(get) {
    let ordering = {}, maximum = Infinity;
    const result = () => {
      const value = get();
      return Array.isArray(value) ? [...value].sort((a, b) => {
        for (const [key, direction] of Object.entries(ordering)) { if (a[key] < b[key]) return -direction; if (a[key] > b[key]) return direction; }
        return 0;
      }).slice(0, maximum) : value;
    };
    const chain = { session() { return chain; }, sort(value) { ordering = value; return chain; }, limit(value) { maximum = value; return chain; }, select() { return chain; }, lean: async () => result(), then: (resolve, reject) => Promise.resolve(result()).then(resolve, reject) };
    return chain;
  }
  class Campaign {
    constructor(fields = {}) { Object.assign(this, { _id: id(++sequence), subtitle: '', imageUrl: '', couponCode: '', isActive: false, endsAt: null, displayType: 'promotion', backgroundTheme: 'glass_dark' }, fields); }
    set(key, value) { this[key] = value; }
    async save({ session }) { assert.ok(session); events.push('save'); documents.set(this._id, this); return this; }
    static findById(key) { return query(() => documents.get(key)); }
    static find(filter = {}) { return query(() => [...documents.values()].filter((row) => (!filter.isActive || row.isActive) && (!filter.$or || !row.endsAt || new Date(row.endsAt) > filter.$or[1].endsAt.$gt))); }
    static findOne() { const chain = this.find(); const get = chain.then; chain.then = (resolve, reject) => get((value) => resolve(value[0]), reject); return chain; }
    static async bulkWrite(operations, { session }) { assert.ok(session); operations.forEach(({ updateOne }) => Object.assign(documents.get(updateOne.filter._id), updateOne.update.$set)); }
    static async deleteOne(filter, { session }) { assert.ok(session); documents.delete(filter._id); }
  }
  const fakeMongoose = { Types: mongoose.Types, startSession: async () => ({ endSession: async () => {}, withTransaction: async (work) => {
    const running = serial.then(async () => {
      const backup = [...documents.values()].map((row) => ({ ...row }));
      try { await work(); } catch (error) { documents.clear(); backup.forEach((row) => documents.set(row._id, new Campaign(row))); throw error; }
    }); serial = running.catch(() => {}); return running;
  } }) };
  const controller = evaluate('controllers/popupCampaignController.js', {
    mongoose: fakeMongoose, '../models/popupCampaignModel': Campaign,
    '../models/popupCampaignLockModel': { updateOne: async (filter, update, options) => { events.push(options.session ? 'lock' : 'initialize'); } },
    '../models/popupSubscriptionModel': {
      updateOne: async (filter) => subscriptions.set(`${filter.campaignId}:${filter.email}`, { _id: id(subscriptions.size + 1), ...filter, createdAt: new Date() }),
      find: (filter) => query(() => [...subscriptions.values()].filter((row) => row.campaignId === filter.campaignId)),
    },
    '../helpers/s3BucketUploadHandler': { s3UploadHandler: async (file, folder) => { uploads.push({ file, folder }); return { publicUrl: 'https://example.com/image.jpg' }; } },
    '../errors/CustomErrorHandler': { CustomError }, '../helpers/popupValidation': validation,
  });
  return { documents, subscriptions, uploads, events, invoke: async (method, body, key, files) => {
    let data, error, status = 200;
    const response = { set() {}, status(value) { status = value; return this; }, json(value) { data = value; } };
    await controller[method]({ body, params: { id: key }, files }, response, (value) => { error = value; });
    return { data, error, status };
  } };
}
test('campaign CRUD supports multiple active popups, default priority, and excludes expired/paused campaigns', async () => {
  const app = setup();
  assert.equal((await app.invoke('active')).data.length, 0);
  const first = await app.invoke('create', defaults); assert.equal(first.status, 201); assert.equal(first.error, undefined);
  const second = (await app.invoke('create', { ...defaults, title: 'Second' })).data;
  assert.equal(first.data.priority_order, 1); assert.equal(second.priority_order, 2);
  assert.equal((await app.invoke('active')).data.length, 2);
  await app.invoke('update', { coupon_code: 'FIRST10', background_theme: 'glass_light' }, first.data._id);
  assert.equal(first.data.couponCode, 'FIRST10'); assert.equal(second.isActive, true);
  await app.invoke('toggle', { isActive: false }, second._id); assert.equal((await app.invoke('active')).data.length, 1);
  await app.invoke('create', { ...defaults, title: 'Expired', isActive: false, endsAt: new Date(Date.now() - 1000).toISOString() });
  await app.invoke('remove', {}, second._id); assert.equal((await app.invoke('list')).data.length, 2);
  assert.ok(app.events.indexOf('lock') < app.events.indexOf('save'));
});
test('reordering saves contiguous priorities atomically and rejects duplicates/incomplete queues', async () => {
  const app = setup();
  const first = (await app.invoke('create', defaults)).data;
  const second = (await app.invoke('create', { ...defaults, title: 'Second' })).data;
  assert.equal((await app.invoke('reorder', { campaignIds: [first._id, first._id] })).error.statusCode, 400);
  assert.equal((await app.invoke('reorder', { campaignIds: [first._id] })).error.statusCode, 409);
  const reordered = await app.invoke('reorder', { campaignIds: [second._id, first._id] });
  assert.equal(reordered.error, undefined);
  assert.equal(reordered.data.map((row) => row._id).join(','), `${second._id},${first._id}`);
  assert.equal(reordered.data.map((row) => row.priority_order).join(','), '1,2');
  assert.equal((await app.invoke('active')).data[0]._id, second._id);
});
test('invalid content, links, types, themes, dates and priorities cannot create a campaign', async () => {
  const app = setup();
  for (const fields of [{ title: '' }, { title: 'x'.repeat(121) }, { subtitle: 'x'.repeat(501) }, { ctaText: '' },
    { ctaUrl: 'javascript:alert(1)' }, { ctaUrl: '//example.com' }, { ctaUrl: '/\\example.com' }, { imageUrl: '/image.png' },
    { displayType: 'unknown' }, { backgroundTheme: 'unknown' }, { priority_order: 1.5 }, { priority_order: 0 },
    { isActive: 'true' }, { endsAt: 'bad-date' }, { endsAt: new Date(Date.now() - 1000).toISOString() }, { displayType: 'clearance_countdown' }]) {
    const result = await app.invoke('create', { ...defaults, ...fields }); assert.equal(result.error?.statusCode, 400, JSON.stringify(fields));
  }
  assert.equal(app.documents.size, 0);
  assert.equal(validation.validCtaUrl('/products?category=craft'), true);
  assert.equal(new Model(defaults).validateSync(), undefined);
  assert.ok(new Model({ ...defaults, priority_order: 1.5 }).validateSync());
});
test('newsletter signups persist normalized emails idempotently and reject unavailable campaigns', async () => {
  const app = setup();
  const newsletter = (await app.invoke('create', { ...defaults, displayType: 'newsletter_signup', ctaUrl: '' })).data;
  assert.equal((await app.invoke('subscribe', { email: ' TEST@Example.com ' }, newsletter._id)).data.success, true);
  await app.invoke('subscribe', { email: 'test@example.com' }, newsletter._id);
  assert.equal(app.subscriptions.size, 1);
  assert.equal((await app.invoke('subscriptions', {}, newsletter._id)).data[0].email, 'test@example.com');
  assert.equal((await app.invoke('subscribe', { email: 'bad' }, newsletter._id)).error.statusCode, 400);
  await app.invoke('toggle', { isActive: false }, newsletter._id);
  assert.equal((await app.invoke('subscribe', { email: 'other@example.com' }, newsletter._id)).error.statusCode, 400);
  const promotion = (await app.invoke('create', defaults)).data;
  assert.equal((await app.invoke('subscribe', { email: 'other@example.com' }, promotion._id)).error.statusCode, 400);
});
test('image uploads validate type/size and send a safe filename to the S3 folder', async () => {
  const app = setup();
  for (const files of [undefined, { image: { size: 10, mimetype: 'text/html' } }, { image: { size: 9 * 1024 * 1024, mimetype: 'image/png' } }]) {
    assert.equal((await app.invoke('upload', {}, null, files)).error.statusCode, 400);
  }
  assert.equal(app.uploads.length, 0);
  const uploaded = await app.invoke('upload', {}, null, { image: { name: '../unsafe.jpg', size: 20, mimetype: 'image/jpeg', data: Buffer.from('image') } });
  assert.equal(uploaded.status, 201); assert.equal(uploaded.data.imageUrl, 'https://example.com/image.jpg');
  assert.equal(app.uploads[0].folder, 'promotional-popups'); assert.match(app.uploads[0].file.name, /^[a-f0-9]{24}\.jpg$/);
});
test('all management, ordering, uploads and subscriber reads require a valid Admin JWT', async (t) => {
  const express = require('express'), jwt = require('jsonwebtoken');
  const secret = 'popup-tests-secret'; let role = 'Admin', requests = 0;
  const auth = evaluate('middlewares/auth.js', { jsonwebtoken: jwt, '../models/userModel': { findById: () => ({ select: async () => ({ role }) }) }, '../errors/CustomErrorHandler': { CustomError } }, { process: { env: { JWT_SECRET: secret } }, console });
  const ok = (req, res) => { requests++; res.json({ ok: true }); };
  const router = evaluate('routes/adminPopupCampaignRoutes.js', { express, '../middlewares/auth': auth, '../controllers/popupCampaignController': Object.fromEntries(['list', 'create', 'reorder', 'upload', 'subscriptions', 'update', 'toggle', 'remove'].map((key) => [key, ok])) });
  const app = express(); app.use('/api/admin/promotional-popups', router); app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/promotional-popups`;
  const token = jwt.sign({ id: id(1) }, secret);
  for (const [method, suffix] of [['GET', ''], ['POST', ''], ['PUT', '/reorder'], ['POST', '/upload-image'], ['GET', `/${id(1)}/subscriptions`], ['PUT', `/${id(1)}`], ['PATCH', `/${id(1)}/toggle`], ['DELETE', `/${id(1)}`]]) {
    assert.equal((await fetch(base + suffix, { method })).status, 401);
    role = 'Customer'; assert.equal((await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${token}` } })).status, 403);
    role = 'Admin'; assert.equal((await fetch(base + suffix, { method, headers: { Authorization: `Bearer ${token}` } })).status, 200);
  }
  assert.equal(requests, 8);
});

test('image layout options persist and reject unsupported fits, positions and visibility values', async () => {
  const app = setup();
  const created = await app.invoke('create', { ...defaults, image_fit: 'contain', image_position: 'top', show_image_on_mobile: true });
  assert.equal(created.error, undefined);
  assert.equal(created.data.imageFit, 'contain'); assert.equal(created.data.imagePosition, 'top'); assert.equal(created.data.showImageOnMobile, true);
  const updated = await app.invoke('update', { imageFit: 'cover', imagePosition: 'bottom', showImageOnMobile: false }, created.data._id);
  assert.equal(updated.data.imageFit, 'cover'); assert.equal(updated.data.showImageOnMobile, false);
  for (const fields of [{ imageFit: 'stretch' }, { imagePosition: 'invalid' }, { showImageOnMobile: 'false' }]) {
    assert.equal((await app.invoke('update', fields, created.data._id)).error.statusCode, 400);
  }
  const legacy = new Model(defaults);
  assert.equal(legacy.imageFit, 'cover'); assert.equal(legacy.imagePosition, 'center'); assert.equal(legacy.showImageOnMobile, true);
});
