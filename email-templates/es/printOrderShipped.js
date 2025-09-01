/**
 * Print order shipped email template - Spanish
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.bookTitle - Title of the book
 * @param {string} params.orderId - Order ID
 * @param {string} params.trackingId - Tracking ID
 * @param {Array} params.trackingUrls - Array of tracking URLs
 * @param {string} params.carrierName - Carrier name
 * @param {string} params.shippingAddress - Formatted shipping address
 * @param {string} params.myOrdersUrl - My orders URL
 * @returns {Object} Email template with subject and body
 */
const printOrderShippedTemplate = (params) => {
  const { 
    firstName, 
    bookTitle, 
    orderId, 
    trackingId, 
    trackingUrls = [], 
    carrierName, 
    shippingAddress,
    myOrdersUrl 
  } = params;

  const primaryTrackingUrl = trackingUrls.length > 0 ? trackingUrls[0] : null;

  return {
    subject: `📦 ¡Tu libro "${bookTitle}" ha sido enviado!`,
    textBody: `
Hola ${firstName},

¡Excelentes noticias! Tu libro personalizado para niños "${bookTitle}" ha sido enviado y está en camino hacia ti.

Detalles del Pedido:
- ID del Pedido: ${orderId}
- Libro: ${bookTitle}
- Dirección de Envío: ${shippingAddress}

Información de Seguimiento:
- ID de Seguimiento: ${trackingId}
- Transportista: ${carrierName}
${primaryTrackingUrl ? `- Rastrea tu paquete: ${primaryTrackingUrl}` : ''}

Tu libro debería llegar dentro del tiempo estimado de entrega. Puedes rastrear el estado de tu pedido y ver todos tus pedidos en: ${myOrdersUrl}

¡Gracias por elegir PetTalesAI para tus libros personalizados para niños!

Saludos cordiales,
El Equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>¡Tu libro ha sido enviado!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #28a745; text-align: center; margin-bottom: 30px;">📦 ¡Tu Libro Ha Sido Enviado!</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>¡Excelentes noticias! Tu libro personalizado para niños <strong>"${bookTitle}"</strong> ha sido enviado y está en camino hacia ti.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="color: #28a745; margin-top: 0;">Detalles del Pedido</h3>
      <p><strong>ID del Pedido:</strong> ${orderId}</p>
      <p><strong>Libro:</strong> ${bookTitle}</p>
      <p><strong>Dirección de Envío:</strong><br>${shippingAddress.replace(/\n/g, '<br>')}</p>
    </div>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #007bff;">
      <h3 style="color: #007bff; margin-top: 0;">📍 Información de Seguimiento</h3>
      <p><strong>ID de Seguimiento:</strong> ${trackingId}</p>
      <p><strong>Transportista:</strong> ${carrierName}</p>
      ${primaryTrackingUrl ? `
      <div style="text-align: center; margin: 20px 0;">
        <a href="${primaryTrackingUrl}" style="background-color: #007bff; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">📦 Rastrear Paquete</a>
      </div>
      ` : ''}
    </div>
    
    <p>Tu libro debería llegar dentro del tiempo estimado de entrega. Puedes rastrear el estado de tu pedido y ver todos tus pedidos:</p>

    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ver Mis Pedidos</a>
    </div>
    
    <p style="margin-top: 30px;">¡Gracias por elegir PetTalesAI para tus libros personalizados para niños!</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Saludos cordiales,<br>El Equipo de PetTalesAI</p>
      <p>Si tienes alguna pregunta sobre tu pedido, no dudes en contactar a nuestro equipo de soporte.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderShippedTemplate;
