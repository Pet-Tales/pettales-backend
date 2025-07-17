const mongoose = require("mongoose");
const { MONGODB_URI } = require("../utils/constants");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    logger.database("connect", "mongodb", true, {
      host: conn.connection.host,
      database: conn.connection.name,
    });
  } catch (error) {
    logger.database("connect", "mongodb", false, { error: error.message });
    process.exit(1);
  }
};

module.exports = connectDB;
