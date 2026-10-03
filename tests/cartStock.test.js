const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CustomError } = require('../errors/CustomErrorHandler');

// Run the real helper and handlers against in-memory models; no database writes.
const loadModule = (relativePath, dependencies) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'), {
    module,
    require: (name) => dependencies[name] || {},
  });
  return module.exports;
};

const setup = ({ stock = 5, variantStock = 3, cart = null } = {}) => {
  let saves = 0;
  const Product = { findById: async () => ({ stock, product_name: 'T-shirt' }) };
  const ProductVariantSet = {
    findOne: async () => ({ combinations: [{ _id: 'variant', stock: variantStock }] }),
  };
  const helper = loadModule('helpers/cartStock.js', {
    '../models/inventoryModel': Product,
    '../models/variantModel': ProductVariantSet,
    '../errors/CustomErrorHandler': { CustomError },
  });
  if (cart) cart.save = async () => { saves++; };
  const Cart = {
    findOne: async () => cart,
    create: async () => { saves++; },
  };
  const handlers = loadModule('controllers/cartController.js', {
    '../models/cartModel': Cart,
    '../errors/CustomErrorHandler.js': { CustomError },
    '../helpers/cartStock': helper,
    mongoose: { Types: { ObjectId: class { constructor(value) { this.value = value; } toString() { return this.value; } } } },
  });
  const invoke = async (handler, body) => {
    let error;
    let response;
    const res = { status: () => res, json: (value) => { response = value; } };
    await handlers[handler]({ body: { user_id: 'user', product_id: 'shirt', ...body } }, res, (value) => { error = value; });
    return { error, response, saves };
  };
  return { invoke, validate: helper.validateCartStock };
};

test('new cart accepts exactly available stock and rejects excess', async () => {
  let result = await setup().invoke('addToCart', { quantity: 5 });
  assert.equal(result.response.success, true);
  result = await setup().invoke('addToCart', { quantity: 6 });
  assert.equal(result.error.customError, 'OutOfStock');
  assert.equal(result.error.statusCode, 400);
  assert.match(result.error.message, /Only 5 units/);
  assert.equal(result.saves, 0);
});

test('repeated additions check the accumulated size/color quantity', async () => {
  const item = { product_id: 'shirt', variant_id: 'variant', quantity: 3 };
  const result = await setup({ cart: { items: [item] } }).invoke('addToCart', { variant_id: 'variant', quantity: 1 });
  assert.equal(result.error.customError, 'OutOfStock');
  assert.match(result.error.message, /Only 3 units.*selected size\/color/);
  assert.equal(item.quantity, 3);
  assert.equal(result.saves, 0);
});

test('repeated regular-product additions accept the limit without exceeding it', async () => {
  const item = { product_id: 'shirt', quantity: 4 };
  const { invoke } = setup({ cart: { items: [item] } });
  assert.equal((await invoke('addToCart', { quantity: 1 })).response.success, true);
  assert.equal(item.quantity, 5);
  assert.equal((await invoke('addToCart', { quantity: 1 })).error.customError, 'OutOfStock');
  assert.equal(item.quantity, 5);
});

test('updates allow the limit and decreasing quantity but reject excess', async () => {
  const item = { product_id: 'shirt', variant_id: 'variant', quantity: 1 };
  const { invoke } = setup({ cart: { items: [item] } });
  assert.equal((await invoke('updateCartItem', { variant_id: 'variant', quantity: 3 })).response.success, true);
  const rejected = await invoke('updateCartItem', { variant_id: 'variant', quantity: 4 });
  assert.equal(rejected.error.customError, 'OutOfStock');
  assert.equal(item.quantity, 3);
  assert.equal((await invoke('updateCartItem', { variant_id: 'variant', quantity: 2 })).response.success, true);
  assert.equal(item.quantity, 2);
});

test('product stock is shared across variants', async () => {
  const { validate } = setup({ stock: 5, variantStock: 5 });
  const items = [{ product_id: 'shirt', variant_id: 'other', quantity: 4 }];
  await validate(items, 'shirt', 'variant', 1);
  await assert.rejects(validate(items, 'shirt', 'variant', 2), /Only 1 unit/);
});

test('zero stock rejects addition without saving', async () => {
  const result = await setup({ stock: 0 }).invoke('addToCart', { quantity: 1 });
  assert.match(result.error.message, /Only 0 units/);
  assert.equal(result.saves, 0);
});

test('an unavailable or missing variant cannot be added', async () => {
  let result = await setup({ variantStock: 0 }).invoke('addToCart', { variant_id: 'variant', quantity: 1 });
  assert.match(result.error.message, /Only 0 units/);
  assert.equal(result.saves, 0);
  result = await setup().invoke('addToCart', { variant_id: 'missing', quantity: 1 });
  assert.equal(result.error.customError, 'NotFound');
  assert.equal(result.error.statusCode, 404);
  assert.equal(result.saves, 0);
});

test('missing or invalid quantities are rejected for add and update', async () => {
  for (const handler of ['addToCart', 'updateCartItem']) {
    for (const quantity of [undefined, 0, -1, 1.5, '2', null]) {
      const result = await setup().invoke(handler, { quantity });
      assert.equal(result.error.customError, 'BadRequest');
      assert.equal(result.saves, 0);
    }
  }
});
