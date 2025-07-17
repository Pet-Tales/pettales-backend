const enTemplates = require('./en');
const esTemplates = require('./es');

const templates = {
  en: enTemplates,
  es: esTemplates,
};

/**
 * Get email template by language and type
 * @param {string} language - Language code (en, es)
 * @param {string} templateType - Template type (emailVerification, welcome, passwordReset)
 * @param {Object} params - Template parameters
 * @returns {Object} Email template with subject, textBody, and htmlBody
 */
const getEmailTemplate = (language, templateType, params) => {
  // Default to English if language not supported
  const lang = templates[language] ? language : 'en';
  
  if (!templates[lang][templateType]) {
    throw new Error(`Template type '${templateType}' not found for language '${lang}'`);
  }
  
  return templates[lang][templateType](params);
};

module.exports = {
  getEmailTemplate,
  templates,
};
