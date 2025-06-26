/**
 * Password reset email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.resetUrl - Password reset URL
 * @returns {Object} Email template with subject and body
 */
const passwordResetTemplate = (params) => {
  const { firstName, resetUrl } = params;

  return {
    subject: "Reset your PetTalesAI password",
    textBody: `
Hello ${firstName},

You requested to reset your password for your PetTalesAI account.

Click the link below to reset your password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email.

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Reset your PetTalesAI password</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">Reset Your Password</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>You requested to reset your password for your PetTalesAI account.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">This link will expire in 1 hour.</p>
    
    <p style="font-size: 14px; color: #666;">If you didn't request a password reset, please ignore this email.</p>
    
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

module.exports = passwordResetTemplate;
