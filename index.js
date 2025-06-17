const express = require("express");
const app = express();
const PORT = 3000;
require("dotenv").config();

const { DEBUG_MODE_ENV } = process.env;

const DEBUG_MODE = DEBUG_MODE_ENV !== "false";

app.get("/", (req, res) => {
  res.send(
    `Hello, World! - ${DEBUG_MODE ? "Staging" : "Production"} Environment`
  );
});

app.listen(PORT, () => {
  console.log(`Server is listening at http://localhost:${PORT}`);
});
