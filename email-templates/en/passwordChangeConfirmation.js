/**
 * Password change confirmation email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @returns {Object} Email template with subject and body
 */
const passwordChangeConfirmationTemplate = (params) => {
  const { firstName } = params;

  return {
    subject: "Your PetTalesAI password has been changed",
    textBody: `
Hello ${firstName},

Your password for your PetTalesAI account has been successfully changed.

If you made this change, you can safely ignore this email.

If you did not make this change, please contact our support team immediately as your account may have been compromised.

For your security, all active sessions have been logged out and you will need to log in again with your new password.

Best regards,
The PetTalesAI Team

---
This is an automated message. Please do not reply to this email.
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Password Changed - PetTalesAI</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #ffffff; padding: 30px; border: 1px solid #e9ecef; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; color: #6c757d; }
        .alert { background-color: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; color: #495057;">PetTalesAI</h1>
        </div>
        <div class="content">
            <h2>Password Changed Successfully</h2>
            <p>Hello ${firstName},</p>
            
            <div class="alert">
                <strong>Your password has been changed!</strong><br>
                Your PetTalesAI account password was successfully updated.
            </div>
            
            <p>If you made this change, you can safely ignore this email.</p>
            
            <div class="warning">
                <strong>Didn't make this change?</strong><br>
                If you did not change your password, please contact our support team immediately as your account may have been compromised.
            </div>
            
            <p>For your security, all active sessions have been logged out and you will need to log in again with your new password.</p>
            
            <p>Best regards,<br>The PetTalesAI Team</p>
        </div>
        <div class="footer">
            This is an automated message. Please do not reply to this email.
        </div>
    </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = passwordChangeConfirmationTemplate;
