import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from './index';
import { findOrCreateUserByGoogle } from '../services/auth';

passport.use(
  new GoogleStrategy(
    {
      clientID: config.google.clientId,
      clientSecret: config.google.clientSecret,
      callbackURL: config.google.callbackUrl,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const googleId = profile.id;

        if (!email) {
          return done(new Error('No email provided by Google'));
        }

        const user = await findOrCreateUserByGoogle(googleId, email, name);
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Serialize user for session storage
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (userId: string, done) => {
  try {
    const { pool } = await import('../config/database');
    const result = await pool.query('SELECT id, email, role, is_active FROM users WHERE id = $1', [userId]);
    
    if (result.rows.length === 0) {
      return done(null, false);
    }
    
    done(null, result.rows[0]);
  } catch (error) {
    done(error);
  }
});

export default passport;
