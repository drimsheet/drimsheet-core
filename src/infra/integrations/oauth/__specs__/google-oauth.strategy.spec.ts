import passport from 'passport';
import {
  Strategy as GoogleStrategy,
  Profile,
  VerifyCallback,
} from 'passport-google-oauth20';

import setupOAuth, {
  mapGoogleProfile,
} from '@infra/integrations/oauth/google-oauth.strategy';
import { loginWithGoogleUseCase } from '@infra/ioc/usecases/auth';

jest.mock('passport', () => ({
  __esModule: true,
  default: { use: jest.fn() },
}));

jest.mock('passport-google-oauth20', () => ({
  Strategy: jest.fn().mockImplementation((options, verify) => ({
    options,
    verify,
  })),
}));

jest.mock('@infra/ioc/usecases/auth', () => ({
  loginWithGoogleUseCase: jest.fn(),
}));

jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: {
    get GOOGLE_AUTH_CLIENT_ID() {
      return process.env.GOOGLE_AUTH_CLIENT_ID || '';
    },
    get GOOGLE_AUTH_SECRET() {
      return process.env.GOOGLE_AUTH_SECRET || '';
    },
    get GOOGLE_AUTH_CALLBACK_URL() {
      return process.env.GOOGLE_AUTH_CALLBACK_URL || '';
    },
  },
}));

type TGoogleVerify = (
  accessToken: string,
  refreshToken: string,
  profile: Profile,
  done: VerifyCallback
) => Promise<void>;

const originalGoogleClientId = process.env.GOOGLE_AUTH_CLIENT_ID;
const originalGoogleSecret = process.env.GOOGLE_AUTH_SECRET;
const originalGoogleCallbackUrl = process.env.GOOGLE_AUTH_CALLBACK_URL;

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function getGoogleVerify(): TGoogleVerify {
  return jest.mocked(GoogleStrategy).mock
    .calls[0][1] as unknown as TGoogleVerify;
}

describe('mapGoogleProfile', () => {
  it('maps the stable Google subject and verified primary email', () => {
    const profile = {
      id: 'google-subject-123',
      name: { givenName: 'Ada', familyName: 'Lovelace' },
      emails: [{ value: 'ada@example.com', verified: true }],
    } as Profile;

    expect(mapGoogleProfile(profile)).toEqual({
      providerSubject: 'google-subject-123',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      emailVerified: true,
    });
  });

  it('does not infer verification when Google omits identity fields', () => {
    const profile = { id: 'google-subject-123' } as Profile;

    expect(mapGoogleProfile(profile)).toEqual({
      providerSubject: 'google-subject-123',
      firstName: '',
      lastName: '',
      email: '',
      emailVerified: false,
    });
  });
});

describe('setupOAuth', () => {
  const profile = {
    id: 'google-subject-123',
    name: { givenName: 'Ada', familyName: 'Lovelace' },
    emails: [{ value: 'ada@example.com', verified: true }],
  } as Profile;

  beforeEach(() => {
    process.env.GOOGLE_AUTH_CLIENT_ID = 'client-id';
    process.env.GOOGLE_AUTH_SECRET = 'client-secret';
    process.env.GOOGLE_AUTH_CALLBACK_URL = 'https://api.test/auth/google';
    jest.clearAllMocks();
  });

  afterAll(() => {
    restoreEnvironment('GOOGLE_AUTH_CLIENT_ID', originalGoogleClientId);
    restoreEnvironment('GOOGLE_AUTH_SECRET', originalGoogleSecret);
    restoreEnvironment('GOOGLE_AUTH_CALLBACK_URL', originalGoogleCallbackUrl);
  });

  it('does not register Google OAuth without complete credentials', () => {
    delete process.env.GOOGLE_AUTH_CLIENT_ID;
    delete process.env.GOOGLE_AUTH_SECRET;

    setupOAuth();

    process.env.GOOGLE_AUTH_CLIENT_ID = 'client-id';
    setupOAuth();

    expect(passport.use).not.toHaveBeenCalled();
    expect(GoogleStrategy).not.toHaveBeenCalled();
  });

  it('registers Google OAuth and delegates verified profiles', async () => {
    jest.mocked(loginWithGoogleUseCase).mockResolvedValue(undefined);
    const done = jest.fn() as VerifyCallback;

    setupOAuth();
    const verify = getGoogleVerify();
    await verify('access-token', 'refresh-token', profile, done);

    expect(GoogleStrategy).toHaveBeenCalledWith(
      {
        clientID: 'client-id',
        clientSecret: 'client-secret',
        callbackURL: 'https://api.test/auth/google',
      },
      expect.any(Function)
    );
    expect(passport.use).toHaveBeenCalledWith(
      jest.mocked(GoogleStrategy).mock.results[0].value
    );
    expect(loginWithGoogleUseCase).toHaveBeenCalledWith(
      {
        providerSubject: 'google-subject-123',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        emailVerified: true,
      },
      done
    );
    expect(done).not.toHaveBeenCalled();
  });

  it('passes OAuth delegation failures to Passport', async () => {
    const failure = new Error('login failed');
    jest.mocked(loginWithGoogleUseCase).mockRejectedValue(failure);
    const done = jest.fn() as VerifyCallback;

    setupOAuth();
    await getGoogleVerify()('access-token', 'refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(failure, false);
  });
});
