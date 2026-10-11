const paise = (amount) => Math.round(Number(amount) * 100);
const rupees = (amount) => amount / 100;
const percent = (value) => Math.min(100, Math.max(0, Number(value) || 0));

// Calculate every line and summary in paise. The saved line totals add up to the payment amount.
const calculatePricing = ({ items, offer, promotions = [], discountRules = [], isFirstOrder = false }) => {
  const eligibleIds = new Set((offer?.eligibleProductIds || []).map(String));
  const eligible = (item) => Boolean(offer?.enabled && item.variantId && eligibleIds.has(String(item.productId)));
  const counts = new Map();
  for (const item of items) {
    if (eligible(item)) {
      const key = offer.combineProducts === false ? String(item.productId) : 'all';
      counts.set(key, (counts.get(key) || 0) + item.quantity);
    }
  }
  const productCounts = new Map();
  for (const item of items) productCounts.set(String(item.productId), (productCounts.get(String(item.productId)) || 0) + item.quantity);
  const promoMap = new Map(promotions.map((promotion) => [String(promotion.product_id), promotion]));
  const lines = items.map((item) => {
    const originalUnit = paise(item.unitPrice);
    const key = offer?.combineProducts === false ? String(item.productId) : 'all';
    const bulkApplied = eligible(item) && counts.get(key) >= offer.minimumQuantity;
    const promo = promoMap.get(String(item.productId));
    let unit = originalUnit;
    let description = null;
    if (bulkApplied) {
      unit = Math.min(unit, paise(offer.unitPrice));
      description = `Buy ${offer.minimumQuantity} or more T-shirts for ₹${offer.unitPrice} each`;
    } else if (promo && productCounts.get(String(item.productId)) >= promo.min_quantity) {
      unit = Math.min(unit, paise(promo.promo_price / promo.min_quantity));
      description = promo.description;
    }
    return { ...item, originalUnit, unit, bulkApplied, description };
  });
  const totalAfterPromo = lines.reduce((sum, line) => sum + line.unit * line.quantity, 0);
  let firstSavings = 0;
  let additionalSavings = 0;
  const applies = (rule) => rule?.isActive === true && totalAfterPromo >= paise(rule.minPurchaseAmount ?? 0);
  const firstRule = discountRules.find((rule) => rule.ruleKey === 'first_order_discount');
  const milestoneRule = discountRules.find((rule) => rule.ruleKey === 'milestone_discount');
  const firstRate = isFirstOrder && applies(firstRule) ? percent(firstRule.discountPercentage) : 0;
  const extraRate = applies(milestoneRule) ? percent(milestoneRule.discountPercentage) : 0;
  const breakdown = lines.map((line) => {
    const stack = !line.bulkApplied || offer.stackDiscounts === true;
    // The first-purchase benefit applies to T-shirts at their offer price too.
    const first = Math.round(line.unit * firstRate / 100);
    const extra = stack ? Math.min(line.unit - first, Math.round(line.unit * extraRate / 100)) : 0;
    firstSavings += first * line.quantity;
    additionalSavings += extra * line.quantity;
    const finalUnit = line.unit - first - extra;
    return {
      productId: line.productId, variantId: line.variantId || null, quantity: line.quantity,
      unitPrice: rupees(line.originalUnit), effectiveUnitPrice: rupees(finalUnit),
      normalTotal: rupees(line.originalUnit * line.quantity), finalTotal: rupees(finalUnit * line.quantity),
      promoApplied: line.unit < line.originalUnit, bulkOfferApplied: line.bulkApplied,
      promoDescription: line.description,
    };
  });
  const original = lines.reduce((sum, line) => sum + line.originalUnit * line.quantity, 0);
  const total = breakdown.reduce((sum, line) => sum + paise(line.finalTotal), 0);
  const percentageBase = lines.reduce((sum, line) => (
    !line.bulkApplied || offer.stackDiscounts === true ? sum + line.unit * line.quantity : sum
  ), 0);
  const describeDiscount = (rule, amount, firstOrderOnly = false) => {
    const eligibleBase = firstOrderOnly ? totalAfterPromo : percentageBase;
    const minimum = paise(rule?.minPurchaseAmount ?? 0);
    let reason = null;
    if (rule?.isActive !== true || percent(rule.discountPercentage) === 0) reason = 'inactive';
    else if (firstOrderOnly && !isFirstOrder) reason = 'existing_order';
    else if (totalAfterPromo < minimum) reason = 'below_minimum';
    else if (eligibleBase === 0) reason = 'excluded_by_offer';
    return {
      percentage: percent(rule?.discountPercentage), minimumPurchaseAmount: rupees(minimum),
      qualifyingAmount: rupees(totalAfterPromo), eligibleAmount: rupees(eligibleBase),
      excludedAmount: rupees(totalAfterPromo - eligibleBase), amount: rupees(amount),
      applied: amount > 0, reason,
    };
  };
  return {
    items: breakdown, totalAmount: rupees(original), totalAfterPromo: rupees(totalAfterPromo),
    promotion_savings: rupees(original - totalAfterPromo), first_order_discount: rupees(firstSavings),
    addition_discount: rupees(additionalSavings), totalAmountAfterDiscount: rupees(total),
    subtotal: rupees(total), tax: 0, deliveryCharge: 0, totalAmountToPay: rupees(total),
    uniqueItemCount: productCounts.size,
    discountDetails: {
      firstOrder: describeDiscount(firstRule, firstSavings, true),
      milestone: describeDiscount(milestoneRule, additionalSavings),
    },
    tshirtOffer: offer?.enabled && counts.size ? {
      minimumQuantity: offer.minimumQuantity, unitPrice: offer.unitPrice,
      eligibleQuantity: [...counts.values()].reduce((sum, count) => sum + count, 0),
      combineProducts: offer.combineProducts !== false,
    } : null,
  };
};

module.exports = { calculatePricing };
