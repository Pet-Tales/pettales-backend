/**
 * Password reset email template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.resetUrl - Password reset URL
 * @returns {Object} Email template with subject and body
 */
const passwordResetTemplate = (params) => {
  const { firstName, resetUrl } = params;

  return {
    subject: "Restablece tu contraseña de PetTalesAI",
    textBody: `
Hola ${firstName},

Solicitaste restablecer tu contraseña para tu cuenta de PetTalesAI.

Haz clic en el enlace de abajo para restablecer tu contraseña:
${resetUrl}

Este enlace expirará en 1 hora.

Si no solicitaste un restablecimiento de contraseña, por favor ignora este correo.

Saludos cordiales,
El equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Restablece tu contraseña de PetTalesAI</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">Restablece Tu Contraseña</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>Solicitaste restablecer tu contraseña para tu cuenta de PetTalesAI.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">Este enlace expirará en 1 hora.</p>
    
    <p style="font-size: 14px; color: #666;">Si no solicitaste un restablecimiento de contraseña, por favor ignora este correo.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666; text-align: center;">
      Saludos cordiales,<br>
      El equipo de PetTalesAI
    </p>
  </div>
</body>
</html>
    `.trim()
  };
};

module.exports = passwordResetTemplate;
