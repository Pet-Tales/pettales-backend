/**
 * Print order rejected email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the book
 * @param {string} params.orderId - Order ID
 * @param {string} params.errorMessage - Rejection reason
 * @param {number} params.creditsRefunded - Amount of credits refunded
 * @param {string} params.myOrdersUrl - My orders URL
 * @param {string} params.supportEmail - Support email address
 * @returns {Object} Email template with subject and body
 */
const printOrderRejectedTemplate = (params) => {
  const { 
    firstName, 
    bookTitle, 
    orderId, 
    errorMessage, 
    creditsRefunded,
    myOrdersUrl,
    supportEmail 
  } = params;

  return {
    subject: `❌ Issue with your book order "${bookTitle}" - Credits Refunded`,
    textBody: `
Hello ${firstName},

We're sorry to inform you that there was an issue with your print order for "${bookTitle}" and it could not be processed.

Order Details:
- Order ID: ${orderId}
- Book: ${bookTitle}
- Issue: ${errorMessage || 'Technical issue during processing'}

Refund Information:
We have automatically refunded ${creditsRefunded} credits to your account. These credits are now available for use on your next order.

What's Next:
1. You can try placing a new order for the same book
2. Check if there are any issues with the book content or cover images
3. Contact our support team if you need assistance: ${supportEmail}

You can view your order history and current credit balance at: ${myOrdersUrl}

We apologize for any inconvenience and appreciate your understanding.

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Issue with your book order</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #dc3545; text-align: center; margin-bottom: 30px;">❌ Issue with Your Order</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>We're sorry to inform you that there was an issue with your print order for <strong>"${bookTitle}"</strong> and it could not be processed.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
      <h3 style="color: #dc3545; margin-top: 0;">Order Details</h3>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Book:</strong> ${bookTitle}</p>
      <p><strong>Issue:</strong> ${errorMessage || 'Technical issue during processing'}</p>
    </div>
    
    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="color: #155724; margin-top: 0;">💰 Refund Information</h3>
      <p>We have automatically refunded <strong>${creditsRefunded} credits</strong> to your account. These credits are now available for use on your next order.</p>
    </div>
    
    <h3 style="color: #E9B80C; margin-top: 30px;">What's Next?</h3>
    <ol style="padding-left: 20px;">
      <li>You can try placing a new order for the same book</li>
      <li>Check if there are any issues with the book content or cover images</li>
      <li>Contact our support team if you need assistance: <a href="mailto:${supportEmail}" style="color: #007bff;">${supportEmail}</a></li>
    </ol>
    
    <p>You can view your order history and current credit balance:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View My Orders</a>
    </div>
    
    <p style="margin-top: 30px;">We apologize for any inconvenience and appreciate your understanding.</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Best regards,<br>The PetTalesAI Team</p>
      <p>If you have any questions, please don't hesitate to contact our support team at <a href="mailto:${supportEmail}" style="color: #007bff;">${supportEmail}</a></p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderRejectedTemplate;
