/**
 * Print order in production email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the book
 * @param {string} params.orderId - Order ID
 * @param {string} params.shippingAddress - Formatted shipping address
 * @param {string} params.myOrdersUrl - My orders URL
 * @returns {Object} Email template with subject and body
 */
const printOrderInProductionTemplate = (params) => {
  const { 
    firstName, 
    bookTitle, 
    orderId, 
    shippingAddress,
    myOrdersUrl 
  } = params;

  return {
    subject: `🏭 Your book "${bookTitle}" is now in production!`,
    textBody: `
Hello ${firstName},

Great news! Your personalized children's book "${bookTitle}" has entered the production phase and is being printed.

Order Details:
- Order ID: ${orderId}
- Book: ${bookTitle}
- Shipping Address: ${shippingAddress}

What's Happening Now:
Your book is currently being printed with high-quality materials and attention to detail. This process typically takes 2-5 business days, depending on the complexity and current production volume.

Next Steps:
1. Your book will be printed and quality-checked
2. It will be packaged securely for shipping
3. You'll receive a shipping notification with tracking information once it's dispatched

You can track your order status at any time: ${myOrdersUrl}

Thank you for your patience as we create your personalized book!

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your book is in production!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #17a2b8; text-align: center; margin-bottom: 30px;">🏭 Your Book is in Production!</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>Great news! Your personalized children's book <strong>"${bookTitle}"</strong> has entered the production phase and is being printed.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
      <h3 style="color: #17a2b8; margin-top: 0;">Order Details</h3>
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Book:</strong> ${bookTitle}</p>
      <p><strong>Shipping Address:</strong><br>${shippingAddress.replace(/\n/g, '<br>')}</p>
    </div>
    
    <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
      <h3 style="color: #004085; margin-top: 0;">🔄 What's Happening Now</h3>
      <p>Your book is currently being printed with high-quality materials and attention to detail. This process typically takes <strong>2-5 business days</strong>, depending on the complexity and current production volume.</p>
    </div>
    
    <h3 style="color: #E9B80C; margin-top: 30px;">📋 Next Steps</h3>
    <ol style="padding-left: 20px;">
      <li><strong>Printing & Quality Check:</strong> Your book will be printed and quality-checked</li>
      <li><strong>Packaging:</strong> It will be packaged securely for shipping</li>
      <li><strong>Shipping Notification:</strong> You'll receive a shipping notification with tracking information once it's dispatched</li>
    </ol>
    
    <p>You can track your order status at any time:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #17a2b8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Track My Order</a>
    </div>
    
    <p style="margin-top: 30px;">Thank you for your patience as we create your personalized book!</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Best regards,<br>The PetTalesAI Team</p>
      <p>We're excited to bring your story to life in print!</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderInProductionTemplate;
