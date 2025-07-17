/**
 * Contact form email template (Spanish)
 * @param {Object} params - Template parameters
 * @param {string} params.name - Contact person's name
 * @param {string} params.email - Contact person's email
 * @param {string} params.subject - Contact subject
 * @param {string} params.message - Contact message
 * @returns {Object} Email template with subject, textBody, and htmlBody
 */
module.exports = ({ name, email, subject, message }) => {
  const emailSubject = `Formulario de Contacto: ${subject}`;

  const textBody = `
Nueva solicitud del formulario de contacto del sitio web de PetTalesAI:

Nombre: ${name}
Email: ${email}
Asunto: ${subject}

Mensaje:
${message}

---
Este mensaje fue enviado desde el formulario de contacto de PetTalesAI.
`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Envío de Formulario de Contacto</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background-color: #4F46E5;
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      background-color: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .field {
      margin-bottom: 20px;
    }
    .field-label {
      font-weight: bold;
      color: #4F46E5;
      margin-bottom: 5px;
    }
    .field-value {
      background-color: white;
      padding: 10px;
      border-radius: 4px;
      border-left: 4px solid #4F46E5;
    }
    .message-content {
      background-color: white;
      padding: 15px;
      border-radius: 4px;
      border-left: 4px solid #4F46E5;
      white-space: pre-wrap;
      font-family: inherit;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 14px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Nuevo Envío de Formulario de Contacto</h1>
    <p>Sitio Web PetTalesAI</p>
  </div>
  
  <div class="content">
    <div class="field">
      <div class="field-label">Nombre:</div>
      <div class="field-value">${name}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Email:</div>
      <div class="field-value">${email}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Asunto:</div>
      <div class="field-value">${subject}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Mensaje:</div>
      <div class="message-content">${message}</div>
    </div>
    
    <div class="footer">
      <p><strong>Nota:</strong> Este mensaje fue enviado desde el formulario de contacto de PetTalesAI.</p>
    </div>
  </div>
</body>
</html>
`;

  return {
    subject: emailSubject,
    textBody,
    htmlBody,
  };
};
