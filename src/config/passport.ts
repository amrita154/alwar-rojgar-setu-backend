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

export default passport;
