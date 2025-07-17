/**
 * Book generation failure email template - Spanish
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
    subject: `Problema con la generación de tu libro "${bookTitle}"`,
    textBody: `
Hola ${firstName},

Lamentamos informarte que hubo un problema al generar tu libro infantil "${bookTitle}".

Nuestro equipo ha sido notificado automáticamente y está trabajando para resolver este problema. Reintentaremos el proceso de generación y te notificaremos una vez que tu libro esté listo.

Mientras tanto, puedes:
- Revisar tu panel de control para actualizaciones: ${dashboardUrl}
- Intentar crear un nuevo libro con diferentes configuraciones
- Contactar a nuestro equipo de soporte si necesitas asistencia inmediata: ${supportEmail}

Nos disculpamos por cualquier inconveniente y agradecemos tu paciencia.

Saludos cordiales,
El equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Problema con la generación de tu libro</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #dc3545; text-align: center; margin-bottom: 30px;">⚠️ Problema en la Generación del Libro</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>Lamentamos informarte que hubo un problema al generar tu libro infantil <strong>"${bookTitle}"</strong>.</p>
    
    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 5px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404;"><strong>¿Qué sigue?</strong></p>
      <p style="margin: 5px 0 0 0; color: #856404;">Nuestro equipo ha sido notificado automáticamente y está trabajando para resolver este problema. Reintentaremos el proceso de generación y te notificaremos una vez que tu libro esté listo.</p>
    </div>
    
    <h3 style="color: #E9B80C; margin-top: 30px;">Mientras tanto, puedes:</h3>
    <ul style="padding-left: 20px;">
      <li>Revisar tu panel de control para actualizaciones</li>
      <li>Intentar crear un nuevo libro con diferentes configuraciones</li>
      <li>Contactar a nuestro equipo de soporte si necesitas asistencia inmediata</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background-color: #E9B80C; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">Ver Panel de Control</a>
      <a href="mailto:${supportEmail}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Contactar Soporte</a>
    </div>
    
    <p style="margin-top: 30px;">Nos disculpamos por cualquier inconveniente y agradecemos tu paciencia.</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Saludos cordiales,<br>El equipo de PetTalesAI</p>
      <p>Estamos comprometidos a brindarte la mejor experiencia posible.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = bookGenerationFailureTemplate;
