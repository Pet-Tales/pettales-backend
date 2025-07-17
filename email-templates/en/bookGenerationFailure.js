/**
 * Book generation failure email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the book that failed to generate
 * @param {string} params.dashboardUrl - Dashboard URL
 * @param {string} params.supportEmail - Support email address
 * @returns {Object} Email template with subject and body
 */
const bookGenerationFailureTemplate = (params) => {
  const { firstName, bookTitle, dashboardUrl, supportEmail } = params;

  return {
    subject: `Issue with your book "${bookTitle}" generation`,
    textBody: `
Hello ${firstName},

We're sorry to inform you that there was an issue generating your children's book "${bookTitle}".

Our team has been automatically notified and is working to resolve this issue. We'll retry the generation process and notify you once your book is ready.

In the meantime, you can:
- Check your dashboard for updates: ${dashboardUrl}
- Try creating a new book with different settings
- Contact our support team if you need immediate assistance: ${supportEmail}

We apologize for any inconvenience and appreciate your patience.

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Issue with your book generation</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #dc3545; text-align: center; margin-bottom: 30px;">⚠️ Book Generation Issue</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>We're sorry to inform you that there was an issue generating your children's book <strong>"${bookTitle}"</strong>.</p>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404;"><strong>What happens next?</strong></p>
      <p style="margin: 5px 0 0 0; color: #856404;">Our team has been automatically notified and is working to resolve this issue. We'll retry the generation process and notify you once your book is ready.</p>
    </div>
    
    <h3 style="color: #E9B80C; margin-top: 30px;">In the meantime, you can:</h3>
    <ul style="padding-left: 20px;">
      <li>Check your dashboard for updates</li>
      <li>Try creating a new book with different settings</li>
      <li>Contact our support team if you need immediate assistance</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background-color: #E9B80C; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">View Dashboard</a>
      <a href="mailto:${supportEmail}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Contact Support</a>
    </div>
    
    <p style="margin-top: 30px;">We apologize for any inconvenience and appreciate your patience.</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Best regards,<br>The PetTalesAI Team</p>
      <p>We're committed to providing you with the best experience possible.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = bookGenerationFailureTemplate;
