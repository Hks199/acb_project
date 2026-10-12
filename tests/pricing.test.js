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

test('first-order discount excludes shirts in a mixed cart', () => {
  const discountRules = [{ ruleKey: 'first_order_discount', discountPercentage: 10, isActive: true }, { ruleKey: 'milestone_discount', discountPercentage: 5, minPurchaseAmount: 0, isActive: true }];
  const result = quote([shirt(3), { productId: 'ceramics', quantity: 1, unitPrice: 200 }], { discountRules, isFirstOrder: true });
  assert.equal(result.subtotal, 999 + 170);
  assert.equal(result.items[0].effectiveUnitPrice, 333);
  assert.equal(result.first_order_discount, 20);
  assert.equal(result.addition_discount, 10);
});

test('optional discount stacking and same-design quantities are supported', () => {
  assert.equal(quote([shirt(3)], { offer: { ...offer, stackDiscounts: true }, discountRules: [{ ruleKey: 'first_order_discount', discountPercentage: 10, isActive: true }], isFirstOrder: true }).subtotal, 999);
  const discountRules = [
    { ruleKey: 'first_order_discount', discountPercentage: 10, isActive: true },
    { ruleKey: 'milestone_discount', discountPercentage: 5, minPurchaseAmount: 0, isActive: true },
  ];
  assert.equal(quote([shirt(3)], { discountRules, isFirstOrder: true }).addition_discount, 0);
  const stacked = quote([shirt(3)], { offer: { ...offer, stackDiscounts: true }, discountRules, isFirstOrder: true });
  assert.equal(stacked.addition_discount, 49.95);
  assert.equal(stacked.totalAmountToPay, 949.05);
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
  const result = quote([{ productId: 'art', quantity: 3, unitPrice: 333.33 }], { discountRules: [{ ruleKey: 'first_order_discount', discountPercentage: 7, isActive: true }], isFirstOrder: true });
  const line = result.items[0];
  assert.equal(Math.round(line.effectiveUnitPrice * line.quantity * 100), Math.round(line.finalTotal * 100));
  assert.equal(result.subtotal, line.finalTotal);
  assert.equal(result.totalAmountToPay, line.finalTotal);
});

test('cart breakdown explains both discounts and reconciles to the amount to pay', () => {
  const discountRules = [
    { ruleKey: 'first_order_discount', discountPercentage: 10, isActive: true },
    { ruleKey: 'milestone_discount', discountPercentage: 5, minPurchaseAmount: 4999, isActive: true },
  ];
  const result = calculatePricing({ items: [{ productId: 'art', quantity: 1, unitPrice: 6000 }], discountRules, isFirstOrder: true });
  assert.deepEqual(result.discountDetails.firstOrder, {
    percentage: 10, minimumPurchaseAmount: 0, qualifyingAmount: 6000, eligibleAmount: 6000,
    excludedAmount: 0, amount: 600, applied: true, reason: null, exclusion: 'tshirt',
  });
  assert.equal(result.discountDetails.milestone.percentage, 5);
  assert.equal(result.discountDetails.milestone.minimumPurchaseAmount, 4999);
  assert.equal(result.discountDetails.milestone.amount, 300);
  assert.equal(result.totalAmount - result.promotion_savings - result.first_order_discount - result.addition_discount + result.tax + result.deliveryCharge, result.totalAmountToPay);

  const below = calculatePricing({ items: [{ productId: 'art', quantity: 1, unitPrice: 4000 }], discountRules });
  assert.equal(below.discountDetails.firstOrder.reason, 'existing_order');
  assert.equal(below.discountDetails.milestone.reason, 'below_minimum');
  assert.equal(below.discountDetails.milestone.qualifyingAmount, 4000);
});

test('cart first-order breakdown excludes T-shirts and uses the configured rate on other products', () => {
  const discountRules = [{ ruleKey: 'first_order_discount', discountPercentage: 12, isActive: true }];
  const result = quote([shirt(3), { productId: 'art', quantity: 1, unitPrice: 200 }], { discountRules, isFirstOrder: true });
  assert.equal(result.discountDetails.firstOrder.percentage, 12);
  assert.equal(result.discountDetails.firstOrder.eligibleAmount, 200);
  assert.equal(result.discountDetails.firstOrder.excludedAmount, 999);
  assert.equal(result.discountDetails.firstOrder.amount, 24);
  const onlyShirts = quote([shirt(3)], { discountRules, isFirstOrder: true });
  assert.equal(onlyShirts.discountDetails.firstOrder.reason, 'tshirt_excluded');
  assert.equal(onlyShirts.discountDetails.firstOrder.amount, 0);
  assert.equal(onlyShirts.discountDetails.milestone.reason, 'inactive');
});

test('T-shirts never receive first-order discounts regardless of quantity, offer status or stacking', () => {
  const discountRules = [{ ruleKey: 'first_order_discount', discountPercentage: 15, isActive: true }];
  for (const quantity of [1, 2, 3]) {
    for (const enabled of [true, false]) {
      for (const stackDiscounts of [true, false]) {
        const result = quote([shirt(quantity)], { offer: { ...offer, enabled, stackDiscounts }, discountRules, isFirstOrder: true });
        assert.equal(result.first_order_discount, 0);
        assert.equal(result.discountDetails.firstOrder.reason, 'tshirt_excluded');
      }
    }
  }
  // Category classification also excludes shirts not selected for the bulk offer.
  const unselected = quote([{ ...shirt(1, 'newShirt'), isTshirt: true }], { offer: null, discountRules, isFirstOrder: true });
  assert.equal(unselected.first_order_discount, 0);
});

test('admin first-order percentage and status remain dynamic for non-T-shirt products', () => {
  const items = [{ productId: 'art', quantity: 1, unitPrice: 1000 }];
  const rule = { ruleKey: 'first_order_discount', discountPercentage: 15, isActive: true };
  const changed = quote(items, { discountRules: [rule], isFirstOrder: true });
  assert.equal(changed.first_order_discount, 150);
  assert.equal(changed.totalAmountToPay, 850);
  assert.equal(changed.discountDetails.firstOrder.percentage, 15);
  const disabled = quote(items, { discountRules: [{ ...rule, isActive: false }], isFirstOrder: true });
  assert.equal(disabled.first_order_discount, 0);
  assert.equal(disabled.totalAmountToPay, 1000);
  assert.equal(quote(items, { discountRules: [rule], isFirstOrder: false }).first_order_discount, 0);
  const minimum = quote(items, { discountRules: [{ ...rule, minPurchaseAmount: 1001 }], isFirstOrder: true });
  assert.equal(minimum.first_order_discount, 0);
  assert.equal(minimum.discountDetails.firstOrder.reason, 'below_minimum');
});
