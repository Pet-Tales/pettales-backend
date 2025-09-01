/**
 * Print order in production email template - Spanish
 */
const printOrderInProductionTemplate = (params) => {
  const { firstName, bookTitle, orderId, shippingAddress, myOrdersUrl } = params;

  return {
    subject: `🏭 ¡Tu libro "${bookTitle}" está ahora en producción!`,
    textBody: `
Hola ${firstName},

¡Excelentes noticias! Tu libro personalizado para niños "${bookTitle}" ha entrado en la fase de producción y está siendo impreso.

Detalles del Pedido:
- ID del Pedido: ${orderId}
- Libro: ${bookTitle}
- Dirección de Envío: ${shippingAddress}

¿Qué está pasando ahora?
Tu libro está siendo impreso actualmente con materiales de alta calidad y atención al detalle. Este proceso típicamente toma de 2-5 días hábiles, dependiendo de la complejidad y el volumen de producción actual.

Próximos Pasos:
1. Tu libro será impreso y revisado por calidad
2. Será empaquetado de forma segura para el envío
3. Recibirás una notificación de envío con información de seguimiento una vez que sea despachado

Puedes rastrear el estado de tu pedido en cualquier momento: ${myOrdersUrl}

¡Gracias por tu paciencia mientras creamos tu libro personalizado!

Saludos cordiales,
El Equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>¡Tu libro está en producción!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #17a2b8; text-align: center; margin-bottom: 30px;">🏭 ¡Tu Libro Está en Producción!</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>¡Excelentes noticias! Tu libro personalizado para niños <strong>"${bookTitle}"</strong> ha entrado en la fase de producción y está siendo impreso.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #17a2b8;">
      <h3 style="color: #17a2b8; margin-top: 0;">Detalles del Pedido</h3>
      <p><strong>ID del Pedido:</strong> ${orderId}</p>
      <p><strong>Libro:</strong> ${bookTitle}</p>
      <p><strong>Dirección de Envío:</strong><br>${shippingAddress.replace(/\n/g, '<br>')}</p>
    </div>
    
    <div style="background-color: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
      <h3 style="color: #004085; margin-top: 0;">🔄 ¿Qué está pasando ahora?</h3>
      <p>Tu libro está siendo impreso actualmente con materiales de alta calidad y atención al detalle. Este proceso típicamente toma <strong>2-5 días hábiles</strong>, dependiendo de la complejidad y el volumen de producción actual.</p>
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #17a2b8; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Rastrear Mi Pedido</a>
    </div>
    
    <p style="margin-top: 30px;">¡Gracias por tu paciencia mientras creamos tu libro personalizado!</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Saludos cordiales,<br>El Equipo de PetTalesAI</p>
      <p>¡Estamos emocionados de dar vida a tu historia en formato impreso!</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderInProductionTemplate;
