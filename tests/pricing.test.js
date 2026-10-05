const test = require('node:test');
const assert = require('node:assert/strict');
const { calculatePricing } = require('../helpers/calculatePricing');

const offer = { enabled: true, minimumQuantity: 3, unitPrice: 333, eligibleProductIds: ['shirtA', 'shirtB'], combineProducts: true, stackDiscounts: false };
const shirt = (quantity, productId = 'shirtA', variantId = 'small') => ({ productId, variantId, quantity, unitPrice: 499 });
const quote = (items, overrides = {}) => calculatePricing({ items, offer, ...overrides });

test('2 shirts keep the regular rate; 3, 4, and 7 all receive the offer rate', () => {
  for (const quantity of [2, 3, 4, 7]) {
    const result = quote([shirt(quantity)]);
    assert.equal(result.subtotal, quantity * (quantity < 3 ? 499 : 333));
    assert.equal(result.items[0].effectiveUnitPrice, quantity < 3 ? 499 : 333);
  }
});

test('quantities combine across eligible designs and sizes', () => {
  const result = quote([shirt(1), shirt(1, 'shirtA', 'large'), shirt(1, 'shirtB', 'medium')]);
  assert.equal(result.subtotal, 999);
  assert.equal(result.items.every((item) => item.effectiveUnitPrice === 333), true);
});

test('other products never qualify or contribute to the T-shirt threshold', () => {
  const other = { productId: 'ceramics', quantity: 5, unitPrice: 200 };
  assert.equal(quote([shirt(2), other]).subtotal, 998 + 1000);
  const mixed = quote([shirt(3), other]);
  assert.equal(mixed.subtotal, 999 + 1000);
  assert.equal(mixed.items[1].bulkOfferApplied, false);
});

test('selected products without variants do not qualify for this offer', () => {
  assert.equal(quote([{ ...shirt(3), variantId: null }]).subtotal, 1497);
});

test('disabling or changing the offer updates the calculation', () => {
  assert.equal(quote([shirt(3)], { offer: { ...offer, enabled: false } }).subtotal, 1497);
  assert.equal(quote([shirt(3)], { offer: { ...offer, minimumQuantity: 4, unitPrice: 300 } }).subtotal, 1497);
  assert.equal(quote([shirt(4)], { offer: { ...offer, minimumQuantity: 4, unitPrice: 300 } }).subtotal, 1200);
});

test('bulk offer replaces percentage discounts only on eligible shirts', () => {
  const discount = { first_time_discount_in_percentage: 10, additional_discount_in_percentage: 5, additional_discount_minimum_amount: 0 };
  const result = quote([shirt(3), { productId: 'ceramics', quantity: 1, unitPrice: 200 }], { discount, isFirstOrder: true });
  assert.equal(result.subtotal, 999 + 170);
  assert.equal(result.items[0].effectiveUnitPrice, 333);
  assert.equal(result.first_order_discount, 20);
  assert.equal(result.addition_discount, 10);
});

test('optional discount stacking and same-design quantities are supported', () => {
  assert.equal(quote([shirt(3)], { offer: { ...offer, stackDiscounts: true }, discount: { first_time_discount_in_percentage: 10 }, isFirstOrder: true }).subtotal, 899.1);
  assert.equal(quote([shirt(2), shirt(1, 'shirtB')], { offer: { ...offer, combineProducts: false } }).subtotal, 1497);
});

test('removing quantity below the threshold restores normal pricing', () => {
  assert.equal(quote([shirt(2), shirt(1, 'shirtB')]).subtotal, 999);
  assert.equal(quote([shirt(2)]).subtotal, 998);
});

test('existing product promotions aggregate different variants and remain separate from T-shirt offers', () => {
  const promotions = [{ product_id: 'other', min_quantity: 3, promo_price: 900 }];
  const result = quote([shirt(3), shirt(2, 'other', 'red'), shirt(1, 'other', 'blue')], { promotions });
  assert.equal(result.subtotal, 999 + 900);
});

test('rounding keeps line quantities, saved totals, and payment totals exactly consistent', () => {
  const result = quote([shirt(3)], { offer: { ...offer, unitPrice: 333.33, stackDiscounts: true }, discount: { first_time_discount_in_percentage: 7 }, isFirstOrder: true });
  const line = result.items[0];
  assert.equal(Math.round(line.effectiveUnitPrice * line.quantity * 100), Math.round(line.finalTotal * 100));
  assert.equal(result.subtotal, line.finalTotal);
  assert.equal(result.totalAmountToPay, line.finalTotal);
});
