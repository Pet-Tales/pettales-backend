/**
 * Email verification template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.verificationUrl - Email verification URL
 * @returns {Object} Email template with subject and body
 */
const emailVerificationTemplate = (params) => {
  const { firstName, verificationUrl } = params;

  return {
    subject: "Verify your PetTalesAI account",
    textBody: `
Hello ${firstName},

Welcome to PetTalesAI! Please verify your email address to complete your account setup.

Click the link below to verify your email:
${verificationUrl}

This link will expire in 24 hours.

If you didn't create an account with PetTalesAI, please ignore this email.

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verify your PetTalesAI account</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">Welcome to PetTalesAI!</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>Welcome to PetTalesAI! Please verify your email address to complete your account setup.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify Email Address</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">This link will expire in 24 hours.</p>
    
    <p style="font-size: 14px; color: #666;">If you didn't create an account with PetTalesAI, please ignore this email.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666; text-align: center;">
      Best regards,<br>
      The PetTalesAI Team
    </p>
  </div>
</body>
</html>
    `.trim()
  };
};

module.exports = emailVerificationTemplate;
