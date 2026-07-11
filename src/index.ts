import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import passport from 'passport';
import { config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimiter';
import './config/passport';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import candidateRoutes from './routes/candidate';
import employerRoutes from './routes/employer';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';
import documentRoutes from './routes/documents';
import translateRoutes from './routes/translate';

const app = express();
const SessionStore = SQLiteStore(session);

app.set('trust proxy', 1);
app.use(helmet());
app.use(globalLimiter);
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = config.cors.origin.split(',').map((o) => o.trim());
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Session middleware for Passport OAuth flow
app.use(session({
  store: new SessionStore({ db: 'sessions.db', dir: './sessions' }),
  secret: config.jwt.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.nodeEnv === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get('/api/v1/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/candidate-profile', candidateRoutes);
app.use('/api/v1/employer-profile', employerRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/job-applications', applicationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/stats', statsRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/translate', translateRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.nodeEnv})`);
    console.log(`API base: http://localhost:${config.port}/api/v1`);
  });
}

export default app;
