import { config } from 'dotenv';

import IVarsConfig from '@shared/contracts/vars-config.contract';

import packageJson from '../../../../package.json';

jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

const ENVIRONMENT_VARIABLES = [
  'APP_URL',
  'APP_ENV',
  'APP_VERSION',
  'HOSTNAME',
  'WEB_APP_URL',
  'WEBSITE_URL',
  'TAX_CALCULATOR_URL',
  'GOOGLE_AUTH_CLIENT_ID',
  'GOOGLE_AUTH_SECRET',
  'GOOGLE_AUTH_CALLBACK_URL',
  'JWT_SECRET_KEY',
  'LAUNCHDARKLY_SDK_KEY',
  'NODE_ENV',
  'BETTER_STACK_SOURCE_TOKEN',
  'BETTER_STACK_INGESTING_HOST',
  'B2_APP_KEY_ID',
  'B2_APP_KEY',
  'B2_BUCKET_NAME',
  'B2_S3_ENDPOINT',
  'B2_REGION',
  'PORT',
  'POSTGRES_URL',
  'REDIS_URL',
  'SENTRY_DSN',
  'SENTRY_TRACES_SAMPLE_RATE',
  'ZEPTO_TOKEN_OSAHON',
  'ZEPTO_TOKEN_NOREPLY',
  'ZEPTO_TOKEN_NOTIFICATIONS',
] as const;

type TEnvironmentVariable = (typeof ENVIRONMENT_VARIABLES)[number];

function loadVars(
  overrides: Partial<Record<TEnvironmentVariable, string>> = {}
): IVarsConfig {
  const originalValues = new Map(
    ENVIRONMENT_VARIABLES.map((key) => [key, process.env[key]])
  );

  ENVIRONMENT_VARIABLES.forEach((key) => delete process.env[key]);
  Object.assign(process.env, overrides);

  let vars!: IVarsConfig;

  try {
    jest.isolateModules(() => {
      vars =
        jest.requireActual<typeof import('@infra/config/vars.config')>(
          '../vars.config'
        ).default;
    });
  } finally {
    ENVIRONMENT_VARIABLES.forEach((key) => {
      const originalValue = originalValues.get(key);

      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    });
  }

  return vars;
}

describe('vars config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses local-safe defaults outside the test environment', () => {
    const vars = loadVars();

    expect(config).toHaveBeenCalledWith({ path: '.env' });
    expect(vars).toEqual({
      APP_URL: '',
      APP_ENV: 'local',
      APP_INSTANCE_ID: 'local',
      APP_VERSION: packageJson.version,
      WEB_APP_URL: '',
      WEBSITE_URL: '',
      TAX_CALCULATOR_URL: '',
      GOOGLE_AUTH_CLIENT_ID: '',
      GOOGLE_AUTH_SECRET: '',
      GOOGLE_AUTH_CALLBACK_URL: '',
      LAUNCHDARKLY_SDK_KEY: '',
      JWT_SECRET_KEY: '',
      NODE_ENV: 'development',
      BETTER_STACK_SOURCE_TOKEN: '',
      BETTER_STACK_INGESTING_HOST: '',
      B2_APP_KEY_ID: '',
      B2_APP_KEY: '',
      B2_BUCKET_NAME: '',
      B2_S3_ENDPOINT: '',
      B2_REGION: '',
      PORT: 3000,
      POSTGRES_URL: '',
      REDIS_URL: '',
      SENTRY_DSN: '',
      SENTRY_TRACES_SAMPLE_RATE: '0',
      ZEPTO_TOKEN_OSAHON: '',
      ZEPTO_TOKEN_NOREPLY: '',
      ZEPTO_TOKEN_NOTIFICATIONS: '',
    });
    expect(Object.isFrozen(vars)).toBe(true);
  });

  it('loads test defaults and derives the instance ID from the host', () => {
    const vars = loadVars({ HOSTNAME: 'test-host', NODE_ENV: 'test' });

    expect(config).toHaveBeenCalledWith({ path: '.env.test' });
    expect(vars.APP_ENV).toBe('test');
    expect(vars.APP_INSTANCE_ID).toBe('test-host');
    expect(vars.NODE_ENV).toBe('test');
  });

  it('maps explicit environment values into an immutable config', () => {
    const vars = loadVars({
      APP_URL: 'https://api.example.com',
      APP_ENV: 'production',
      HOSTNAME: 'instance-1',
      APP_VERSION: 'stale-deployment-version',
      WEB_APP_URL: 'https://app.example.com',
      WEBSITE_URL: 'https://example.com',
      TAX_CALCULATOR_URL: 'https://tax.example.com',
      GOOGLE_AUTH_CLIENT_ID: 'google-client',
      GOOGLE_AUTH_SECRET: 'google-secret',
      GOOGLE_AUTH_CALLBACK_URL: 'https://api.example.com/auth/google',
      JWT_SECRET_KEY: 'jwt-secret',
      LAUNCHDARKLY_SDK_KEY: 'launchdarkly-key',
      NODE_ENV: 'production',
      BETTER_STACK_SOURCE_TOKEN: 'better-stack-token',
      BETTER_STACK_INGESTING_HOST: 's123.eu-nbg-2.betterstackdata.com',
      B2_APP_KEY_ID: 'b2-key-id',
      B2_APP_KEY: 'b2-application-key',
      B2_BUCKET_NAME: 'drimsheet-files',
      B2_S3_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
      B2_REGION: 'us-west-004',
      PORT: '4000',
      POSTGRES_URL: 'postgres://database',
      REDIS_URL: 'redis://cache',
      SENTRY_DSN: 'https://sentry.example.com/1',
      SENTRY_TRACES_SAMPLE_RATE: '0.25',
      ZEPTO_TOKEN_OSAHON: 'osahon-token',
      ZEPTO_TOKEN_NOREPLY: 'noreply-token',
      ZEPTO_TOKEN_NOTIFICATIONS: 'notifications-token',
    });

    expect(vars).toEqual({
      APP_URL: 'https://api.example.com',
      APP_ENV: 'production',
      APP_INSTANCE_ID: 'instance-1',
      APP_VERSION: packageJson.version,
      WEB_APP_URL: 'https://app.example.com',
      WEBSITE_URL: 'https://example.com',
      TAX_CALCULATOR_URL: 'https://tax.example.com',
      GOOGLE_AUTH_CLIENT_ID: 'google-client',
      GOOGLE_AUTH_SECRET: 'google-secret',
      GOOGLE_AUTH_CALLBACK_URL: 'https://api.example.com/auth/google',
      LAUNCHDARKLY_SDK_KEY: 'launchdarkly-key',
      JWT_SECRET_KEY: 'jwt-secret',
      NODE_ENV: 'production',
      BETTER_STACK_SOURCE_TOKEN: 'better-stack-token',
      BETTER_STACK_INGESTING_HOST: 's123.eu-nbg-2.betterstackdata.com',
      B2_APP_KEY_ID: 'b2-key-id',
      B2_APP_KEY: 'b2-application-key',
      B2_BUCKET_NAME: 'drimsheet-files',
      B2_S3_ENDPOINT: 'https://s3.us-west-004.backblazeb2.com',
      B2_REGION: 'us-west-004',
      PORT: 4000,
      POSTGRES_URL: 'postgres://database',
      REDIS_URL: 'redis://cache',
      SENTRY_DSN: 'https://sentry.example.com/1',
      SENTRY_TRACES_SAMPLE_RATE: '0.25',
      ZEPTO_TOKEN_OSAHON: 'osahon-token',
      ZEPTO_TOKEN_NOREPLY: 'noreply-token',
      ZEPTO_TOKEN_NOTIFICATIONS: 'notifications-token',
    });
    expect(vars.APP_VERSION).toBe(packageJson.version);
    expect(Object.isFrozen(vars)).toBe(true);
  });

  it('does not expose collector-era configuration aliases', () => {
    const legacyVariableNames = [
      `METRICS_${'ENABLED'}`,
      `METRICS_OTLP_HTTP_${'ENDPOINT'}`,
      `BULLMQ_METRICS_${'PORT'}`,
    ];

    expect(Object.keys(loadVars())).not.toEqual(
      expect.arrayContaining(legacyVariableNames)
    );
  });
});
