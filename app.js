const express = require("express");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const helmet = require("helmet");
// const mongoSanitize = require("express-mongo-sanitize");
const fileUpload = require("express-fileupload");
const {errorHandler} = require("./errors/CustomErrorHandler");

const app = express();

const { FIRST_PROJECT_LINK, SECOND_PROJECT_LINK } = process.env;

const allowedOrigins = [FIRST_PROJECT_LINK, SECOND_PROJECT_LINK, 'http://localhost:5174', 'http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: 'GET, POST, PUT, DELETE, OPTIONS, PATCH', 
  allowedHeaders: 'Content-Type, Authorization', 
  credentials: true,  
};

const UserRoutes = require("./routes/userRoutes");
const CategoryRoutes = require("./routes/categoryRouter")
const InventoryRoutes = require("./routes/inventoryRouter")
const variantRoutes = require("./routes/variantRoutes");
const ReviewRoutes = require("./routes/reviewRoutes")

app.use(helmet()); // Mitigates XSS attacks and ClickJacking
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
// app.use(mongoSanitize()); //Protects MongoDB from malicious query injections.
// app.use(fileUpload());

app.get("/", (req, res) => {
    res.send("Server is running");
  });
 
app.use("/api/users", UserRoutes);
app.use("/api/category",CategoryRoutes);
app.use("/api/inventory",InventoryRoutes);
app.use("/api/variants", variantRoutes);
app.use("/api/review",ReviewRoutes);
// Global error handling middleware
app.use(errorHandler);

app.use(function cb(req, res) { 
  res.status(404).json({
    status: "failure",
    message: " route not found",
  });
});


module.exports = app; 
