const { CustomError } = require('../errors/CustomErrorHandler');
const { validTargetUrl } = require('./announcementValidation');
const displayTypes = ['promotion', 'newsletter_signup', 'coupon_unlock', 'clearance_countdown'];
const themes = ['glass_dark', 'glass_light'];
const validCtaUrl = (value) => !value || validTargetUrl(value) ||
  (typeof value === 'string' && /^\/(?![\/\\])/.test(value) && !/[\\\x00-\x20]/.test(value));
const validEmail = (value) => typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
function validatePopup(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CustomError('InvalidInput', 'Invalid campaign.', 400);
  const result = {};
  const invalid = (message) => { throw new CustomError('InvalidInput', message, 400); };
  const aliases = { imageUrl: 'image_url', ctaText: 'cta_text', ctaUrl: 'cta_url', couponCode: 'coupon_code', displayType: 'display_type', backgroundTheme: 'background_theme', isActive: 'is_active' };
  const value = (key) => body[key] !== undefined ? body[key] : body[aliases[key]];
  for (const [key, maximum, required] of [['title', 120, true], ['subtitle', 500, false], ['ctaText', 50, true], ['imageUrl', 2048, false], ['ctaUrl', 2048, false], ['couponCode', 40, false]]) {
    const input = value(key);
    if (input === undefined && (partial || !required)) continue;
    if (typeof input !== 'string' || input.length > maximum || (required && !input.trim())) invalid(`${key} ${required ? 'is required and' : ''} must be at most ${maximum} characters.`);
    result[key] = input.trim();
  }
  if (result.imageUrl && !validTargetUrl(result.imageUrl)) invalid('Image must use an HTTP or HTTPS URL.');
  if (result.ctaUrl !== undefined && !validCtaUrl(result.ctaUrl)) invalid('CTA target must be an HTTP/HTTPS URL or a path starting with /.');
  for (const [key, options] of [['displayType', displayTypes], ['backgroundTheme', themes]]) {
    const input = value(key);
    if (input !== undefined) { if (!options.includes(input)) invalid(`Invalid ${key}.`); result[key] = input; }
  }
  if (value('isActive') !== undefined) {
    if (typeof value('isActive') !== 'boolean') invalid('Status must be true or false.');
    result.isActive = value('isActive');
  }
  if (body.priority_order !== undefined) {
    if (!Number.isSafeInteger(body.priority_order) || body.priority_order < 1) invalid('Priority must be a positive integer.');
    result.priority_order = body.priority_order;
  }
  if (body.endsAt !== undefined) {
    if (body.endsAt === null || body.endsAt === '') result.endsAt = null;
    else {
      if (typeof body.endsAt !== 'string' || !Number.isFinite(Date.parse(body.endsAt))) invalid('Enter a valid countdown end date.');
      result.endsAt = new Date(body.endsAt);
    }
  }
  return result;
}
function validateCompletePopup(document) {
  if (document.displayType !== 'newsletter_signup' && !document.ctaUrl) throw new CustomError('InvalidInput', 'CTA target is required for this campaign type.', 400);
  if (document.displayType === 'clearance_countdown' && !document.endsAt) throw new CustomError('InvalidInput', 'Countdown campaigns require an end date.', 400);
  if (document.isActive && document.endsAt && new Date(document.endsAt).getTime() <= Date.now()) throw new CustomError('InvalidInput', 'An active campaign must have a future end date.', 400);
}
module.exports = { displayTypes, themes, validCtaUrl, validEmail, validatePopup, validateCompletePopup };
