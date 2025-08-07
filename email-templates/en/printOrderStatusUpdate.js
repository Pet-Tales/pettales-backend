/**
 * Print order general status update email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the book
 * @param {string} params.orderId - Order ID
 * @param {string} params.status - Current order status
 * @param {string} params.statusMessage - Human-readable status message
 * @param {string} params.myOrdersUrl - My orders URL
 * @returns {Object} Email template with subject and body
 */
const printOrderStatusUpdateTemplate = (params) => {
  const { 
    firstName, 
    bookTitle, 
    orderId, 
    status,
    statusMessage,
    myOrdersUrl 
  } = params;

  // Generate human-readable status messages
  const getStatusMessage = (status) => {
    switch (status.toLowerCase()) {
      case 'created':
        return 'Your order has been created and is being processed.';
      case 'unpaid':
        return 'Your order is awaiting payment confirmation.';
      case 'payment_in_progress':
        return 'Your payment is being processed.';
      case 'production_delayed':
        return 'Your order has been temporarily delayed in production. We apologize for any inconvenience.';
      case 'production_ready':
        return 'Your order is ready to enter production.';
      default:
        return statusMessage || `Your order status has been updated to: ${status}`;
    }
  };

  const displayMessage = getStatusMessage(status);

  return {
    subject: `📋 Update on your book order "${bookTitle}"`,
    textBody: `
Hello ${firstName},

We wanted to update you on the status of your print order for "${bookTitle}".

Order Details:
- Order ID: ${orderId}
- Book: ${bookTitle}
- Current Status: ${status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

Status Update:
${displayMessage}

You can view your complete order details and track progress at: ${myOrdersUrl}

Thank you for choosing PetTalesAI for your personalized children's books!

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Order status update</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #6c757d; text-align: center; margin-bottom: 30px;">📋 Order Status Update</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>We wanted to update you on the status of your print order for <strong>"${bookTitle}"</strong>.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
      <h3 style="color: #6c757d; margin-top: 0;">Order Details</h3>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Book:</strong> ${bookTitle}</p>
      <p><strong>Current Status:</strong> ${status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
    </div>
    
    <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #495057;">
      <h3 style="color: #495057; margin-top: 0;">📢 Status Update</h3>
      <p>${displayMessage}</p>
    </div>
    
    <p>You can view your complete order details and track progress:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Order Details</a>
    </div>
    
    <p style="margin-top: 30px;">Thank you for choosing PetTalesAI for your personalized children's books!</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Best regards,<br>The PetTalesAI Team</p>
      <p>If you have any questions about your order, feel free to reach out to our support team.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderStatusUpdateTemplate;
