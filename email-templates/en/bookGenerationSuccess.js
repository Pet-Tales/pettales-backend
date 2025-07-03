/**
 * Book generation success email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the generated book
 * @param {string} params.pdfUrl - URL to download the PDF
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} Email template with subject and body
 */
const bookGenerationSuccessTemplate = (params) => {
  const { firstName, bookTitle, pdfUrl, dashboardUrl } = params;

  return {
    subject: `Your book "${bookTitle}" is ready! 📚`,
    textBody: `
Hello ${firstName},

Great news! Your personalized children's book "${bookTitle}" has been successfully generated and is ready for download.

Download your book: ${pdfUrl}

You can also view and manage all your books from your dashboard: ${dashboardUrl}

What's next?
- Download and read your book
- Share it with family and friends
- Create more magical stories with different characters

Thank you for using PetTalesAI to bring your stories to life!

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Your book is ready!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">🎉 Your Book is Ready!</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>Great news! Your personalized children's book <strong>"${bookTitle}"</strong> has been successfully generated and is ready for download.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${pdfUrl}" style="background-color: #E9B80C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">📚 Download Your Book</a>
    </div>
    
    <p>You can also view and manage all your books from your dashboard:</p>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${dashboardUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">View Dashboard</a>
    </div>
    
    <h3 style="color: #E9B80C; margin-top: 30px;">What's next?</h3>
    <ul style="padding-left: 20px;">
      <li>Download and read your book</li>
      <li>Share it with family and friends</li>
      <li>Create more magical stories with different characters</li>
    </ul>
    
    <p style="margin-top: 30px;">Thank you for using PetTalesAI to bring your stories to life!</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Best regards,<br>The PetTalesAI Team</p>
      <p>If you have any questions, feel free to reach out to our support team.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = bookGenerationSuccessTemplate;
