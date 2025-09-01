/**
 * Print order shipped email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the book
 * @param {string} params.orderId - Order ID
 * @param {string} params.trackingId - Tracking ID
 * @param {Array} params.trackingUrls - Array of tracking URLs
 * @param {string} params.carrierName - Carrier name
 * @param {string} params.shippingAddress - Formatted shipping address
 * @param {string} params.myOrdersUrl - My orders URL
 * @returns {Object} Email template with subject and body
 */
const printOrderShippedTemplate = (params) => {
  const { 
    firstName, 
    bookTitle, 
    orderId, 
    trackingId, 
    trackingUrls = [], 
    carrierName, 
    shippingAddress,
    myOrdersUrl 
  } = params;

  const primaryTrackingUrl = trackingUrls.length > 0 ? trackingUrls[0] : null;

  return {
    subject: `📦 Your book "${bookTitle}" has shipped!`,
    textBody: `
Hello ${firstName},

Great news! Your personalized children's book "${bookTitle}" has been shipped and is on its way to you.

Order Details:
- Order ID: ${orderId}
- Book: ${bookTitle}
- Shipping Address: ${shippingAddress}

Tracking Information:
- Tracking ID: ${trackingId}
- Carrier: ${carrierName}
${primaryTrackingUrl ? `- Track your package: ${primaryTrackingUrl}` : ''}

Your book should arrive within the estimated delivery timeframe. You can track your order status and view all your orders at: ${myOrdersUrl}

Thank you for choosing PetTalesAI for your personalized children's books!

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your book has shipped!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #28a745; text-align: center; margin-bottom: 30px;">📦 Your Book Has Shipped!</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>Great news! Your personalized children's book <strong>"${bookTitle}"</strong> has been shipped and is on its way to you.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="color: #28a745; margin-top: 0;">Order Details</h3>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Book:</strong> ${bookTitle}</p>
      <p><strong>Shipping Address:</strong><br>${shippingAddress.replace(/\n/g, '<br>')}</p>
    </div>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
      <h3 style="color: #007bff; margin-top: 0;">📍 Tracking Information</h3>
      <p><strong>Tracking ID:</strong> ${trackingId}</p>
      <p><strong>Carrier:</strong> ${carrierName}</p>
      ${primaryTrackingUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${primaryTrackingUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">📦 Track Your Package</a>
      </div>
      ` : ''}
    </div>
    
    <p>Your book should arrive within the estimated delivery timeframe. You can track your order status and view all your orders:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View My Orders</a>
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

module.exports = printOrderShippedTemplate;
