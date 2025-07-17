# PetTalesAI Backend

The backend API for PetTalesAI - an AI-powered children's book generator platform.

## 🚀 Features

- **User Authentication**: Session-based authentication with database storage
- **Google OAuth**: Social login integration
- **Email Services**: AWS SES integration for transactional emails
- **Internationalization**: Multi-language email templates (English/Spanish)
- **Database**: MongoDB with Mongoose ODM
- **Security**: Password hashing, session management, CORS protection
- **Logging**: Comprehensive logging with file rotation
- **Validation**: Input validation and sanitization

## 🛠️ Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **Passport.js** - Authentication middleware
- **AWS SES** - Email service
- **Winston** - Logging
- **bcryptjs** - Password hashing
- **express-validator** - Input validation

## 📦 Installation

1. Install dependencies:

```bash
yarn install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Configure environment variables:

```env
# Server
PORT=3000
DEBUG_MODE=true

# Database
MONGODB_URI=mongodb://localhost:27017/pettalesai

# Authentication
JWT_SECRET=your-jwt-secret
SESSION_SECRET=your-session-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# AWS SES
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Email
NO_REPLY_EMAIL_ADDRESS=noreply@pettalesai.com
FROM_EMAIL=noreply@pettalesai.com
FROM_NAME=PetTalesAI

# URLs
WEB_URL=http://localhost:5173
API_BASE_URL=http://localhost:3000
```

## 🏃‍♂️ Development

Start the development server:

```bash
yarn dev
```

The API will be available at `http://localhost:3000`

## 🏗️ Production

Start the production server:

```bash
yarn start
```

## 📁 Project Structure

```
├── config/           # Configuration files
│   ├── database.js   # MongoDB connection
│   └── passport.js   # Passport.js configuration
├── controllers/      # Route controllers
├── email-templates/  # Email templates by language
│   ├── en/          # English templates
│   └── es/          # Spanish templates
├── middleware/       # Custom middleware
├── models/          # Mongoose models
├── routes/          # API routes
├── services/        # Business logic services
├── utils/           # Utility functions
└── logs/            # Application logs
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/verify-email` - Email verification
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback

### User Management

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile (firstname, lastname, email)
- `GET /api/user/verify-email-change` - Verify email change with token
- `PUT /api/user/language-preference` - Update language preference
- `POST /api/user/request-password-change` - Request password change (sends reset email)

## 🌍 Internationalization

Email templates are organized by language:

- `/email-templates/en/` - English templates
- `/email-templates/es/` - Spanish templates

Supported languages:

- English (en)
- Spanish (es)

## 🔒 Security Features

- Password hashing with bcryptjs
- Session-based authentication
- CORS protection
- Input validation and sanitization
- Rate limiting (configurable)
- Secure cookie settings

## 📝 Logging

The application uses Winston for logging with:

- File rotation (5MB max file size, up to 20 files)
- Different log levels (error, warn, info, debug)
- Console output in development mode
- Structured logging format

## 🔧 Environment Configuration

The application uses a centralized constants system:

- All environment variables are validated on startup
- Optional variables show warnings if missing
- Debug mode controls logging verbosity
- Production-ready defaults

## 📧 Email Templates

Email templates support:

- Multi-language content
- HTML and text versions
- Dynamic content injection
- Responsive design

## 🗄️ Database Models

### User Model

- Authentication data
- Profile information
- Language preferences
- Email verification status
- Credits balance

### Session Model

- Session management
- Automatic cleanup
- Expiration handling

## 🚀 Deployment

1. Set environment variables for production
2. Ensure MongoDB is accessible
3. Configure AWS SES credentials
4. Set up domain and SSL certificates
5. Use process manager (PM2 recommended)

```bash
# Using PM2
pm2 start index.js --name pettales-backend
```
