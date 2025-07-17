/**
 * Email change verification template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.newEmail - New email address to verify
 * @param {string} params.verificationUrl - Email change verification URL
 * @returns {Object} Email template with subject and body
 */
const emailChangeVerificationTemplate = (params) => {
  const { firstName, newEmail, verificationUrl } = params;

  return {
    subject: "Verifica tu nueva dirección de correo para PetTalesAI",
    textBody: `
Hola ${firstName},

Has solicitado cambiar tu dirección de correo electrónico en PetTalesAI a: ${newEmail}

Por favor verifica tu nueva dirección de correo haciendo clic en el enlace de abajo:
${verificationUrl}

Este enlace expirará en 24 horas.

Si no solicitaste este cambio de correo, por favor ignora este mensaje y tu dirección de correo actual permanecerá sin cambios.

Saludos cordiales,
El equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verifica tu nueva dirección de correo para PetTalesAI</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">Verifica Tu Nueva Dirección de Correo</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>Has solicitado cambiar tu dirección de correo electrónico en PetTalesAI a:</p>
    
    <div style="background-color: #fff; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #E9B80C;">
      <strong style="color: #E9B80C;">${newEmail}</strong>
    </div>
    
    <p>Por favor verifica tu nueva dirección de correo haciendo clic en el botón de abajo:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verificar Nueva Dirección de Correo</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">Este enlace expirará en 24 horas.</p>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #856404;">
        <strong>Importante:</strong> Si no solicitaste este cambio de correo, por favor ignora este mensaje y tu dirección de correo actual permanecerá sin cambios.
      </p>
    </div>
    
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

module.exports = emailChangeVerificationTemplate;
