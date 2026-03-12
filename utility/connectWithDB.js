require("dotenv").config();
const mongoose = require("mongoose");
const dbURL = process.env.MONGODB_URL;

mongoose
  .connect(dbURL)
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => console.error("❌ Database connection error:", err)); 