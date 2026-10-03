const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const mongoose = require('mongoose');
const ProductReview = require('../models/ratingAndreviewModel');

const id = '000000000000000000000001';
const adminId = '000000000000000000000002';

const loadModule = (file, dependencies, extras = {}) => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    module, require: (name) => dependencies[name], ...extras,
  });
  return module.exports;
};

test('admin review creation and deletion work without a sign-in token', async () => {
  const routes = [];
  const router = {
    post: (route, ...handlers) => routes.push({ route, handlers }),
    delete: (route, ...handlers) => routes.push({ route, handlers }),
    get: () => {},
  };
  const reached = [];
  const controllers = {
    addAdminReview: () => reached.push('add'), deleteAdminReview: () => reached.push('delete'),
    addReview: () => {}, getAllReviews: () => {}, getReviewsByProduct: () => {}, deleteReview: () => {},
  };
  loadModule('routes/reviewRoutes.js', {
    express: { Router: () => router },
    '../controllers/reviewController': controllers,
  });
  for (const route of routes.filter((entry) => entry.route.includes('AdminReview'))) {
    assert.equal(route.handlers.length, 1);
    await route.handlers[0]({ headers: {} }, {}, (error) => { if (error) throw error; });
  }
  assert.deepEqual(reached, ['add', 'delete']);
});

test('schema accepts old customer reviews and requires names only for admin reviews', () => {
  const doc = new ProductReview({ productId: id, review_and_rating: [
    { customerId: id, rating: 5 },
    { adminReviewId: adminId, customerName: 'Sample Customer', isAdminReview: true, rating: 3, review: 'Review' },
  ] });
  assert.equal(doc.validateSync(), undefined);
  assert.equal(doc.review_and_rating[0].isAdminReview, false);
  doc.review_and_rating[1].customerName = '';
  assert.ok(doc.validateSync().errors['review_and_rating.1.customerName']);
});

test('populate loads real customer names and preserves standalone admin review IDs', async () => {
  const fakeId = new mongoose.Types.ObjectId();
  const doc = new ProductReview({ productId: id, review_and_rating: [
    { customerId: id, rating: 5 },
    { adminReviewId: fakeId, customerName: 'Sample Customer', isAdminReview: true, rating: 3 },
  ] });
  const name = 'AdminReviewTestUser';
  const User = mongoose.model(name, new mongoose.Schema({ first_name: String }));
  const originalFind = User.find;
  User.find = () => ({ exec: async () => [new User({ _id: id, first_name: 'Real Customer' })] });
  try {
    await ProductReview.populate(doc, {
      path: 'review_and_rating.customerId', model: User, select: 'first_name',
    });
    assert.equal(doc.review_and_rating[0].customerId.first_name, 'Real Customer');
    assert.equal(doc.review_and_rating[1].adminReviewId.toString(), fakeId.toString());
    assert.equal(doc.review_and_rating[1].toObject().adminReviewId.toString(), fakeId.toString());
  } finally {
    User.find = originalFind;
    mongoose.deleteModel(name);
  }
});
