const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CustomError } = require('../errors/CustomErrorHandler');
const mongoose = require('mongoose');
const productId = '000000000000000000000001';
const customerId = '000000000000000000000010';
const otherCustomerId = '000000000000000000000011';

const loadModule = (file, dependencies) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, require: (name) => dependencies[name] || {},
  });
  return module.exports;
};

test('listings replace stale averages using review summaries and hide unrated products', async () => {
  const { withProductRatings } = loadModule('helpers/productRatings.js', {
    '../models/ratingAndreviewModel': { aggregate: async (pipeline) => {
      assert.equal(pipeline[0].$match.productId.$in.join(','), 'rated,unrated');
      assert.equal(pipeline[1].$unwind, '$review_and_rating');
      assert.equal(pipeline[2].$group.averageRating.$avg, '$review_and_rating.rating');
      assert.equal(pipeline[2].$group.totalRatings.$sum, 1);
      return [{ _id: 'rated', averageRating: 10 / 3, totalRatings: 3 }];
    } },
  });
  const products = [
    { _id: 'rated', avg_rating: 5, review_count: 99, price: 100 },
    { _id: 'unrated', avg_rating: 5, review_count: 99 },
  ];
  const result = await withProductRatings(products);
  assert.equal(result[0].avg_rating, 3.3);
  assert.equal(result[0].review_count, 3);
  assert.equal(result[0].price, 100);
  assert.equal(result[1].avg_rating, 0);
  assert.equal(result[1].review_count, 0);
  assert.equal(products[0].avg_rating, 5);
});

test('category product documents retain their fields and receive real averages', async () => {
  const { withProductRatings } = loadModule('helpers/productRatings.js', {
    '../models/ratingAndreviewModel': { aggregate: async () => [{ _id: 'shirt', averageRating: 4.5, totalRatings: 2 }] },
  });
  const result = await withProductRatings([{ _id: 'shirt', toObject: () => ({ _id: 'shirt', product_name: 'T-shirt' }) }]);
  assert.equal(result[0].product_name, 'T-shirt');
  assert.equal(result[0].avg_rating, 4.5);
  assert.equal(result[0].review_count, 2);
});

test('empty pages do not query reviews', async () => {
  const { withProductRatings } = loadModule('helpers/productRatings.js', {
    '../models/ratingAndreviewModel': { aggregate: () => { throw new Error('unexpected query'); } },
  });
  assert.equal((await withProductRatings([])).length, 0);
});

const setupReviews = (ratings, failUpdate = false) => {
  const updates = [];
  const doc = {
    review_and_rating: ratings.map((rating, index) => ({ customerId: index === 0 ? customerId : otherCustomerId, rating })),
    save: async () => {},
  };
  const handlers = loadModule('controllers/reviewController.js', {
    mongoose,
    '../models/inventoryModel': { exists: async () => true },
    '../models/ratingAndreviewModel': { findOne: async () => doc },
    '../errors/CustomErrorHandler.js': { CustomError },
    './inventroryController.js': { updateRatingAndReview: async (...args) => {
      if (failUpdate) throw new Error('update failed');
      updates.push(args);
    } },
  });
  const invoke = async (handler, req) => {
    let error, response;
    const res = { status: () => res, json: (body) => { response = body; } };
    await handlers[handler](req, res, (value) => { error = value; });
    return { error, response, updates };
  };
  return { invoke };
};

test('adding a customer review updates the actual average and count', async () => {
  const result = await setupReviews([5]).invoke('addReview', {
    body: { productId, customerId: otherCustomerId, rating: 2, review: 'review' },
  });
  assert.equal(result.response.success, true);
  assert.deepEqual(result.updates[0], [productId, 3.5, 2]);
});

test('deleting a review recalculates the average', async () => {
  const result = await setupReviews([1, 5]).invoke('deleteReview', {
    params: { productId, customerId },
  });
  assert.equal(result.response.success, true);
  assert.deepEqual(result.updates[0], [productId, 5, 1]);
});

test('deleting the last review resets the rating and count to zero', async () => {
  const result = await setupReviews([5]).invoke('deleteReview', {
    params: { productId, customerId },
  });
  assert.equal(result.response.success, true);
  assert.deepEqual(result.updates[0], [productId, 0, 0]);
});

test('average update errors reach the handler instead of referencing undefined next', async () => {
  const result = await setupReviews([5], true).invoke('deleteReview', {
    params: { productId, customerId },
  });
  assert.equal(result.error.customError, 'DeleteReviewError');
  assert.equal(result.error.message, 'update failed');
  assert.equal(result.response, undefined);
});
