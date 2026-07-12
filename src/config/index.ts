import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'alwar_rojgar_setu',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '30d',
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/v1/auth/google/callback',
  },

  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:5173',
  },

  upload: {
    dir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  admin: {
    inviteCode: process.env.ADMIN_INVITE_CODE || '',
  },

  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Alwar Rojgar Setu <noreply@alwarrojgarsetu.in>',
  },

  translation: {
    provider: process.env.TRANSLATION_PROVIDER || 'google_free',
    google: {
      endpoint:
        process.env.GOOGLE_TRANSLATE_ENDPOINT ||
        'https://translate-pa.googleapis.com/v1/translateHtml',
      apiKey: process.env.GOOGLE_TRANSLATE_API_KEY || 'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520',
    },
    maxTextsPerRequest: parseInt(process.env.TRANSLATION_MAX_TEXTS || '100', 10),
    maxCharsPerRequest: parseInt(process.env.TRANSLATION_MAX_CHARS || '20000', 10),
    rateLimit: {
      windowMs: parseInt(process.env.TRANSLATION_RATE_WINDOW_MS || '60000', 10),
      max: parseInt(process.env.TRANSLATION_RATE_MAX || '60', 10),
    },
  },
} as const;
