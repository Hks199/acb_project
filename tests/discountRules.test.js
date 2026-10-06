const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { calculatePricing } = require('../helpers/calculatePricing');
const DiscountRule = require('../models/DiscountRule');
const { CustomError } = require('../errors/CustomErrorHandler');
const { validateRuleUpdate } = require('../helpers/discountRules');

const evaluate = (file, dependencies, extra = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, exports: module.exports, require: (name) => dependencies[name], ...extra,
  });
  return module.exports;
};

const rules = (first = {}, milestone = {}) => [
  { ruleKey: 'first_order_discount', discountPercentage: 10, minPurchaseAmount: null, isActive: true, ...first },
  { ruleKey: 'milestone_discount', discountPercentage: 5, minPurchaseAmount: 4999, isActive: true, ...milestone },
];
const price = (amount, discountRules, isFirstOrder = true, extra = {}) => calculatePricing({
  items: [{ productId: 'product', quantity: 1, unitPrice: amount }], discountRules, isFirstOrder, ...extra,
});

test('milestone boundary is inclusive; both configured percentages stack on the offer-adjusted total', () => {
  assert.equal(price(4998.99, rules()).addition_discount, 0);
  assert.equal(price(4999, rules()).addition_discount, 249.95);
  assert.equal(price(5000, rules()).subtotal, 4250);
  assert.equal(price(5000, rules(), false).subtotal, 4750);
  const changed = rules({ discountPercentage: 12 }, { discountPercentage: 7, minPurchaseAmount: 3999 });
  assert.equal(price(3999, changed).subtotal, 3239.19);
  assert.equal(price(5000, rules({ isActive: false }, { isActive: false })).subtotal, 5000);
  assert.equal(price(5000, []).subtotal, 5000);
  assert.equal(price(5000, rules({ discountPercentage: 0 }, { discountPercentage: 0 })).subtotal, 5000);
});

test('milestone uses product-promoted total before percentage rewards; caps prevent negative charges', () => {
  const result = price(6000, rules(), true, { promotions: [{ product_id: 'product', min_quantity: 1, promo_price: 4000 }] });
  assert.equal(result.totalAfterPromo, 4000);
  assert.equal(result.addition_discount, 0);
  assert.equal(result.subtotal, 3600);
  const capped = price(5000, rules({ discountPercentage: 80 }, { discountPercentage: 50 }));
  assert.equal(capped.first_order_discount, 4000);
  assert.equal(capped.addition_discount, 1000);
  assert.equal(capped.subtotal, 0);
  assert.equal(price(200, rules({ minPurchaseAmount: 300 }, { isActive: false })).subtotal, 200);
});

test('invalid rule keys, settings and amounts are rejected before persistence', () => {
  for (const body of [{}, [], null, { ruleKey: 'replacement' }, { isActive: 'false' },
    { discountPercentage: '' }, { discountPercentage: null }, { discountPercentage: -1 },
    { discountPercentage: 100.01 }, { discountPercentage: Infinity }, { discountPercentage: 1.111 },
    { minPurchaseAmount: '3999' }, { minPurchaseAmount: -1 }, { minPurchaseAmount: NaN }, { minPurchaseAmount: 3.333 }]) {
    assert.throws(() => validateRuleUpdate('milestone_discount', body), (error) => error.statusCode === 400);
  }
  assert.throws(() => validateRuleUpdate('unknown', { isActive: false }), (error) => error.statusCode === 404);
  assert.deepEqual(validateRuleUpdate('first_order_discount', { discountPercentage: 12.5, minPurchaseAmount: null, isActive: false }),
    { discountPercentage: 12.5, minPurchaseAmount: null, isActive: false });
});

test('Mongo model enforces known unique keys and percentage bounds', () => {
  const good = { ruleKey: 'first_order_discount', ruleName: 'First order', discountPercentage: 10, isActive: true };
  assert.equal(new DiscountRule(good).validateSync(), undefined);
  for (const change of [{ ruleKey: 'other' }, { ruleName: '' }, { discountPercentage: -1 }, { discountPercentage: 101 }, { minPurchaseAmount: -1 }]) {
    assert.ok(new DiscountRule({ ...good, ...change }).validateSync());
  }
  assert.equal(DiscountRule.collection.name, 'discount_rules');
  assert.ok(DiscountRule.schema.indexes().some(([index, options]) => index.ruleKey === 1 && options.unique));
});

test('seeding preserves saved rules and every read fetches the latest settings', async () => {
  const rows = new Map([['first_order_discount', { ruleKey: 'first_order_discount', discountPercentage: 12, isActive: false }]]);
  let seeds = 0, reads = 0;
  const model = {
    updateOne: async (filter, update, options) => {
      seeds++; assert.equal(options.upsert, true);
      if (!rows.has(filter.ruleKey)) rows.set(filter.ruleKey, { ...update.$setOnInsert });
    },
    find: (filter) => ({ lean: async () => { reads++; return [...rows.values()].filter((row) => row.isActive === filter.isActive).map((row) => ({ ...row })); } }),
  };
  const helper = evaluate('helpers/discountRules.js', { '../models/DiscountRule': model, '../errors/CustomErrorHandler': { CustomError } });
  await Promise.all([helper.ensureDiscountRules(), helper.ensureDiscountRules()]);
  assert.equal(seeds, 2);
  assert.equal(rows.get('first_order_discount').discountPercentage, 12);
  assert.equal((await helper.getActiveDiscountRules()).length, 1);
  rows.get('milestone_discount').discountPercentage = 7;
  assert.equal((await helper.getActiveDiscountRules())[0].discountPercentage, 7);
  assert.equal(reads, 2);
  assert.equal(seeds, 2);
});

test('initialization retries after database errors rather than poisoning future quotes', async () => {
  let failed = false;
  const helper = evaluate('helpers/discountRules.js', {
    '../models/DiscountRule': { updateOne: async () => { if (!failed) { failed = true; throw new Error('Database unavailable'); } } },
    '../errors/CustomErrorHandler': { CustomError },
  });
  await assert.rejects(helper.ensureDiscountRules(), /Database unavailable/);
  await helper.ensureDiscountRules();
});

test('controller uses a validated $set lookup and never accepts key or name replacement', async () => {
  let writes = 0;
  const controller = evaluate('controllers/discountRuleController.js', {
    '../models/DiscountRule': { findOneAndUpdate: async (filter, update, options) => {
      writes++; assert.equal(filter.ruleKey, 'milestone_discount'); assert.equal(update.$set.discountPercentage, 15);
      assert.equal(options.runValidators, true); assert.equal(options.new, true);
      return { ruleKey: filter.ruleKey, ...update.$set };
    } },
    '../helpers/discountRules': { ensureDiscountRules: async () => {}, validateRuleUpdate },
    '../errors/CustomErrorHandler': { CustomError },
  });
  let result, error;
  await controller.update({ params: { ruleKey: 'milestone_discount' }, body: { discountPercentage: 15, minPurchaseAmount: 3999, isActive: true } },
    { json: (data) => { result = data; } }, (value) => { error = value; });
  assert.equal(error, undefined); assert.equal(result.rule.minPurchaseAmount, 3999);
  await controller.update({ params: { ruleKey: 'milestone_discount' }, body: { ruleName: 'Injected' } }, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 400); assert.equal(writes, 1);
});

test('management endpoints require a signed JWT and database-verified Admin role', async (t) => {
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const secret = 'discount-rules-test-secret';
  let role = 'Admin', calls = 0;
  const auth = evaluate('middlewares/auth.js', {
    jsonwebtoken: jwt, '../models/userModel': { findById: () => ({ select: async () => ({ role }) }) },
    '../errors/CustomErrorHandler': { CustomError },
  }, { process: { env: { JWT_SECRET: secret } }, console });
  const handler = (req, res) => { calls++; res.json({ success: true }); };
  const router = evaluate('routes/adminDiscountRuleRoutes.js', {
    express, '../middlewares/auth': auth, '../controllers/discountRuleController': { getAll: handler, update: handler },
  });
  const app = express(); app.use('/api/admin/discount-rules', router);
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
  const server = app.listen(0, '127.0.0.1'); await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/admin/discount-rules`;
  const headers = { Authorization: `Bearer ${jwt.sign({ id: '000000000000000000000001' }, secret)}` };
  for (const [method, suffix] of [['GET', ''], ['PUT', '/milestone_discount']]) {
    assert.equal((await fetch(base + suffix, { method })).status, 401);
    role = 'Customer'; assert.equal((await fetch(base + suffix, { method, headers })).status, 403);
    role = 'Admin'; assert.equal((await fetch(base + suffix, { method, headers })).status, 200);
  }
  assert.equal(calls, 2);
});

test('guest quote ignores a supplied customer ID and payment creation requires authentication', async () => {
  const identities = [];
  const controller = evaluate('controllers/orderController.js', {
    './cancelOrderController.js': {}, './returnOrderController.js': {}, './inventroryController.js': {},
    './variantController.js': {}, '../helpers/generateOrderId.js': {},
    '../helpers/quoteOrder': { quoteOrder: async (items, userId) => { identities.push(userId); return { totalAmountToPay: 5000 }; } },
    '../errors/CustomErrorHandler.js': { CustomError },
  });
  let error;
  const body = { user_id: 'forged-customer', orderedItems: [{ product_id: 'product', quantity: 1 }] };
  const response = { json() {} };
  await controller.getOrderQuote({ body }, response, (value) => { error = value; });
  assert.equal(error, undefined); assert.equal(identities[0], undefined);
  await controller.getOrderQuote({ user: { _id: 'verified-customer' }, body }, response, (value) => { error = value; });
  assert.equal(identities[1], 'verified-customer');
  await controller.createOrder({ body }, response, (value) => { error = value; });
  assert.equal(error.statusCode, 401); assert.equal(identities.length, 2);
});

test('cart totals cannot use a different customer ID for first-order eligibility', async () => {
  let reads = 0, error;
  const controller = evaluate('controllers/cartController.js', {
    '../helpers/cartStock': {},
    '../models/cartModel': { findOne: () => { reads++; throw new Error('Must reject before reading'); } },
    '../helpers/quoteOrder': {}, '../helpers/calculatePricing': { calculatePricing },
    '../errors/CustomErrorHandler.js': { CustomError },
  });
  await controller.calculateCartTotalAmount({ user: { _id: 'verified-customer' }, params: { userId: 'other-customer' } }, {}, (value) => { error = value; });
  assert.equal(error.statusCode, 403); assert.equal(reads, 0);
});
