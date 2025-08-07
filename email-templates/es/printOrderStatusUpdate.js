/**
 * Print order general status update email template - Spanish
 */
const printOrderStatusUpdateTemplate = (params) => {
  const { firstName, bookTitle, orderId, status, statusMessage, myOrdersUrl } = params;

  // Generate human-readable status messages in Spanish
  const getStatusMessage = (status) => {
    switch (status.toLowerCase()) {
      case 'created':
        return 'Tu pedido ha sido creado y está siendo procesado.';
      case 'unpaid':
        return 'Tu pedido está esperando la confirmación del pago.';
      case 'payment_in_progress':
        return 'Tu pago está siendo procesado.';
      case 'production_delayed':
        return 'Tu pedido ha sido temporalmente retrasado en producción. Nos disculpamos por cualquier inconveniente.';
      case 'production_ready':
        return 'Tu pedido está listo para entrar en producción.';
      default:
        return statusMessage || `El estado de tu pedido ha sido actualizado a: ${status}`;
    }
  };

  const displayMessage = getStatusMessage(status);

  return {
    subject: `📋 Actualización de tu pedido "${bookTitle}"`,
    textBody: `
Hola ${firstName},

Queríamos actualizarte sobre el estado de tu pedido de impresión de "${bookTitle}".

Detalles del Pedido:
- ID del Pedido: ${orderId}
- Libro: ${bookTitle}
- Estado Actual: ${status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

Actualización de Estado:
${displayMessage}

Puedes ver los detalles completos de tu pedido y seguir el progreso en: ${myOrdersUrl}

¡Gracias por elegir PetTalesAI para tus libros personalizados para niños!

Saludos cordiales,
El Equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Actualización del estado del pedido</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #6c757d; text-align: center; margin-bottom: 30px;">📋 Actualización del Pedido</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>Queríamos actualizarte sobre el estado de tu pedido de impresión de <strong>"${bookTitle}"</strong>.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6c757d;">
      <h3 style="color: #6c757d; margin-top: 0;">Detalles del Pedido</h3>
      <p><strong>ID del Pedido:</strong> ${orderId}</p>
      <p><strong>Libro:</strong> ${bookTitle}</p>
      <p><strong>Estado Actual:</strong> ${status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
    </div>
    
    <div style="background-color: #e9ecef; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #495057;">
      <h3 style="color: #495057; margin-top: 0;">📢 Actualización de Estado</h3>
      <p>${displayMessage}</p>
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ver Detalles del Pedido</a>
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

module.exports = printOrderStatusUpdateTemplate;
