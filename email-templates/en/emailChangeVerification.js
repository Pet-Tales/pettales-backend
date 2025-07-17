/**
 * Email change verification template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.newEmail - New email address to verify
 * @param {string} params.verificationUrl - Email change verification URL
 * @returns {Object} Email template with subject and body
 */
const emailChangeVerificationTemplate = (params) => {
  const { firstName, newEmail, verificationUrl } = params;

  return {
    subject: "Verify your new email address for PetTalesAI",
    textBody: `
Hello ${firstName},

You have requested to change your email address on PetTalesAI to: ${newEmail}

Please verify your new email address by clicking the link below:
${verificationUrl}

This link will expire in 24 hours.

If you didn't request this email change, please ignore this email and your current email address will remain unchanged.

Best regards,
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verify your new email address for PetTalesAI</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">Verify Your New Email Address</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>You have requested to change your email address on PetTalesAI to:</p>
    
    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #E9B80C;">
      <strong style="color: #E9B80C;">${newEmail}</strong>
    </div>
    
    <p>Please verify your new email address by clicking the button below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verify New Email Address</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">This link will expire in 24 hours.</p>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>Important:</strong> If you didn't request this email change, please ignore this email and your current email address will remain unchanged.
      </p>
    </div>
    
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

module.exports = emailChangeVerificationTemplate;
