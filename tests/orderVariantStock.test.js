const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CustomError } = require('../errors/CustomErrorHandler');

const productId = '000000000000000000000001';
const { calculatePricing } = require('../helpers/calculatePricing');
const setup = ({ productStock = 10, variantStock = 0, hasVariants = true, offer = null, discountRules = [], orderCount = 0 } = {}) => {
  let paymentOrders = 0;
  let savedOrders = 0;
  let paymentPayload;
  let savedOrder;
  const dependencies = {
    '../models/orderModel': { countDocuments: async (filter) => { assert.equal(filter.user_id, 'customer'); assert.equal(filter.paymentStatus, undefined); return orderCount; }, create: async (orders) => { savedOrders++; savedOrder = orders[0]; } },
    '../models/inventoryModel': { findById: async () => ({ stock: productStock, isActive: true, price: 499 }) },
    '../models/variantModel': { findOne: async () => hasVariants ? { combinations: [{ _id: 'small', stock: variantStock, price: 499 }] } : null },
    '../models/tshirtOfferModel': { findOne: () => ({ lean: async () => offer }) },
    '../models/promotionModel': { find: () => ({ lean: async () => [] }) },
    './discountRules': { getActiveDiscountRules: async () => discountRules },
    '../helpers/razorpayInstance': { orders: { create: async (payload) => { paymentOrders++; paymentPayload = payload; return { id: 'order', amount: payload.amount, currency: 'INR' }; } } },
    '../errors/CustomErrorHandler.js': { CustomError },
    '../errors/CustomErrorHandler': { CustomError },
    './calculatePricing': { calculatePricing },
    '../helpers/generateOrderId.js': { generateOrderId: async () => 'order-number' },
    mongoose: { Types: { ObjectId: { isValid: () => true } }, model: () => ({ exists: async () => true }) },
  };
  const quoteModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../helpers/quoteOrder.js'), 'utf8'), {
    module: quoteModule, require: (name) => dependencies[name] || {},
  });
  dependencies['../helpers/quoteOrder'] = quoteModule.exports;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/orderController.js'), 'utf8'), {
    module, require: (name) => dependencies[name] || {},
  });
  const invoke = async (items) => {
    let error;
    let status;
    const res = { status: (value) => { status = value; return res; }, json: () => {} };
    await module.exports.createOrder({ user: { _id: 'customer' }, body: { user_id: 'forged-customer', orderedItems: items, subtotal: 1 } }, res, (value) => { error = value; });
    return { error, status, paymentOrders, savedOrders, paymentPayload, savedOrder };
  };
  const cartQuote = async (items) => {
    dependencies['../models/cartModel'] = { findOne: () => ({ lean: async () => ({ items: items.map((item) => ({
      product_id: item.product_id, variant_id: item.variant_combination_id, quantity: item.quantity,
    })) }) }) };
    dependencies['../helpers/calculatePricing'] = { calculatePricing };
    const cartModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/cartController.js'), 'utf8'), {
      module: cartModule, require: (name) => dependencies[name] || {},
    });
    let result;
    await cartModule.exports.calculateCartTotalAmount({ user: { _id: 'customer' }, params: { userId: 'customer' } }, {
      json: (value) => { result = value; },
    }, (error) => { throw error; });
    return result;
  };
  const invoice = async (order) => {
    const query = { populate: () => query, lean: async () => order };
    dependencies['../models/orderModel'].findById = () => query;
    let bill;
    const res = { status: () => res, json: (value) => { bill = value.bill; } };
    await module.exports.generateOrderBill({ body: { orderId: productId } }, res, (error) => { throw error; });
    return bill;
  };
  return { invoke, cartQuote, invoice };
};

for (const variantStock of [0, -1]) {
  test(`unavailable T-shirt variant (${variantStock}) cannot create a payment order`, async () => {
    const result = await setup({ variantStock }).invoke([{ product_id: productId, variant_combination_id: 'small', quantity: 1 }]);
    assert.equal(result.error.statusCode, 400);
    assert.equal(result.error.customError, 'OutOfStock');
    assert.equal(result.error.message, 'Product unavailable');
    assert.equal(result.paymentOrders, 0);
    assert.equal(result.savedOrders, 0);
  });
}

for (const variantId of [undefined, 'missing']) {
  test(`missing variant selection (${variantId}) cannot bypass variant stock`, async () => {
    const result = await setup({ variantStock: 2 }).invoke([{ product_id: productId, variant_combination_id: variantId, quantity: 1 }]);
    assert.equal(result.error.customError, 'OutOfStock');
    assert.equal(result.paymentOrders, 0);
  });
}

test('in-stock selected variant creates a payment order', async () => {
  const result = await setup({ variantStock: 1 }).invoke([{ product_id: productId, variant_combination_id: 'small', quantity: 1 }]);
  assert.equal(result.error, undefined);
  assert.equal(result.status, 201);
  assert.equal(result.paymentOrders, 1);
  assert.equal(result.savedOrders, 1);
});

test('three eligible shirts charge ₹999 and store ₹333 per unit despite forged client pricing', async () => {
  const offer = { enabled: true, minimumQuantity: 3, unitPrice: 333, eligibleProductIds: [productId], combineProducts: true, stackDiscounts: false };
  const discountRules = [{ ruleKey: 'first_order_discount', discountPercentage: 10, isActive: true }, { ruleKey: 'milestone_discount', discountPercentage: 5, minPurchaseAmount: 0, isActive: true }];
  const result = await setup({ variantStock: 10, offer, discountRules }).invoke([
    { product_id: productId, variant_combination_id: 'small', quantity: 3, price_per_unit: 1, total_price: 3 },
  ]);
  assert.equal(result.error, undefined);
  assert.equal(result.paymentPayload.amount, 99900);
  assert.equal(result.savedOrder.subtotal, 999);
  assert.equal(result.savedOrder.totalAmount, 999);
  assert.equal(result.savedOrder.orderedItems[0].price_per_unit, 333);
  assert.equal(result.savedOrder.orderedItems[0].total_price, 999);
});

test('current rules control cart, payment and saved amounts; claimed customer IDs cannot change eligibility', async () => {
  const discountRules = [{ ruleKey: 'first_order_discount', discountPercentage: 12, isActive: true },
    { ruleKey: 'milestone_discount', discountPercentage: 7, minPurchaseAmount: 1000, isActive: true }];
  const app = setup({ hasVariants: false, discountRules });
  const items = [{ product_id: productId, quantity: 3 }];
  const pricing = await app.cartQuote(items);
  const checkout = await app.invoke(items);
  assert.equal(pricing.subtotal, 1212.57);
  assert.equal(checkout.paymentPayload.amount, 121257);
  assert.equal(checkout.savedOrder.totalAmount, pricing.subtotal);
  assert.equal(checkout.savedOrder.user_id, 'customer');
  assert.equal(checkout.savedOrder.first_time_discount_in_amount, 179.64);
  assert.equal(checkout.savedOrder.additional_discount_in_amount, 104.79);
  discountRules[0].isActive = false;
  discountRules[1].minPurchaseAmount = 1500;
  assert.equal((await app.cartQuote(items)).subtotal, 1497);
});

test('an existing order, including pending orders, excludes the first-order reward', async () => {
  const discountRules = [{ ruleKey: 'first_order_discount', discountPercentage: 12, isActive: true }];
  const app = setup({ hasVariants: false, discountRules, orderCount: 1 });
  const result = await app.invoke([{ product_id: productId, quantity: 1 }]);
  assert.equal(result.paymentPayload.amount, 49900);
  assert.equal(result.savedOrder.first_time_discount_in_amount, 0);
});

test('repeated order lines cannot collectively exceed selected variant stock', async () => {
  const item = { product_id: productId, variant_combination_id: 'small', quantity: 1 };
  const result = await setup({ variantStock: 1 }).invoke([item, item]);
  assert.equal(result.error.customError, 'OutOfStock');
  assert.equal(result.paymentOrders, 0);
});

test('regular products do not require a variant selection', async () => {
  const result = await setup({ hasVariants: false }).invoke([{ product_id: productId, quantity: 1 }]);
  assert.equal(result.error, undefined);
  assert.equal(result.paymentOrders, 1);
});

test('cart display, checkout charge, and saved order totals agree across sizes and mixed designs', async () => {
  const otherId = '000000000000000000000002';
  const offer = { enabled: true, minimumQuantity: 3, unitPrice: 333, eligibleProductIds: [productId, otherId], combineProducts: true, stackDiscounts: false };
  const app = setup({ variantStock: 10, offer });
  const items = [{ product_id: productId, variant_combination_id: 'small', quantity: 2 },
    { product_id: otherId, variant_combination_id: 'small', quantity: 1 }];
  const pricing = await app.cartQuote(items);
  const checkout = await app.invoke(items);
  assert.equal(pricing.subtotal, 999);
  assert.equal(pricing.subtotal * 100, checkout.paymentPayload.amount);
  assert.equal(pricing.subtotal, checkout.savedOrder.totalAmount);
  assert.equal(checkout.savedOrder.orderedItems.reduce((sum, item) => sum + item.total_price, 0), 999);
});

test('invoice retains the paid T-shirt offer rate and total without requiring a missing vendor field', async () => {
  const app = setup();
  const bill = await app.invoice({
    order_number: 'ORDER-001', createdAt: new Date(), user_id: { first_name: 'Buyer', email: 'buyer@example.com', mobile_number: '123' },
    orderedItems: [{ product_id: { product_name: 'T-shirt', imageUrls: [] }, quantity: 3, price_per_unit: 333, total_price: 999 }],
    subtotal: 999, totalAmount: 999, tax: 0, deliveryCharge: 0,
  });
  assert.equal(bill.items[0].unitPrice, 333);
  assert.equal(bill.items[0].total, 999);
  assert.equal(bill.charges.totalAmount, 999);
});
