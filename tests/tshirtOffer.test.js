const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const { CustomError } = require('../errors/CustomErrorHandler');

const productId = '000000000000000000000001';
const setup = (variants = [{ productId }]) => {
  let saved;
  const dependencies = {
    mongoose,
    '../errors/CustomErrorHandler': { CustomError },
    '../models/variantModel': { find: () => ({ select: () => ({ lean: async () => variants }) }) },
    '../models/tshirtOfferModel': {
      findOne: () => ({ lean: async () => saved }),
      findOneAndUpdate: async (_, update) => { saved = update.$set; return saved; },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/tshirtOfferController.js'), 'utf8'), {
    module, require: (name) => dependencies[name],
  });
  return {
    save: async (body) => {
      let error;
      let result;
      await module.exports.saveTshirtOffer({ body }, { json: (value) => { result = value; } }, (value) => { error = value; });
      return { error, result, saved };
    },
    read: async () => {
      let result;
      await module.exports.getTshirtOffer({}, { json: (value) => { result = value; } }, (error) => { throw error; });
      return result.offer;
    },
  };
};
const valid = { enabled: true, minimumQuantity: 3, unitPrice: 333, eligibleProductIds: [productId], combineProducts: true, stackDiscounts: false };

test('admin can enable, change, read, and disable the persistent T-shirt offer', async () => {
  const app = setup();
  assert.equal((await app.read()).enabled, false);
  assert.equal((await app.save(valid)).error, undefined);
  assert.equal((await app.read()).unitPrice, 333);
  await app.save({ ...valid, unitPrice: 300, minimumQuantity: 4 });
  assert.equal((await app.read()).unitPrice, 300);
  assert.equal((await app.read()).minimumQuantity, 4);
  await app.save({ ...valid, enabled: false });
  assert.equal((await app.read()).enabled, false);
});

test('invalid rates, quantities, eligibility, and booleans cannot overwrite settings', async () => {
  for (const change of [{ unitPrice: -1 }, { unitPrice: 333.333 }, { unitPrice: NaN }, { minimumQuantity: 0 },
    { minimumQuantity: 2.5 }, { eligibleProductIds: [] }, { eligibleProductIds: ['invalid'] }, { enabled: 'true' }]) {
    const result = await setup().save({ ...valid, ...change });
    assert.equal(result.error.statusCode, 400);
    assert.equal(result.saved, undefined);
  }
});

test('products without variants cannot be enabled for the T-shirt offer', async () => {
  const result = await setup([]).save(valid);
  assert.equal(result.error.statusCode, 400);
  assert.equal(result.saved, undefined);
});
