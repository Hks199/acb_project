const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('admin variant edits preserve existing size/color IDs used in saved carts', async () => {
  let saved;
  const module = { exports: {} };
  const model = {
    findById: async () => ({ combinations: [{ _id: 'original-small', Size: 'S', Color: 'Black' }] }),
    findByIdAndUpdate: async (id, updates) => { saved = updates; return updates; },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/variantController.js'), 'utf8'), {
    module, require: (name) => name === '../models/variantModel.js' ? model : {},
  });
  let result;
  const res = { status: () => res, json: (value) => { result = value; } };
  await module.exports.updateVariantSet({ params: { id: 'set' }, body: { combinations: [
    { Size: 'S', Color: 'Black', price: 599, stock: 4 },
    { _id: 'untrusted-id', Size: 'M', Color: 'Black', price: 599, stock: 5 },
  ] } }, res, (error) => { throw error; });
  assert.equal(result.success, true);
  assert.equal(saved.combinations[0]._id, 'original-small');
  assert.equal(saved.combinations[0].price, 599);
  assert.equal(saved.combinations[1]._id, undefined);
});
