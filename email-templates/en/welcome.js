/**
 * Welcome email template - English
 * @param {Object} params - Template parameters
 * @param {string} params.firstName - User's first name
 * @param {string} params.dashboardUrl - Dashboard URL
 * @returns {Object} Email template with subject and body
 */
const welcomeTemplate = (params) => {
  const { firstName, dashboardUrl } = params;

  return {
    subject: "Welcome to PetTalesAI!",
    textBody: `
Hello ${firstName},

Welcome to PetTalesAI! We're excited to have you join our community of storytellers.

With PetTalesAI, you can create magical, personalized children's books featuring your beloved pets as the main characters. Our AI-powered platform makes it easy to bring your pet's adventures to life.

Here's what you can do next:
- Create your first character
- Generate your first story
- Explore our gallery for inspiration

Visit your books: ${dashboardUrl}

If you have any questions, feel free to reach out to our support team.

Happy storytelling!
The PetTalesAI Team
    `.trim(),
    htmlBody: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Welcome to PetTalesAI!</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px;">
    <h1 style="color: #E9B80C; text-align: center; margin-bottom: 30px;">Welcome to PetTalesAI!</h1>
    
    <p>Hello ${firstName},</p>
    
    <p>Welcome to PetTalesAI! We're excited to have you join our community of storytellers.</p>
    
    <p>With PetTalesAI, you can create magical, personalized children's books featuring your beloved pets as the main characters. Our AI-powered platform makes it easy to bring your pet's adventures to life.</p>
    
    <h3 style="color: #E9B80C;">Here's what you can do next:</h3>
    <ul style="padding-left: 20px;">
      <li>Create your first character</li>
      <li>Generate your first story</li>
      <li>Explore our gallery for inspiration</li>
    </ul>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${dashboardUrl}" style="background-color: #E9B80C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Visit Your Books</a>
    </div>
    
    <p>If you have any questions, feel free to reach out to our support team.</p>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="font-size: 14px; color: #666; text-align: center;">
      Happy storytelling!<br>
      The PetTalesAI Team
    </p>
  </div>
</body>
</html>
    `.trim(),
  };
};

module.exports = welcomeTemplate;
