const Counter = require("../models/inventoryModel");
const crypto = require("crypto");


const generateOrderId = () => {
  const timestamp = Date.now(); // milliseconds since Jan 1, 1970
  const randomStr = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char hex
  return `ORD-${timestamp}-${randomStr}`;
};




module.exports = {generateOrderId};
