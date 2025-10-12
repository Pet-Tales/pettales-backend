const axios = require("axios");
const logger = require("../utils/logger");
const { LULU_API_URL, LULU_API_KEY } = require("../utils/constants");
const { Book } = require("../models");

class PrintOrderService {
  /**
   * Calculate Lulu print cost
   */
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel = "MAIL") {
    try {
      if (!bookId) throw new Error("Missing bookId");

      const bookDoc = await Book.findById(bookId).select("interior_pdf_url cover_pdf_url").lean();
      if (!bookDoc) throw new Error("Book not found");
      if (!bookDoc.interior_pdf_url || !bookDoc.cover_pdf_url)
        throw new Error("Missing PDFs for cost calc");

      const payload = {
        line_items: [
          {
            pod_package_id: "0600X0900BWSTDPB060UW444GXX",
            quantity: quantity || 1,
            cover_pdf_url: bookDoc.cover_pdf_url,
            interior_pdf_url: bookDoc.interior_pdf_url,
          },
        ],
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
      };

      logger.info("💰 Calculating Lulu print cost", { payload });

      const response = await axios.post(`${LULU_API_URL}/print-job-costs/`, payload, {
        headers: {
          Authorization: `Bearer ${LULU_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const cost = response.data;
      if (!cost || !cost.total_cost) throw new Error("Invalid cost response from Lulu");
      logger.info("✅ Lulu print cost calculated", { total_cost: cost.total_cost });
      return cost;
    } catch (err) {
      logger.error("❌ Failed to calculate Lulu cost", {
        error: err?.response?.data?.detail || err.message,
      });
      throw err;
    }
  }

  /**
   * Create Lulu print order
   */
  async createPrintOrder(data) {
    try {
      // Ensure title exists
      if (!data.title) {
        try {
          const bookDoc = await Book.findById(data.book_id).select("title").lean();
          if (bookDoc?.title) data.title = bookDoc.title;
        } catch (e) {
          logger.warn("Could not fetch book title for print order", { bookId: data.book_id });
        }
      }

      if (!data.cover_pdf_url || !data.interior_pdf_url) {
        throw new Error("Missing PDFs for print order");
      }

      const payload = {
        contact_email: data.shipping_address?.email,
        contact_phone: data.shipping_address?.phone_number,
        shipping_address: data.shipping_address,
        line_items: [
          {
            external_id: data.external_id || `book-${data.book_id}`,
            title: data.title || "Untitled Book",
            quantity: data.quantity || 1,
            pod_package_id: data.pod_package_id || "0600X0900BWSTDPB060UW444GXX",
            cover_pdf_url: data.cover_pdf_url,
            interior_pdf_url: data.interior_pdf_url,
          },
        ],
        shipping_level: data.shipping_level || "MAIL",
      };

      logger.info("📦 Sending Lulu print order", { payload });

      const response = await axios.post(`${LULU_API_URL}/print-jobs/`, payload, {
        headers: {
          Authorization: `Bearer ${LULU_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      logger.info("✅ Lulu print job created", { luluJobId: response.data.id });
      return response.data;
    } catch (err) {
      logger.error("❌ Failed to create Lulu print job", { error: err.message });
      throw err;
    }
  }
}

module.exports = new PrintOrderService();
