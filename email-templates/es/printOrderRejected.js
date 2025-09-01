/**
 * Print order rejected email template - Spanish
 */
const printOrderRejectedTemplate = (params) => {
  const { firstName, bookTitle, orderId, errorMessage, creditsRefunded, myOrdersUrl, supportEmail } = params;

  return {
    subject: `❌ Problema con tu pedido "${bookTitle}" - Créditos Reembolsados`,
    textBody: `
Hola ${firstName},

Lamentamos informarte que hubo un problema con tu pedido de impresión de "${bookTitle}" y no pudo ser procesado.

Detalles del Pedido:
- ID del Pedido: ${orderId}
- Libro: ${bookTitle}
- Problema: ${errorMessage || 'Problema técnico durante el procesamiento'}

Información de Reembolso:
Hemos reembolsado automáticamente ${creditsRefunded} créditos a tu cuenta. Estos créditos están ahora disponibles para usar en tu próximo pedido.

Próximos Pasos:
1. Puedes intentar hacer un nuevo pedido del mismo libro
2. Verifica si hay problemas con el contenido del libro o las imágenes de portada
3. Contacta a nuestro equipo de soporte si necesitas ayuda: ${supportEmail}

Puedes ver tu historial de pedidos y saldo actual de créditos en: ${myOrdersUrl}

Nos disculpamos por cualquier inconveniente y agradecemos tu comprensión.

Saludos cordiales,
El Equipo de PetTalesAI
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Problema con tu pedido</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #dc3545; text-align: center; margin-bottom: 30px;">❌ Problema con Tu Pedido</h1>
    
    <p>Hola ${firstName},</p>
    
    <p>Lamentamos informarte que hubo un problema con tu pedido de impresión de <strong>"${bookTitle}"</strong> y no pudo ser procesado.</p>
    
    <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
      <h3 style="color: #dc3545; margin-top: 0;">Detalles del Pedido</h3>
      <p><strong>ID del Pedido:</strong> ${orderId}</p>
      <p><strong>Libro:</strong> ${bookTitle}</p>
      <p><strong>Problema:</strong> ${errorMessage || 'Problema técnico durante el procesamiento'}</p>
    </div>
    
    <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="color: #155724; margin-top: 0;">💰 Información de Reembolso</h3>
      <p>Hemos reembolsado automáticamente <strong>${creditsRefunded} créditos</strong> a tu cuenta. Estos créditos están ahora disponibles para usar en tu próximo pedido.</p>
    </div>
    
    <div style="text-align: center; margin: 20px 0;">
      <a href="${myOrdersUrl}" style="background-color: #6c757d; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Ver Mis Pedidos</a>
    </div>
    
    <p style="margin-top: 30px;">Nos disculpamos por cualquier inconveniente y agradecemos tu comprensión.</p>
    
    <div style="border-top: 1px solid #dee2e6; margin-top: 30px; padding-top: 20px; text-align: center; color: #6c757d; font-size: 14px;">
      <p>Saludos cordiales,<br>El Equipo de PetTalesAI</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = printOrderRejectedTemplate;
