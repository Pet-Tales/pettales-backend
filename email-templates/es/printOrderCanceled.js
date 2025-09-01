/**
 * Print order canceled email template - Spanish
 */
const printOrderCanceledTemplate = (params) => {
  const { firstName, bookTitle, orderId, reason, creditsRefunded, myOrdersUrl, supportEmail } = params;

  return {
    subject: `🚫 Tu pedido "${bookTitle}" ha sido cancelado - Créditos Reembolsados`,
    textBody: `
Hola ${firstName},

Te escribimos para informarte que tu pedido de impresión de "${bookTitle}" ha sido cancelado.

Detalles del Pedido:
- ID del Pedido: ${orderId}
- Libro: ${bookTitle}
- Razón de Cancelación: ${reason || 'Pedido cancelado por el sistema'}

Información de Reembolso:
Hemos reembolsado automáticamente ${creditsRefunded} créditos a tu cuenta. Estos créditos están ahora disponibles para usar en tu próximo pedido.

Próximos Pasos:
1. Puedes hacer un nuevo pedido del mismo libro si lo deseas
2. Explora nuestra galería para otras ideas de libros
3. Contacta a nuestro equipo de soporte si tienes preguntas: ${supportEmail}

Puedes ver tu historial de pedidos y saldo actual de créditos en: ${myOrdersUrl}

Nos disculpamos por cualquier inconveniente que esto pueda haber causado.

Saludos cordiales,
El Equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tu pedido ha sido cancelado</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #ffc107; text-align: center; margin-bottom: 30px;">🚫 Pedido Cancelado</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>Te escribimos para informarte que tu pedido de impresión de <strong>"${bookTitle}"</strong> ha sido cancelado.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
      <h3 style="color: #856404; margin-top: 0;">Detalles del Pedido</h3>
      <p><strong>ID del Pedido:</strong> ${orderId}</p>
      <p><strong>Libro:</strong> ${bookTitle}</p>
      <p><strong>Razón de Cancelación:</strong> ${reason || 'Pedido cancelado por el sistema'}</p>
    </div>
    
    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="color: #155724; margin-top: 0;">💰 Información de Reembolso</h3>
      <p>Hemos reembolsado automáticamente <strong>${creditsRefunded} créditos</strong> a tu cuenta. Estos créditos están ahora disponibles para usar en tu próximo pedido.</p>
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ver Mis Pedidos</a>
    </div>
    
    <p style="margin-top: 30px;">Nos disculpamos por cualquier inconveniente que esto pueda haber causado.</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Saludos cordiales,<br>El Equipo de PetTalesAI</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderCanceledTemplate;
