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

  otp: {
    expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10),
    smsProvider: process.env.SMS_PROVIDER || 'console',
  },

  upload: {
    dir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  admin: {
    phoneAllowlist: (process.env.ADMIN_PHONE_ALLOWLIST || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean),
    registrationCode: process.env.ADMIN_REGISTRATION_CODE || '',
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
