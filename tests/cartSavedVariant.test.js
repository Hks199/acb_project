const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CustomError } = require('../errors/CustomErrorHandler');

for (const variantId of [null, 'old-variant']) {
  test(`cart retains saved selection (${variantId}) even when the variant is gone`, async () => {
    const module = { exports: {} };
    const session = { startTransaction() {}, abortTransaction: async () => {}, commitTransaction: async () => {}, endSession() {} };
    const dependencies = {
      mongoose: { startSession: async () => session, Types: { ObjectId: class { constructor(value) { this.value = value; } } } },
      '../models/cartModel': { findOne: () => ({ lean: () => ({ session: async () => ({ items: [{ product_id: 'product', variant_id: variantId, quantity: 1 }] }) }) }) },
      '../models/inventoryModel.js': { findById: () => ({ select: () => ({ session: async () => ({ _id: 'product', product_name: 'Shirt', price: 499 }) }) }) },
      '../models/variantModel.js': { findOne: () => ({ session: async () => null }) },
      '../errors/CustomErrorHandler.js': { CustomError },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/cartController.js'), 'utf8'), {
      module, require: (name) => dependencies[name] || {},
    });
    let result;
    const res = { status: () => res, json: (value) => { result = value; } };
    await module.exports.getCart({ params: { user_id: 'buyer' } }, res, (error) => { throw error; });
    assert.equal(result.cart.items[0].variant_id, variantId);
    assert.equal(result.cart.items[0].variant, null);
    assert.equal(result.cart.items[0].fallback_price, 499);
    assert.equal(result.cart.items[0].selectionUnavailable, Boolean(variantId));
  });
}
