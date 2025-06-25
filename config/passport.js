const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const { User } = require("../models");
const { emailService } = require("../services");
const logger = require("../utils/logger");
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  DEFAULT_CREDITS_BALANCE,
} = require("../utils/constants");

// Only configure Google OAuth if credentials are provided
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: "/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Google ID
          let user = await User.findOne({ google_id: profile.id });

          if (user) {
            // User exists, return user
            return done(null, user);
          }

          // Check if user exists with same email
          user = await User.findOne({ email: profile.emails[0].value });

          if (user) {
            // User exists with same email, link Google account
            user.google_id = profile.id;
            if (profile.photos && profile.photos[0]) {
              user.profile_image_url = profile.photos[0].value;
            }
            user.email_verified = true; // Google emails are pre-verified
            await user.save();
            return done(null, user);
          }

          // Create new user
          const newUser = new User({
            google_id: profile.id,
            email: profile.emails[0].value,
            first_name: profile.name.givenName || "User",
            last_name: profile.name.familyName || "",
            profile_image_url:
              profile.photos && profile.photos[0]
                ? profile.photos[0].value
                : null,
            email_verified: true, // Google emails are pre-verified
            credits_balance: DEFAULT_CREDITS_BALANCE,
          });

          await newUser.save();

          // Send welcome email
          try {
            await emailService.sendWelcomeEmail(
              newUser.email,
              newUser.first_name
            );
          } catch (emailError) {
            logger.email("welcome", newUser.email, false, {
              error: emailError.message,
            });
            // Don't fail registration if email fails
          }

          return done(null, newUser);
        } catch (error) {
          logger.error(`Google OAuth error: ${error}`);
          return done(error, null);
        }
      }
    )
  );
} else {
  logger.info(
    "Google OAuth credentials not provided - Google authentication disabled"
  );
}

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
