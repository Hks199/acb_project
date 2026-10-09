const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');
const Faq = require('../models/Faq');
const { CustomError } = require('../errors/CustomErrorHandler');
const { validateFaq } = require('../helpers/faqValidation');
const evaluate = (file, dependencies, extra = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, exports: module.exports, require: name => dependencies[name], ...extra,
  });
  return module.exports;
};

test('FAQ validation rejects blank content, wrong types, oversized text and invalid order', () => {
  for (const body of [null, [], {}, { question: ' ', answer: 'A' }, { question: 'Q', answer: '' },
    { question: 'Q'.repeat(301), answer: 'A' }, { question: 'Q', answer: 'A'.repeat(10001) },
    { question: 'Q', answer: 'A', isActive: 'false' }, { question: 'Q', answer: 'A', sortOrder: -1 },
    { question: 'Q', answer: 'A', sortOrder: 1.5 }, { question: 'Q', answer: 'A', sortOrder: '1' }]) {
    assert.throws(() => validateFaq(body), error => error.statusCode === 400);
  }
  assert.deepEqual(validateFaq({ question: ' Q ', answer: ' A\nB ', ignored: true }), { question: 'Q', answer: 'A\nB' });
  assert.deepEqual(validateFaq({ isActive: false }, true), { isActive: false });
  assert.throws(() => validateFaq({ $set: { isActive: true } }, true));
  assert.equal(Faq.collection.name, 'faqs');
  assert.equal(new Faq({ question: 'Q', answer: 'A' }).isActive, false);
  assert.ok(new Faq({ question: 'Q', answer: 'A', sortOrder: 0.5 }).validateSync());
});

test('HTTP lifecycle protects management and publishes only active FAQs in display order', async (t) => {
  const rows = new Map();
  let sequence = 0;
  const model = {
    async create(fields) {
      const row = { _id: String(++sequence).padStart(24, '0'), isActive: false, sortOrder: 0, ...fields };
      rows.set(row._id, row); return row;
    },
    find(filter) {
      let projection;
      const query = {
        select(value) { projection = value; return this; },
        sort(order) { assert.equal(order.sortOrder, 1); assert.equal(order._id, 1); return this; },
        async lean() {
          return [...rows.values()].filter(row => !filter.isActive || row.isActive)
            .sort((a, b) => a.sortOrder - b.sortOrder || a._id.localeCompare(b._id))
            .map(row => projection ? { _id: row._id, question: row.question, answer: row.answer, sortOrder: row.sortOrder } : { ...row });
        },
      };
      return query;
    },
    async findByIdAndUpdate(id, update, options) {
      assert.equal(options.runValidators, true);
      const row = rows.get(id);
      if (!row) return null;
      Object.assign(row, update.$set); return row;
    },
    async findByIdAndDelete(id) { const row = rows.get(id); rows.delete(id); return row; },
  };
  const controller = evaluate('controllers/faqController.js', {
    '../models/Faq': model, '../errors/CustomErrorHandler': { CustomError }, '../helpers/faqValidation': { validateFaq },
  });
  const auth = evaluate('middlewares/auth.js', {
    jsonwebtoken: jwt, '../models/userModel': { findById: id => ({ select: async () => ({ role: id === 'admin' ? 'Admin' : 'Customer' }) }) },
    '../errors/CustomErrorHandler': { CustomError },
  }, { process: { env: { JWT_SECRET: 'faq-test-secret' } }, console });
  const adminRouter = evaluate('routes/adminFaqRoutes.js', {
    express, '../middlewares/auth': auth, '../controllers/faqController': controller,
  });
  const publicRouter = evaluate('routes/faqRoutes.js', { express, '../controllers/faqController': controller });
  const app = express();
  app.use(express.json()); app.use('/api/faqs', publicRouter); app.use('/api/admin/faqs', adminRouter);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (url, method = 'GET', body, role = 'admin') => {
    const headers = { 'Content-Type': 'application/json' };
    if (role) headers.Authorization = `Bearer ${jwt.sign({ id: role }, 'faq-test-secret')}`;
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
  };
  for (const [method, suffix] of [['GET', ''], ['POST', ''], ['PUT', '/000000000000000000000001'], ['DELETE', '/000000000000000000000001']]) {
    assert.equal((await request('/api/admin/faqs' + suffix, method, undefined, null)).status, 401);
    assert.equal((await request('/api/admin/faqs' + suffix, method, undefined, 'customer')).status, 403);
  }
  const empty = await request('/api/faqs', 'GET', undefined, null);
  assert.deepEqual(empty.data, []); assert.equal(empty.cache, 'no-store');
  const draft = await request('/api/admin/faqs', 'POST', { question: 'Draft', answer: 'Hidden' });
  assert.equal(draft.status, 201);
  const first = (await request('/api/admin/faqs', 'POST', { question: 'Later', answer: 'A', isActive: true, sortOrder: 5 })).data;
  const second = (await request('/api/admin/faqs', 'POST', { question: 'Earlier', answer: 'B', isActive: true, sortOrder: 1 })).data;
  assert.deepEqual((await request('/api/faqs')).data.map(row => row._id), [second._id, first._id]);
  assert.equal((await request('/api/admin/faqs')).data.length, 3);
  await request(`/api/admin/faqs/${first._id}`, 'PUT', { question: 'Updated question', answer: 'Updated answer\nLine two', sortOrder: 0 });
  const updated = (await request('/api/faqs')).data[0];
  assert.equal(updated.question, 'Updated question'); assert.equal(updated.answer, 'Updated answer\nLine two');
  assert.equal((await request(`/api/admin/faqs/${first._id}`, 'PUT', { answer: ' ' })).status, 400);
  assert.equal((await request('/api/admin/faqs/invalid', 'DELETE')).status, 400);
  assert.equal((await request('/api/admin/faqs/999999999999999999999999', 'PUT', { isActive: true })).status, 404);
  await request(`/api/admin/faqs/${first._id}`, 'PUT', { isActive: false });
  assert.equal((await request('/api/faqs')).data.length, 1);
  assert.equal((await request(`/api/admin/faqs/${second._id}`, 'DELETE')).status, 200);
  assert.deepEqual((await request('/api/faqs')).data, []);
  assert.equal((await request(`/api/admin/faqs/${second._id}`, 'DELETE')).status, 404);
});
