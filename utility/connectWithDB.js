require("dotenv").config();
const mongoose = require("mongoose");
const dbURL = "mongodb://127.0.0.1:27017/artandcraft_dev";

mongoose
  .connect(dbURL)
  .then(() => console.log("✅ Database connected successfully"))
  .catch((err) => console.error("❌ Database connection error:", err)); 