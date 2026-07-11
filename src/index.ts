import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
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
app.use(passport.initialize());

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
