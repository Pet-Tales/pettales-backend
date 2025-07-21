/**
 * Book generation success email template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the generated book
 * @param {string} params.pdfUrl - URL to download the PDF
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} Email template with subject and body
 */
const bookGenerationSuccessTemplate = (params) => {
  const { firstName, bookTitle, pdfUrl, dashboardUrl } = params;

  return {
    subject: `¡Tu libro "${bookTitle}" está listo! 📚`,
    textBody: `
Hola ${firstName},

¡Excelentes noticias! Tu libro infantil personalizado "${bookTitle}" ha sido generado exitosamente y está listo para descargar.

Descarga tu libro: ${pdfUrl}

También puedes ver y gestionar todos tus libros: ${dashboardUrl}

¿Qué sigue?
- Descarga y lee tu libro
- Compártelo con familia y amigos
- Crea más historias mágicas con diferentes personajes

¡Gracias por usar PetTalesAI para dar vida a tus historias!

Saludos cordiales,
El equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>¡Tu libro está listo!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">🎉 ¡Tu Libro Está Listo!</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>¡Excelentes noticias! Tu libro infantil personalizado <strong>"${bookTitle}"</strong> ha sido generado exitosamente y está listo para descargar.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${pdfUrl}" style="background-color: #E9B80C; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 16px;">📚 Descargar Tu Libro</a>
    </div>
    
    <p>También puedes ver y gestionar todos tus libros:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${dashboardUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ver Mis Libros</a>
    </div>
    
    <h3 style="color: #E9B80C; margin-top: 30px;">¿Qué sigue?</h3>
    <ul style="padding-left: 20px;">
      <li>Descarga y lee tu libro</li>
      <li>Compártelo con familia y amigos</li>
      <li>Crea más historias mágicas con diferentes personajes</li>
    </ul>
    
    <p style="margin-top: 30px;">¡Gracias por usar PetTalesAI para dar vida a tus historias!</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Saludos cordiales,<br>El equipo de PetTalesAI</p>
      <p>Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = bookGenerationSuccessTemplate;
