import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { config } from './config';
import { errorHandler, notFound } from './middleware/errorHandler';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import candidateRoutes from './routes/candidate';
import employerRoutes from './routes/employer';
import jobRoutes from './routes/jobs';
import applicationRoutes from './routes/applications';
import adminRoutes from './routes/admin';
import statsRoutes from './routes/stats';

const app = express();

// Core middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(config.upload.dir)));

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

// Error handling
app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} (${config.nodeEnv})`);
  console.log(`API base: http://localhost:${config.port}/api/v1`);
});

export default app;
