const axios = require("axios");
const logger = require("../utils/logger");
const { LULU_API_URL, LULU_API_KEY } = require("../utils/constants");
const { Book } = require("../models");

class PrintOrderService {
  /**
   * Creates a print order at Lulu.
   * @param {Object} data - Payload containing book and address info
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

      // Validate required Lulu fields
      if (!data.cover_pdf_url || !data.interior_pdf_url) {
        throw new Error("Missing PDFs for print order");
      }
      if (!data.shipping_address?.country_code) {
        throw new Error("Missing country_code in shipping address");
      }

      const payload = {
        contact_email: data.shipping_address.email,
        contact_phone: data.shipping_address.phone_number,
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
      logger.error("❌ Failed to create Lulu print job", { error: err.message, stack: err.stack });
      throw err;
    }
  }
}

module.exports = new PrintOrderService();
