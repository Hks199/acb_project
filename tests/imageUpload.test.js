const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { CustomError } = require('../errors/CustomErrorHandler');

const loadController = (upload, model = class {}) => {
  const module = { exports: {} };
  const dependencies = {
    '../models/listofImagesModel': model,
    '../helpers/s3BucketUploadHandler.js': { s3UploadHandler: upload },
    '../errors/CustomErrorHandler.js': { CustomError },
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../controllers/listOfImagesController.js'), 'utf8'), {
    module, require: (name) => dependencies[name],
  });
  return module.exports;
};

test('missing file and invalid title return 400 without attempting S3 upload', async () => {
  const { createImage } = loadController(() => { throw new Error('Unexpected upload'); });
  for (const [req, message] of [
    [{ body: { title: 'Craft' } }, 'Image file is required'],
    [{ body: { title: '  ' }, files: { image: {} } }, 'Image title is required'],
    [{ body: { title: 123 }, files: { image: {} } }, 'Image title is required'],
    [{}, 'Image title is required'],
  ]) {
    let error;
    await createImage(req, {}, (err) => { error = err; });
    assert.equal(error.statusCode, 400);
    assert.equal(error.message, message);
  }
});

test('S3 errors preserve their message instead of returning message 500', async () => {
  const { createImage } = loadController(async () => { throw new Error('Access Denied'); });
  let error;
  await createImage({ body: { title: 'Craft' }, files: { image: {} } }, {}, (err) => { error = err; });
  assert.equal(error.statusCode, 500);
  assert.equal(error.customError, 'ImageUploadError');
  assert.equal(error.message, 'Access Denied');
});

test('valid upload saves the returned S3 location and trimmed title', async () => {
  let saved;
  class Image {
    constructor(data) { Object.assign(this, data); }
    async save() { saved = this; }
  }
  const { createImage } = loadController(async (file, folder) => {
    assert.equal(folder, 'gallery');
    assert.equal(file.name, 'craft.png');
    return { publicUrl: 'https://example.com/craft.png', fileKey: 'gallery/craft.png' };
  }, Image);
  let status;
  let body;
  await createImage({ body: { title: ' Craft ' }, files: { image: { name: 'craft.png' } } }, {
    status(value) { status = value; return this; },
    json(value) { body = value; },
  }, (err) => { throw err; });
  assert.equal(status, 201);
  assert.equal(body.success, true);
  assert.equal(saved.title, 'Craft');
  assert.equal(saved.imageKeys, 'gallery/craft.png');
});

test('missing images retain 404 during update and delete', async () => {
  const handlers = loadController(null, { findById: async () => null });
  for (const handler of [handlers.updateImage, handlers.deleteImage]) {
    let error;
    await handler({ params: { id: 'missing' }, body: {} }, {}, (err) => { error = err; });
    assert.equal(error.statusCode, 404);
    assert.equal(error.message, 'Image not found');
  }
});
