const { CustomError } = require('../errors/CustomErrorHandler');
const invalid = (message) => { throw new CustomError('InvalidInput', message, 400); };

function validateFaq(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('FAQ fields are required.');
  const fields = {};
  for (const [key, limit] of [['question', 300], ['answer', 10000]]) {
    if (!partial || Object.hasOwn(body, key)) {
      if (typeof body[key] !== 'string' || !body[key].trim() || body[key].trim().length > limit) {
        invalid(`${key === 'question' ? 'Question' : 'Answer'} must contain 1 to ${limit} characters.`);
      }
      fields[key] = body[key].trim();
    }
  }
  if (Object.hasOwn(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') invalid('isActive must be a boolean.');
    fields.isActive = body.isActive;
  }
  if (Object.hasOwn(body, 'sortOrder')) {
    if (!Number.isInteger(body.sortOrder) || body.sortOrder < 0 || body.sortOrder > 1000000) {
      invalid('Display order must be an integer between 0 and 1000000.');
    }
    fields.sortOrder = body.sortOrder;
  }
  if (partial && !Object.keys(fields).length) invalid('Provide at least one FAQ field to update.');
  return fields;
}
module.exports = { validateFaq };
