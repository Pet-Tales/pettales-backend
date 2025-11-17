const mongoose = require("mongoose");
const { PrintOrder, Book, User } = require("../models");
const luluService = require("./luluService");
const stripeService = require("./stripeService");
const printReadyPDFService = require("./printReadyPDFService");
const logger = require("../utils/logger");
const { PRINT_MARKUP_PERCENTAGE, SHIPPING_MARKUP_PERCENTAGE } = require("../utils/constants");

class PrintOrderService {
  /**
   * Calculate order cost including markup
   */
  async calculateOrderCost(bookId, quantity, shippingAddress, shippingLevel) {
    try {
      logger.info(
        `Calculating order cost for book ${bookId}, quantity: ${quantity}`
      );

      // Get book details
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      // First, get available shipping options for the destination
      logger.info("Getting available shipping options for destination", {
        country: shippingAddress.country_code,
        requestedShippingLevel: shippingLevel,
      });

      const availableShippingOptions = await luluService.getShippingOptions(
        shippingAddress,
        book.page_count,
        quantity
      );

      // Validate that the requested shipping level is available
      const isShippingLevelAvailable = availableShippingOptions.some(
        (option) => option.level === shippingLevel
      );

      if (!isShippingLevelAvailable) {
        const availableLevels = availableShippingOptions.map(
          (option) => option.level
        );
        logger.error("Requested shipping level not available", {
          requestedLevel: shippingLevel,
          availableLevels,
          country: shippingAddress.country_code,
          totalOptionsFound: availableShippingOptions.length,
        });
        throw new Error(
          `Shipping level "${shippingLevel}" is not available for ${
            shippingAddress.country_code
          }. Available options: ${availableLevels.join(", ") || "None"}`
        );
      }

      // Calculate cost using Lulu API
      logger.info("Calculating cost with validated shipping option", {
        bookPageCount: book.page_count,
        quantity,
        shippingLevel,
        country: shippingAddress.country_code,
      });

      const luluCostData = await luluService.calculatePrintCost(
        book.page_count,
        quantity,
        shippingAddress,
        shippingLevel
      );

      // Calculate costs with markup
      const luluPrintCost = parseFloat(luluCostData.line_item_costs?.[0]?.total_cost_incl_tax || 0);
      const luluShippingCost = parseFloat(luluCostData.shipping_cost?.total_cost_incl_tax || 0);
      const luluTotalCost = parseFloat(luluCostData.total_cost_incl_tax);

      // Apply markups
      const printMarkupPercentage = PRINT_MARKUP_PERCENTAGE || 100;
      const shippingMarkupPercentage = SHIPPING_MARKUP_PERCENTAGE || 5;

      const printCostWithMarkup = luluPrintCost * (1 + printMarkupPercentage / 100);
      const shippingCostWithMarkup = luluShippingCost * (1 + shippingMarkupPercentage / 100);
      const totalCostGBP = printCostWithMarkup + shippingCostWithMarkup;
      const totalCostCents = Math.ceil(totalCostGBP * 100);

      const costBreakdown = {
        book_id: bookId,
        book_title: book.title,
        page_count: book.page_count,
        quantity: quantity,
        lulu_cost_gbp: luluTotalCost,
        lulu_print_cost: luluPrintCost,
        lulu_shipping_cost: luluShippingCost,
        print_markup_percentage: printMarkupPercentage,
        shipping_markup_percentage: shippingMarkupPercentage,
        total_cost_gbp: totalCostGBP,
        total_cost_cents: totalCostCents,
        shipping_level: shippingLevel,
        currency: luluCostData.currency,
        cost_breakdown: {
          line_items: luluCostData.line_item_costs,
          shipping: luluCostData.shipping_cost,
          fulfillment: luluCostData.fulfillment_cost,
          fees: luluCostData.fees || [],
        },
        display_print_cost_gbp: printCostWithMarkup,
        display_shipping_cost_gbp: shippingCostWithMarkup,
      };

      logger.info("Order cost calculated successfully", {
        bookId,
        lulu_print_cost: luluPrintCost,
        lulu_shipping_cost: luluShippingCost,
        display_print_cost_gbp: printCostWithMarkup,
        display_shipping_cost_gbp: shippingCostWithMarkup,
        total_cost_gbp: totalCostGBP,
        totalCostCents,
        luluTotalCost,
      });

      return costBreakdown;
    } catch (error) {
      logger.error("Failed to calculate order cost:", error.message);
      throw new Error(`${error.message.replace("Error: ", "")}`);
    }
  }

  /**
   * Create a Stripe checkout session for print order
   */
    async createPrintOrderCheckout(userId, orderData) {
    try {
      // 🔒 Never let null/undefined reach Stripe or .toString()
      const safeUserId = userId ? String(userId) : ""; // empty string instead of null
      const {
        bookId,
        quantity,
        shippingAddress,
        shippingLevel,
      } = orderData ?? {};

      const qty = Number.isFinite(Number(quantity)) ? Number(quantity) : 1;

      logger.info(`Creating print order checkout session`, {
        userId: safeUserId || "(guest)",
        bookId,
        quantity: qty,
        shippingLevel,
      });

      // Validate book exists and user has access
      const book = await Book.findById(bookId);
      if (!book) {
        throw new Error("Book not found");
      }

      // Treat several possible flags as "public"
      const isPublic = !!(
        book?.is_public === true ||
        book?.isPublic === true ||
        book?.visibility === "public" ||
        book?.public === true ||
        book?.is_template_public === true
      );

      // Normalise owner id field (user_id vs user vs owner/created_by)
      const ownerId = (book?.user_id || book?.user || book?.owner || book?.created_by);
      const isOwner = !!(ownerId && safeUserId && String(ownerId) === safeUserId);

      if (!isOwner && !isPublic) {
        throw new Error("You can only print your own books");
      }

      if (book.generation_status !== "completed") {
        throw new Error("Book must be completed before printing");
      }

      // Calculate cost with safe qty
      const costData = await this.calculateOrderCost(
        bookId,
        qty,
        shippingAddress,
        shippingLevel
      );

      // Get user email only if we actually have a user id
      const user = safeUserId ? await User.findById(safeUserId) : null;
      const userEmail = user?.email || undefined;

      // ✅ Stripe requires strings in metadata; never call .toString() on maybe-null
      const metadata = {
        order_type: "print",
        book_id: String(bookId ?? ""),
        user_id: safeUserId, // always a string ("" for guest)
        quantity: String(qty),
        page_count: String(book.page_count ?? ""),
        shipping_level: String(shippingLevel ?? ""),
        shipping_country: String(shippingAddress?.country_code ?? ""),
        shipping_city: String(shippingAddress?.city ?? ""),
        shipping_state: String(shippingAddress?.state_code ?? ""),
        shipping_postal_code: String(shippingAddress?.postal_code ?? ""),
        lulu_print_cost: String(costData.lulu_print_cost ?? ""),
        lulu_shipping_cost: String(costData.lulu_shipping_cost ?? ""),
        print_markup: String(costData.print_markup_percentage ?? ""),
        shipping_markup: String(costData.shipping_markup_percentage ?? ""),
      };

      const session = await stripeService.createPrintCheckoutSession(
        bookId,
        costData.total_cost_cents,    // number OK for Stripe amount
        safeUserId,                   // never null
        userEmail,
        metadata
      );

      logger.info("Print order checkout session created", {
        sessionId: session.id,
        bookId,
        userId: safeUserId || "(guest)",
        totalCostCents: costData.total_cost_cents,
      });

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
        costData,
      };
    } catch (error) {
      logger.error("Failed to create print order checkout:", error.message);
      throw new Error(`Failed to create print order checkout: ${error.message}`);
    }
  }


  /**
   * Create a new print order (called after successful payment)
   */
  async createPrintOrder(userId, orderData, stripeSessionId = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info(`Creating print order for user ${userId}`);

      const { bookId, quantity, shippingAddress, shippingLevel, costData } = orderData;

      // Validate book exists
      const book = await Book.findById(bookId).session(session);
      if (!book) {
        throw new Error("Book not found");
      }

      // Generate external ID for the print order
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      const externalId = `PTO_${timestamp}_${random}`;

      // Create print order
      const printOrder = new PrintOrder({
        user_id: userId,
        book_id: bookId,
        external_id: externalId,
        quantity: quantity,
        total_cost_cents: costData.total_cost_cents,
        lulu_cost_gbp: costData.lulu_cost_gbp,
        markup_percentage: costData.print_markup_percentage,
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
        stripe_session_id: stripeSessionId,
        status: "created",
      });

      // Save the order within the session to get the MongoDB _id
      await printOrder.save({ session });

      // Generate print-ready PDFs with the order ID
      const pdfUrls = await this.generatePrintReadyPDFs(bookId, userId, printOrder._id.toString());

      // Update the order with PDF URLs
      printOrder.cover_pdf_url = pdfUrls.coverPdfUrl;
      printOrder.interior_pdf_url = pdfUrls.interiorPdfUrl;

      await printOrder.save({ session });

      logger.info("📤 Submitting print order to Lulu", {
        printOrderId: printOrder._id,
        externalId: printOrder.external_id,
        stripeSessionId,
        userId,
        bookId,
        quantity,
        shippingCountry: shippingAddress.country_code,
        shippingPostcode: shippingAddress.postal_code,
        shippingLevel,
        hasCoverPdf: !!pdfUrls.coverPdfUrl,
        hasInteriorPdf: !!pdfUrls.interiorPdfUrl,
      });
      // Submit to Lulu API
      const luluPrintJob = await luluService.createPrintJob({
        external_id: printOrder.external_id,
        title: book.title,
        quantity: quantity,
        shipping_address: shippingAddress,
        shipping_level: shippingLevel,
        cover_pdf_url: pdfUrls.coverPdfUrl,
        interior_pdf_url: pdfUrls.interiorPdfUrl,
      });

      // Update print order with Lulu job ID and status
      printOrder.lulu_print_job_id = luluPrintJob.id;
      printOrder.status = luluPrintJob.status?.name?.toLowerCase() || "unpaid";
      printOrder.ordered_at = new Date();
      await printOrder.save({ session });

      await session.commitTransaction();

      logger.info("Print order created successfully", {
        printOrderId: printOrder._id,
        externalId: printOrder.external_id,
        luluPrintJobId: luluPrintJob.id,
      });

      return {
        printOrder: await PrintOrder.findById(printOrder._id).populate(
          "book_id",
          "title"
        ),
        costData,
      };
    } catch (error) {
      logger.error("❌ Failed to create print order", {
        message: error.message,
        stack: error.stack,
        userId,
        orderData,
        stripeSessionId,
      });
      throw new Error(`Failed to create print order: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  /**
   * Process successful print payment from Stripe webhook
   */
  async processPrintPaymentSuccess(stripeSession) {
    try {
      async processPrintPaymentSuccess(stripeSession) {
    try {
      logger.info("🔔 Stripe webhook: processPrintPaymentSuccess START", {
        stripeSessionId: stripeSession.id,
        paymentStatus: stripeSession.payment_status,
        amountTotal: stripeSession.amount_total,
        currency: stripeSession.currency,
        metadata: stripeSession.metadata,
      });

      const { metadata } = stripeSession;

      if (metadata.order_type !== "print" && metadata.type !== "book_print") {
        return;
      }

      // Check if print order already exists for this session
      const existingOrder = await PrintOrder.findOne({
        stripe_session_id: stripeSession.id,
      });

      if (existingOrder) {
        logger.info(`Print order already exists for session ${stripeSession.id}`);
        return existingOrder;
      }

      // Reconstruct order data from metadata
      const orderData = {
        bookId: metadata.book_id,
        quantity: parseInt(metadata.quantity),
        shippingAddress: {
          country_code: metadata.shipping_country,
          city: metadata.shipping_city,
          state_code: metadata.shipping_state,
          postal_code: metadata.shipping_postal_code,
          // Note: Full address details should be collected from Stripe checkout
          name: stripeSession.shipping_details?.name || stripeSession.customer_details?.name,
          line1: stripeSession.shipping_details?.address?.line1,
          line2: stripeSession.shipping_details?.address?.line2,
        },
        shippingLevel: metadata.shipping_level,
        costData: {
          total_cost_cents: stripeSession.amount_total,
          lulu_cost_gbp: parseFloat(metadata.lulu_print_cost) + parseFloat(metadata.lulu_shipping_cost),
          print_markup_percentage: parseInt(metadata.print_markup),
        },
      };
logger.info("🔧 Stripe webhook: about to call createPrintOrder", {
        stripeSessionId: stripeSession.id,
        userId: metadata.user_id,
        bookId: orderData.bookId,
        quantity: orderData.quantity,
        shippingCountry: orderData.shippingAddress.country_code,
        shippingPostcode: orderData.shippingAddress.postal_code,
        shippingLevel: orderData.shippingLevel,
      });
      // Create the print order
      const result = await this.createPrintOrder(
        metadata.user_id,
        orderData,
        stripeSession.id
      );

      logger.info("Print order created from Stripe webhook", {
        printOrderId: result.printOrder._id,
        stripeSessionId: stripeSession.id,
      });

      return result.printOrder;
    } catch (error) {
      logger.error("Failed to process print payment:", error.message);
      throw error;
    }
  }

  /**
   * Generate print-ready PDFs for a book
   */
  async generatePrintReadyPDFs(bookId, userId, orderId) {
    try {
      logger.info(`Generating print-ready PDFs for book ${bookId}`);

      // Use the dedicated print-ready PDF service
      const pdfUrls = await printReadyPDFService.generatePrintReadyPDFs(bookId, userId, orderId);

      logger.info("Print-ready PDFs generated successfully", {
        bookId,
        userId,
        orderId,
        coverPdfUrl: pdfUrls.coverPdfUrl,
        interiorPdfUrl: pdfUrls.interiorPdfUrl,
      });

      return pdfUrls;
    } catch (error) {
      logger.error("Failed to generate print-ready PDFs:", error.message);
      throw new Error(`Failed to generate print-ready PDFs: ${error.message}`);
    }
  }

  /**
   * Get user's print orders
   */
  async getUserPrintOrders(userId, options = {}) {
    try {
      const { page = 1, limit = 10, status } = options;
      const skip = (page - 1) * limit;

      const query = { user_id: userId };
      if (status) {
        query.status = status;
      }

      const orders = await PrintOrder.find(query)
        .populate("book_id", "title front_cover_image_url")
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit);

      const total = await PrintOrder.countDocuments(query);

      return {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error("Failed to get user print orders:", error.message);
      throw new Error("Failed to get user print orders");
    }
  }

  /**
   * Get print order by ID
   */
  async getPrintOrderById(orderId, userId = null) {
    try {
      const query = { _id: orderId };
      if (userId) {
        query.user_id = userId;
      }

      const order = await PrintOrder.findOne(query)
        .populate("book_id", "title front_cover_image_url page_count")
        .populate("user_id", "first_name last_name email");

      if (!order) {
        throw new Error("Print order not found");
      }

      return order;
    } catch (error) {
      logger.error("Failed to get print order:", error.message);
      throw new Error("Failed to get print order");
    }
  }

  /**
   * Cancel a print order
   */
  async cancelPrintOrder(orderId, userId) {
    try {
      logger.info(`Canceling print order ${orderId} for user ${userId}`);

      const printOrder = await PrintOrder.findOne({
        _id: orderId,
        user_id: userId,
      });

      if (!printOrder) {
        throw new Error("Print order not found");
      }

      if (!printOrder.canBeCanceled()) {
        throw new Error("Print order cannot be canceled at this stage");
      }

      // Cancel with Lulu if we have a print job ID
      if (printOrder.lulu_print_job_id) {
        try {
          await luluService.cancelPrintJob(printOrder.lulu_print_job_id);
        } catch (error) {
          logger.warn(
            "Failed to cancel Lulu print job, continuing with local cancellation:",
            error.message
          );
        }
      }

      // Update order status
      printOrder.status = "canceled";
      await printOrder.save();

      // TODO: Process Stripe refund if needed
      if (printOrder.stripe_session_id) {
        logger.info("Note: Stripe refund should be processed manually for now", {
          orderId,
          stripeSessionId: printOrder.stripe_session_id,
        });
      }

      logger.info("Print order canceled successfully", {
        orderId,
      });

      return printOrder;
    } catch (error) {
      logger.error("Failed to cancel print order:", error.message);
      throw new Error(`Failed to cancel print order: ${error.message}`);
    }
  }

  /**
   * Update print order status from Lulu webhook
   */
  async updatePrintOrderFromWebhook(webhookData) {
    try {
      const { id: luluPrintJobId, status, line_item_statuses } = webhookData;

      const printOrder = await PrintOrder.findOne({
        lulu_print_job_id: luluPrintJobId,
      });
      if (!printOrder) {
        logger.warn(`Print order not found for Lulu job ID: ${luluPrintJobId}`);
        return null;
      }

      const oldStatus = printOrder.status;
      const newStatus = status.name.toLowerCase();

      // Update order status
      printOrder.status = newStatus;

      // Handle status-specific updates
      if (
        newStatus === "shipped" &&
        line_item_statuses &&
        line_item_statuses.length > 0
      ) {
        const trackingInfo = line_item_statuses[0].messages;
        if (trackingInfo) {
          printOrder.tracking_info = {
            tracking_id: trackingInfo.tracking_id,
            tracking_urls: trackingInfo.tracking_urls || [],
            carrier_name: trackingInfo.carrier_name,
          };
          printOrder.shipped_at = new Date();
        }
      }

      if (newStatus === "rejected") {
        printOrder.error_message =
          status.message || "Order was rejected by Lulu";
      }

      await printOrder.save();

      logger.info("Print order status updated from webhook", {
        printOrderId: printOrder._id,
        luluPrintJobId,
        oldStatus,
        newStatus,
      });

      return printOrder;
    } catch (error) {
      logger.error("Failed to update print order from webhook:", error.message);
      throw error;
    }
  }


/**
 * Process successful print payment from Stripe webhook
 * This is called when Stripe confirms payment completion
 */
async processPrintPaymentSuccess(stripeSession) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { metadata } = stripeSession;

    // Validate this is a print order
    if (metadata.order_type !== "print" && metadata.type !== "book_print") {
      logger.info(`Session ${stripeSession.id} is not a print order, skipping`);
      return null;
    }

    logger.info(`Processing print payment success for session ${stripeSession.id}`, {
      bookId: metadata.book_id,
      userId: metadata.user_id,
      quantity: metadata.quantity
    });

    // Check for existing order (idempotency)
    let existingOrder = await PrintOrder.findOne({
      stripe_session_id: stripeSession.id,
    }).session(session);

    if (existingOrder) {
      logger.info(`[IDEMPOTENCY] Print order already exists for session ${stripeSession.id}`, {
        orderId: existingOrder._id,
        status: existingOrder.status,
        luluJobId: existingOrder.lulu_print_job_id,
        luluSubmissionStatus: existingOrder.lulu_submission_status,
        attempts: existingOrder.lulu_submission_attempts
      });
      
      // If order exists but Lulu submission failed, retry
      if (existingOrder.lulu_submission_status === 'failed' && 
          existingOrder.lulu_submission_attempts < 3) {
        logger.info(`Retrying Lulu submission for order ${existingOrder._id}`);
        await this.submitOrderToLulu(existingOrder._id, session);
      }
      
      await session.commitTransaction();
      return existingOrder;
    }

    // Parse metadata
    const bookId = metadata.book_id;
    const userId = metadata.user_id;
    const quantity = parseInt(metadata.quantity);

    // Validate book exists
    const book = await Book.findById(bookId).session(session);
    if (!book) {
      throw new Error(`Book not found: ${bookId}`);
    }

    // Generate external ID
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const externalId = `PTO_${timestamp}_${random}`;

    // Reconstruct shipping address from Stripe data
    // Stripe may return shipping under: collected_information.shipping_details, shipping_details, or shipping
    const collectedShipping = stripeSession.collected_information?.shipping_details;
    const directShipping = stripeSession.shipping_details || stripeSession.shipping;
    const stripeShipping = collectedShipping || directShipping;
    const customerDetails = stripeSession.customer_details;
    
    logger.info(`Extracting shipping data from Stripe session ${stripeSession.id}`, {
      hasCollectedShipping: !!collectedShipping,
      hasDirectShipping: !!directShipping,
      shippingName: stripeShipping?.name,
      addressLine1: stripeShipping?.address?.line1,
      addressCity: stripeShipping?.address?.city,
      addressCountry: stripeShipping?.address?.country,
    });
    
    // Normalize Stripe fields to PrintOrder schema field names
    const shippingAddress = {
      name: stripeShipping?.name || customerDetails?.name || "Customer",
      street1: stripeShipping?.address?.line1 || metadata.shipping_city || "", // Fallback to metadata if missing
      street2: stripeShipping?.address?.line2 || "",
      city: stripeShipping?.address?.city || metadata.shipping_city || "",
      state_code: stripeShipping?.address?.state || metadata.shipping_state || "",
      postcode: stripeShipping?.address?.postal_code || metadata.shipping_postal_code || "",
      country_code: stripeShipping?.address?.country || metadata.shipping_country || "US",
      phone_number: customerDetails?.phone || "N/A",
      email: customerDetails?.email || metadata.customer_email || ""
    };

    // Log normalized address before validation
    logger.info(`Normalized shipping address for order`, {
      sessionId: stripeSession.id,
      address: {
        name: shippingAddress.name,
        street1: shippingAddress.street1,
        city: shippingAddress.city,
        state_code: shippingAddress.state_code,
        postcode: shippingAddress.postcode,
        country_code: shippingAddress.country_code,
      }
    });

    // Validate required fields before creating order
    if (!shippingAddress.street1 || !shippingAddress.postcode) {
      const missingFields = [];
      if (!shippingAddress.street1) missingFields.push('street1');
      if (!shippingAddress.postcode) missingFields.push('postcode');
      
      throw new Error(`Missing required shipping fields: ${missingFields.join(', ')}. Stripe session may not have collected shipping address.`);
    }

    // Create print order record
    const printOrder = new PrintOrder({
      user_id: userId,
      book_id: bookId,
      external_id: externalId,
      quantity: quantity,
      total_cost_cents: stripeSession.amount_total,
      lulu_cost_gbp: parseFloat(metadata.lulu_print_cost) + parseFloat(metadata.lulu_shipping_cost),
      markup_percentage: parseInt(metadata.print_markup || metadata.print_markup_percentage || 100),
      shipping_address: shippingAddress,
      shipping_level: metadata.shipping_level,
      stripe_session_id: stripeSession.id,
      stripe_payment_intent_id: stripeSession.payment_intent,
      status: "created",
      lulu_submission_status: "pending",
      ordered_at: new Date()
    });

    await printOrder.save({ session });

    logger.info(`Print order created from Stripe webhook`, {
      orderId: printOrder._id,
      externalId: printOrder.external_id,
      stripeSessionId: stripeSession.id
    });

    // Submit to Lulu
    await this.submitOrderToLulu(printOrder._id, session);

    await session.commitTransaction();

    return await PrintOrder.findById(printOrder._id)
      .populate("book_id", "title")
      .populate("user_id", "email");

  } catch (error) {
    await session.abortTransaction();
    logger.error(`Failed to process print payment: ${error.message}`, {
      sessionId: stripeSession.id,
      error: error.stack
    });
    
    // Don't throw - we don't want to fail the webhook
    // Mark order as needing retry if it exists
    try {
      await PrintOrder.findOneAndUpdate(
        { stripe_session_id: stripeSession.id },
        { 
          lulu_submission_status: 'retry_needed',
          lulu_submission_error: error.message
        }
      );
    } catch (updateError) {
      logger.error(`Failed to mark order for retry: ${updateError.message}`);
    }
    
    return null;
  } finally {
    session.endSession();
  }
}

/**
 * Submit order to Lulu (separate method for retries)
 */
async submitOrderToLulu(printOrderId, session = null) {
  const useSession = session || (await mongoose.startSession());
  if (!session) useSession.startTransaction();

  try {
    const printOrder = await PrintOrder.findById(printOrderId)
      .populate('book_id')
      .session(useSession);

    if (!printOrder) {
      throw new Error(`Print order not found: ${printOrderId}`);
    }

    // Check if already submitted
    if (printOrder.lulu_print_job_id) {
      logger.info(`Order ${printOrderId} already submitted to Lulu`, {
        luluJobId: printOrder.lulu_print_job_id
      });
      return printOrder;
    }

    // Update submission status
    printOrder.lulu_submission_status = 'submitting';
    printOrder.lulu_submission_attempts += 1;
    await printOrder.save({ session: useSession });

    logger.info(`Submitting order ${printOrderId} to Lulu (attempt ${printOrder.lulu_submission_attempts})`);

    // Generate PDFs if not already present
    if (!printOrder.cover_pdf_url || !printOrder.interior_pdf_url) {
      const pdfUrls = await this.generatePrintReadyPDFs(
        printOrder.book_id._id,
        printOrder.user_id,
        printOrderId
      );
      
      printOrder.cover_pdf_url = pdfUrls.coverPdfUrl;
      printOrder.interior_pdf_url = pdfUrls.interiorPdfUrl;
      await printOrder.save({ session: useSession });
    }

    // Submit to Lulu API
    const luluPrintJob = await luluService.createPrintJob({
      external_id: printOrder.external_id,
      title: printOrder.book_id.title,
      quantity: printOrder.quantity,
      shipping_address: printOrder.shipping_address,
      shipping_level: printOrder.shipping_level,
      cover_pdf_url: printOrder.cover_pdf_url,
      interior_pdf_url: printOrder.interior_pdf_url,
    });

    // Update order with Lulu response
    printOrder.lulu_print_job_id = luluPrintJob.id;
    printOrder.status = luluPrintJob.status?.name?.toLowerCase() || "unpaid";
    printOrder.lulu_submission_status = 'submitted';
    printOrder.lulu_submitted_at = new Date();
    printOrder.lulu_submission_error = null;
    
    await printOrder.save({ session: useSession });

    if (!session) {
      await useSession.commitTransaction();
    }

    logger.info(`Successfully submitted order to Lulu`, {
      orderId: printOrderId,
      luluJobId: luluPrintJob.id,
      status: luluPrintJob.status?.name
    });

    // Log shipping address used in Lulu submission for verification
    logger.info(`Lulu submission used shipping address`, {
      orderId: printOrderId,
      luluJobId: luluPrintJob.id,
      shippingAddress: {
        name: printOrder.shipping_address.name,
        street1: printOrder.shipping_address.street1,
        street2: printOrder.shipping_address.street2,
        city: printOrder.shipping_address.city,
        state_code: printOrder.shipping_address.state_code,
        postcode: printOrder.shipping_address.postcode,
        country_code: printOrder.shipping_address.country_code,
      }
    });

    return printOrder;

  } catch (error) {
    if (!session) {
      await useSession.abortTransaction();
    }
    
    // Update order with error
    await PrintOrder.findByIdAndUpdate(printOrderId, {
      lulu_submission_status: 'failed',
      lulu_submission_error: error.message
    });
    
    logger.error(`Failed to submit order to Lulu: ${error.message}`, {
      orderId: printOrderId,
      error: error.stack
    });
    
    throw error;
  } finally {
    if (!session) {
      useSession.endSession();
    }
  }
}

/**
 * Retry failed Lulu submissions (can be called by a scheduled job)
 */
async retryFailedLuluSubmissions() {
  try {
    const failedOrders = await PrintOrder.find({
      lulu_submission_status: { $in: ['failed', 'retry_needed'] },
      lulu_submission_attempts: { $lt: 3 },
      created_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).limit(10);

    logger.info(`Found ${failedOrders.length} orders to retry Lulu submission`);

    for (const order of failedOrders) {
      try {
        await this.submitOrderToLulu(order._id);
        logger.info(`Successfully retried Lulu submission for order ${order._id}`);
      } catch (error) {
        logger.error(`Failed to retry Lulu submission for order ${order._id}: ${error.message}`);
      }
    }
  } catch (error) {
    logger.error(`Failed to retry Lulu submissions: ${error.message}`);
  }
}
}

module.exports = new PrintOrderService();
