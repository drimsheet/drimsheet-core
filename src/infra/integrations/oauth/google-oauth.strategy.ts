import passport from 'passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';

import { IOAuthProfile } from '@app/auth/dtos/auth/auth.dto';

import vars from '@infra/config/vars.config';
import { loginWithGoogleUseCase } from '@infra/ioc/usecases/auth';

export function mapGoogleProfile(profile: Profile): IOAuthProfile {
  const primaryEmail = profile.emails?.[0];

  return {
    providerSubject: profile.id,
    firstName: profile.name?.givenName || '',
    lastName: profile.name?.familyName || '',
    email: primaryEmail?.value || '',
    emailVerified: primaryEmail?.verified === true,
  };
}

export default function setupOAuth() {
  if (!vars.GOOGLE_AUTH_CLIENT_ID || !vars.GOOGLE_AUTH_SECRET) {
    return;
  }

  passport.use(
    new Strategy(
      {
        clientID: vars.GOOGLE_AUTH_CLIENT_ID,
        clientSecret: vars.GOOGLE_AUTH_SECRET,
        callbackURL: vars.GOOGLE_AUTH_CALLBACK_URL,
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: Profile,
        done: VerifyCallback
      ) => {
        try {
          await loginWithGoogleUseCase(mapGoogleProfile(profile), done);
        } catch (error) {
          done(error as Error, false);
        }
      }
    )
  );
}
