/**
 * Contact form email template (English)
 * @param {Object} params - Template parameters
 * @param {string} params.name - Contact person's name
 * @param {string} params.email - Contact person's email
 * @param {string} params.subject - Contact subject
 * @param {string} params.message - Contact message
 * @returns {Object} Email template with subject, textBody, and htmlBody
 */
module.exports = ({ name, email, subject, message }) => {
  const emailSubject = `Contact Form: ${subject}`;

  const textBody = `
New contact form submission from PetTalesAI website:

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}

---
This message was sent from the PetTalesAI contact form.
`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact Form Submission</title>
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
    <h1>New Contact Form Submission</h1>
    <p>PetTalesAI Website</p>
  </div>
  
  <div class="content">
    <div class="field">
      <div class="field-label">Name:</div>
      <div class="field-value">${name}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Email:</div>
      <div class="field-value">${email}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Subject:</div>
      <div class="field-value">${subject}</div>
    </div>
    
    <div class="field">
      <div class="field-label">Message:</div>
      <div class="message-content">${message}</div>
    </div>
    
    <div class="footer">
      <p><strong>Note:</strong> This message was sent from the PetTalesAI contact form.</p>
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
