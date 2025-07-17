/**
 * Welcome email template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} Email template with subject and body
 */
const welcomeTemplate = (params) => {
  const { firstName, dashboardUrl } = params;

  return {
    subject: "¡Bienvenido a PetTalesAI!",
    textBody: `
Hola ${firstName},

¡Bienvenido a PetTalesAI! Estamos emocionados de tenerte en nuestra comunidad de narradores.

Con PetTalesAI, puedes crear libros infantiles mágicos y personalizados con tus queridas mascotas como personajes principales. Nuestra plataforma impulsada por IA hace que sea fácil dar vida a las aventuras de tu mascota.

Esto es lo que puedes hacer a continuación:
- Crear tu primer personaje
- Generar tu primera historia
- Explorar nuestra galería para inspirarte

Visita tu panel de control: ${dashboardUrl}

Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.

¡Feliz narración!
El equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>¡Bienvenido a PetTalesAI!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">¡Bienvenido a PetTalesAI!</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>¡Bienvenido a PetTalesAI! Estamos emocionados de tenerte en nuestra comunidad de narradores.</p>
    
    <p>Con PetTalesAI, puedes crear libros infantiles mágicos y personalizados con tus queridas mascotas como personajes principales. Nuestra plataforma impulsada por IA hace que sea fácil dar vida a las aventuras de tu mascota.</p>
    
    <h3 style="color: #E9B80C;">Esto es lo que puedes hacer a continuación:</h3>
    <ul style="padding-left: 20px;">
      <li>Crear tu primer personaje</li>
      <li>Generar tu primera historia</li>
      <li>Explorar nuestra galería para inspirarte</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Visitar Tu Panel de Control</a>
    </div>
    
    <p>Si tienes alguna pregunta, no dudes en contactar a nuestro equipo de soporte.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666; text-align: center;">
      ¡Feliz narración!<br>
      El equipo de PetTalesAI
    </p>
  </div>
</body>
</html>
    `.trim()
  };
};

module.exports = welcomeTemplate;
