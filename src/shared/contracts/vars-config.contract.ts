export default interface IVarsConfig {
  APP_URL: string;
  APP_ENV: 'test' | 'local' | 'development' | 'staging' | 'production';
  APP_INSTANCE_ID: string;
  APP_VERSION: string;
  WEB_APP_URL: string;
  WEBSITE_URL: string;
  TAX_CALCULATOR_URL: string;

  GOOGLE_AUTH_CLIENT_ID: string;
  GOOGLE_AUTH_SECRET: string;
  GOOGLE_AUTH_CALLBACK_URL: string;

  LAUNCHDARKLY_SDK_KEY: string;

  JWT_SECRET_KEY: string;

  NODE_ENV: 'test' | 'development' | 'production';

  BETTER_STACK_SOURCE_TOKEN: string;
  BETTER_STACK_INGESTING_HOST: string;

  B2_APP_KEY_ID: string;
  B2_APP_KEY: string;
  B2_BUCKET_NAME: string;
  B2_S3_ENDPOINT: string;
  B2_REGION: string;

  OPEN_AI_KEY: string;

  PORT: number;

  POSTGRES_URL: string;
  MONGODB_URL: string;
  REDIS_URL: string;

  SENTRY_DSN: string;
  SENTRY_TRACES_SAMPLE_RATE: string;

  ZEPTO_TOKEN_OSAHON: string;
  ZEPTO_TOKEN_NOREPLY: string;
  ZEPTO_TOKEN_NOTIFICATIONS: string;
}
