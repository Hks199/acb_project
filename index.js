require('dotenv').config();
const { PORT } = process.env;
const app = require("./app");

require("./utility/connectWithDB");



app.listen(PORT || 5000, () => {
  console.log(`Server is listening on port ${PORT || 5000}`);
});