const { CustomError } = require('../errors/CustomErrorHandler');
const badgeTypes = ['offer', 'alert', 'new_launch', 'info'];
const validTargetUrl = (value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password;
  } catch { return false; }
};
function validateAnnouncement(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CustomError('InvalidInput', 'Invalid announcement.', 400);
  const result = {};
  const invalid = (message) => { throw new CustomError('InvalidInput', message, 400); };
  if (!partial || body.text !== undefined) {
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 255) invalid('Announcement text is required and must be at most 255 characters.');
    result.text = body.text.trim();
  }
  if (body.badge !== undefined && (!body.badge || typeof body.badge !== 'object' || Array.isArray(body.badge))) invalid('Invalid badge settings.');
  const type = body.badge?.type !== undefined ? body.badge.type : body.badge_type;
  const label = body.badge?.text !== undefined ? body.badge.text : body.badge_text;
  if (type !== undefined) {
    if (!badgeTypes.includes(type)) invalid('Select a valid badge style.');
    result['badge.type'] = type;
  }
  if (label !== undefined) {
    if (typeof label !== 'string' || label.length > 15) invalid('Badge label must be at most 15 characters.');
    result['badge.text'] = label.trim();
  }
  const target = body.targetUrl !== undefined ? body.targetUrl : body.target_url;
  if (target !== undefined) {
    if (typeof target !== 'string' || target.length > 2048 || !validTargetUrl(target.trim())) invalid('Action link must be a valid HTTP or HTTPS URL.');
    result.targetUrl = target.trim();
  }
  const active = body.isActive !== undefined ? body.isActive : body.is_active;
  if (active !== undefined) {
    if (typeof active !== 'boolean') invalid('Status must be true or false.');
    result.isActive = active;
  }
  return result;
}
module.exports = { badgeTypes, validTargetUrl, validateAnnouncement };
