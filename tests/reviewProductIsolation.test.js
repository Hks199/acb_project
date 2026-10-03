const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const { CustomError } = require('../errors/CustomErrorHandler');

const productA = '000000000000000000000001';
const productB = '000000000000000000000002';
const customerId = '00000000000000000000000a';

const setup = () => {
  const documents = new Map();
  const updates = new Map();
  const productQueries = [];
  const createDocument = (data) => {
    const doc = { ...data, save: async () => {} };
    documents.set(data.productId, doc);
    return doc;
  };
  const model = {
    create: async (data) => createDocument(data),
    findOne: ({ productId }) => {
      productQueries.push(productId);
      const query = {
        populate: () => query,
        then: (resolve, reject) => Promise.resolve(documents.get(productId) || null).then(resolve, reject),
      };
      return query;
    },
  };
  const dependencies = {
    mongoose,
    '../models/ratingAndreviewModel': model,
    '../models/inventoryModel': { exists: async ({ _id }) => [productA, productB].includes(_id) },
    '../errors/CustomErrorHandler.js': { CustomError },
    './inventroryController.js': { updateRatingAndReview: async (id, average, count) => updates.set(id, { average, count }) },
  };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/reviewController.js'), 'utf8'), {
    module, require: (name) => dependencies[name],
  });
  const invoke = async (handler, req) => {
    let response, error, status;
    const res = { status: (code) => { status = code; return res; }, json: (value) => { response = value; } };
    await module.exports[handler](req, res, (value) => { error = value; });
    return { response, error, status };
  };
  const add = (id, rating = 5, review = 'A review', customer = customerId) => invoke('addReview', {
    body: { productId: id, customerId: customer, rating, review },
  });
  return { invoke, add, documents, updates, productQueries };
};

test('adding and fetching reviews keeps two products completely separate', async () => {
  const { add, invoke, documents, updates } = setup();
  assert.equal((await add(productA, 5, 'Review for A')).response.productId, productA);
  assert.equal(documents.has(productB), false);
  assert.equal(updates.has(productB), false);
  assert.equal((await add(productB, 2, 'Review for B')).response.productId, productB);
  for (const [id, text, rating] of [[productA, 'Review for A', 5], [productB, 'Review for B', 2]]) {
    const result = await invoke('getReviewsByProduct', { params: { productId: id }, body: {} });
    assert.equal(result.response.productId, id);
    assert.equal(result.response.totalReviews, 1);
    assert.equal(result.response.reviews[0].review, text);
    assert.equal(result.response.reviews[0].rating, rating);
    assert.equal(updates.get(id).average, rating);
  }
});

test('one customer can review both products but cannot review the same product twice', async () => {
  const { add, documents } = setup();
  assert.equal((await add(productA)).response.success, true);
  assert.equal((await add(productB)).response.success, true);
  assert.equal((await add(productA, 1)).error.customError, 'DuplicateReview');
  assert.equal(documents.get(productA).review_and_rating.length, 1);
  assert.equal(documents.get(productB).review_and_rating.length, 1);
});

test('deleting a review only updates the requested product', async () => {
  const { add, invoke, documents, updates } = setup();
  await add(productA, 5);
  await add(productB, 2);
  const result = await invoke('deleteReview', { params: { productId: productA, customerId } });
  assert.equal(result.response.success, true);
  assert.equal(documents.get(productA).review_and_rating.length, 0);
  assert.equal(documents.get(productB).review_and_rating.length, 1);
  assert.deepEqual(updates.get(productA), { average: 0, count: 0 });
  assert.deepEqual(updates.get(productB), { average: 2, count: 1 });
});

test('invalid IDs and nonexistent products cannot save any review', async () => {
  const { add, documents, productQueries } = setup();
  for (const id of [undefined, '', 'PROD-0001', {}, '000000000000000000000003']) {
    const result = await add(id);
    assert.ok(result.error);
    assert.equal(documents.size, 0);
  }
  assert.equal(productQueries.length, 0);
});

test('invalid ratings and review text are rejected without saving', async () => {
  const { add, invoke, documents } = setup();
  assert.equal((await invoke('addReview', { body: { productId: productA, customerId } })).error.customError, 'BadRequest');
  for (const rating of [null, 0, 6, '5', NaN]) {
    assert.equal((await add(productA, rating)).error?.customError, 'BadRequest');
  }
  assert.equal((await add(productA, 5, {})).error.customError, 'BadRequest');
  assert.equal((await add(productA, 5, 'Review', 'bad-customer')).error.customError, 'BadRequest');
  assert.equal(documents.size, 0);
});

test('uppercase customer IDs still detect duplicate reviews', async () => {
  const { add } = setup();
  await add(productA);
  assert.equal((await add(productA, 4, 'Another review', customerId.toUpperCase())).error.customError, 'DuplicateReview');
});

const adminBody = (id = productA) => ({
  productId: id, customerName: '  Sample Customer  ', rating: 4, review: '  A named review  ',
});

test('admin reviews coexist with customer reviews and only update their own product', async () => {
  const { add, invoke, documents, updates } = setup();
  await add(productA, 2);
  await add(productB, 5);
  const result = await invoke('addAdminReview', { body: adminBody() });
  assert.equal(result.status, 201);
  assert.equal(result.response.success, true);
  const entry = documents.get(productA).review_and_rating[1];
  assert.equal(entry.customerName, 'Sample Customer');
  assert.equal(entry.review, 'A named review');
  assert.equal(entry.isAdminReview, true);
  assert.ok(mongoose.isObjectIdOrHexString(entry.adminReviewId));
  assert.equal(entry.customerId, undefined);
  assert.deepEqual(updates.get(productA), { average: 3, count: 2 });
  assert.deepEqual(updates.get(productB), { average: 5, count: 1 });
  const second = await invoke('addAdminReview', { body: adminBody() });
  assert.equal(second.response.success, true);
  assert.notEqual(documents.get(productA).review_and_rating[2].adminReviewId.toString(), entry.adminReviewId.toString());
});

test('admin reviews can create a first review and retain the existing customer-name response', async () => {
  const { invoke, documents } = setup();
  await invoke('addAdminReview', { body: adminBody() });
  const id = documents.get(productA).review_and_rating[0].adminReviewId.toString();
  const result = await invoke('getReviewsByProduct', { params: { productId: productA }, body: {} });
  assert.equal(result.response.reviews[0].customerId.first_name, 'Sample Customer');
  assert.equal(result.response.reviews[0].customerId._id.toString(), id);
  assert.equal(documents.get(productA).review_and_rating[0].adminReviewId.toString(), id);
});

test('invalid admin review input does not save or update ratings', async () => {
  const { invoke, documents, updates } = setup();
  for (const override of [
    { productId: 'bad' }, { productId: '000000000000000000000003' },
    { customerName: '' }, { customerName: '   ' }, { customerName: {} }, { customerName: 'a'.repeat(101) },
    { rating: 0 }, { rating: 6 }, { rating: '5' }, { rating: 4.5 }, { rating: null },
    { review: '' }, { review: '   ' }, { review: {} }, { review: 'a'.repeat(5001) },
  ]) {
    const result = await invoke('addAdminReview', { body: { ...adminBody(), ...override } });
    assert.ok(result.error);
    assert.equal(documents.size, 0);
    assert.equal(updates.size, 0);
  }
});

test('admin deletion removes only the named entry, recalculates ratings, and protects customer reviews', async () => {
  const { add, invoke, documents, updates } = setup();
  await add(productA, 2);
  await add(productB, 5);
  await invoke('addAdminReview', { body: adminBody() });
  const id = documents.get(productA).review_and_rating[1].adminReviewId.toString();
  const params = { productId: productA, customerId: id };
  assert.equal((await invoke('deleteReview', { params })).error.statusCode, 403);
  assert.equal((await invoke('deleteAdminReview', { params: { ...params, customerId } })).error.statusCode, 404);
  assert.equal((await invoke('deleteAdminReview', { params: { ...params, productId: productB } })).error.statusCode, 404);
  assert.equal(documents.get(productA).review_and_rating.length, 2);
  assert.equal((await invoke('deleteAdminReview', { params })).response.success, true);
  assert.equal(documents.get(productA).review_and_rating.length, 1);
  assert.deepEqual(updates.get(productA), { average: 2, count: 1 });
  assert.deepEqual(updates.get(productB), { average: 5, count: 1 });
  assert.equal((await invoke('deleteAdminReview', { params })).error.statusCode, 404);
});

test('deleting the last admin review resets product ratings', async () => {
  const { invoke, documents, updates } = setup();
  await invoke('addAdminReview', { body: adminBody() });
  const id = documents.get(productA).review_and_rating[0].adminReviewId.toString();
  await invoke('deleteAdminReview', { params: { productId: productA, customerId: id } });
  assert.deepEqual(updates.get(productA), { average: 0, count: 0 });
});
