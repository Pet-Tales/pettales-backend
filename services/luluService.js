const axios = require("axios");
const logger = require("../utils/logger");
const { LULU_API_URL, LULU_API_KEY } = require("../utils/constants");

async function createPrintJob(orderData) {
  try {
    const response = await axios.post(`${LULU_API_URL}/print-jobs/`, orderData, {
      headers: {
        Authorization: `Bearer ${LULU_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    logger.error("❌ Lulu print job creation failed", {
      detail:
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error.message,
    });
    throw new Error(
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error.message
    );
  }
}

async function calculatePrintCost(payload) {
  try {
    const response = await axios.post(`${LULU_API_URL}/print-job-costs/`, payload, {
      headers: {
        Authorization: `Bearer ${LULU_API_KEY}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  } catch (error) {
    logger.error("❌ Lulu cost calculation failed", {
      detail:
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        error.message,
    });
    throw new Error(
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error.message
    );
  }
}

module.exports = { createPrintJob, calculatePrintCost };
