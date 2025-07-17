/**
 * Password change confirmation email template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @returns {Object} Email template with subject and body
 */
const passwordChangeConfirmationTemplate = (params) => {
  const { firstName } = params;

  return {
    subject: "Tu contraseña de PetTalesAI ha sido cambiada",
    textBody: `
Hola ${firstName},

Tu contraseña para tu cuenta de PetTalesAI ha sido cambiada exitosamente.

Si hiciste este cambio, puedes ignorar este correo de forma segura.

Si no hiciste este cambio, por favor contacta a nuestro equipo de soporte inmediatamente ya que tu cuenta puede haber sido comprometida.

Por tu seguridad, todas las sesiones activas han sido cerradas y necesitarás iniciar sesión nuevamente con tu nueva contraseña.

Saludos cordiales,
El equipo de PetTalesAI

---
Este es un mensaje automatizado. Por favor no respondas a este correo.
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contraseña Cambiada - PetTalesAI</title>
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
            <h2>Contraseña Cambiada Exitosamente</h2>
            <p>Hola ${firstName},</p>
            
            <div class="alert">
                <strong>¡Tu contraseña ha sido cambiada!</strong><br>
                La contraseña de tu cuenta de PetTalesAI fue actualizada exitosamente.
            </div>
            
            <p>Si hiciste este cambio, puedes ignorar este correo de forma segura.</p>
            
            <div class="warning">
                <strong>¿No hiciste este cambio?</strong><br>
                Si no cambiaste tu contraseña, por favor contacta a nuestro equipo de soporte inmediatamente ya que tu cuenta puede haber sido comprometida.
            </div>
            
            <p>Por tu seguridad, todas las sesiones activas han sido cerradas y necesitarás iniciar sesión nuevamente con tu nueva contraseña.</p>
            
            <p>Saludos cordiales,<br>El equipo de PetTalesAI</p>
        </div>
        <div class="footer">
            Este es un mensaje automatizado. Por favor no respondas a este correo.
        </div>
    </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = passwordChangeConfirmationTemplate;
