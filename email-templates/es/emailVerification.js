/**
 * Email verification template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.verificationUrl - Email verification URL
 * @returns {Object} Email template with subject and body
 */
const emailVerificationTemplate = (params) => {
  const { firstName, verificationUrl } = params;

  return {
    subject: "Verifica tu cuenta de PetTalesAI",
    textBody: `
Hola ${firstName},

¡Bienvenido a PetTalesAI! Por favor verifica tu dirección de correo electrónico para completar la configuración de tu cuenta.

Haz clic en el enlace de abajo para verificar tu correo:
${verificationUrl}

Este enlace expirará en 24 horas.

Si no creaste una cuenta con PetTalesAI, por favor ignora este correo.

Saludos cordiales,
El equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verifica tu cuenta de PetTalesAI</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">¡Bienvenido a PetTalesAI!</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>¡Bienvenido a PetTalesAI! Por favor verifica tu dirección de correo electrónico para completar la configuración de tu cuenta.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Verificar Correo Electrónico</a>
    </div>
    
    <p style="font-size: 14px; color: #666;">Este enlace expirará en 24 horas.</p>
    
    <p style="font-size: 14px; color: #666;">Si no creaste una cuenta con PetTalesAI, por favor ignora este correo.</p>
    
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

module.exports = emailVerificationTemplate;
