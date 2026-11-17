import { config } from 'dotenv';

import IVarsConfig from '@shared/contracts/vars-config.contract';

import packageJson from '../../../package.json';

config({ path: process.env.NODE_ENV === 'test' ? '.env.test' : '.env' });

const {
  APP_URL = '',
  APP_ENV = process.env.NODE_ENV === 'test' ? 'test' : 'local',
  WEB_APP_URL = '',
  WEBSITE_URL = '',
  TAX_CALCULATOR_URL = '',

  GOOGLE_AUTH_CLIENT_ID = '',
  GOOGLE_AUTH_SECRET = '',
  GOOGLE_AUTH_CALLBACK_URL = '',

  JWT_SECRET_KEY = '',

  LAUNCHDARKLY_SDK_KEY = '',

  NODE_ENV = 'development',

  BETTER_STACK_SOURCE_TOKEN = '',
  BETTER_STACK_INGESTING_HOST = '',

  B2_APP_KEY_ID = '',
  B2_APP_KEY = '',
  B2_BUCKET_NAME = '',
  B2_S3_ENDPOINT = '',
  B2_REGION = '',

  OPEN_AI_KEY = '',

  PORT = 3000,
  POSTGRES_URL = '',
  REDIS_URL = '',
  SENTRY_DSN = '',
  SENTRY_TRACES_SAMPLE_RATE = '0',

  ZEPTO_TOKEN_OSAHON = '',
  ZEPTO_TOKEN_NOREPLY = '',
  ZEPTO_TOKEN_NOTIFICATIONS = '',
} = process.env;

// Docker supplies HOSTNAME per replica for OpenTelemetry service.instance.id;
// APP_INSTANCE_ID is internal and must not be configured separately.
const APP_INSTANCE_ID = process.env.HOSTNAME ?? 'local';

const vars: IVarsConfig = Object.freeze({
  APP_URL,
  APP_ENV: APP_ENV as IVarsConfig['APP_ENV'],
  APP_INSTANCE_ID,
  APP_VERSION: packageJson.version,
  WEB_APP_URL,
  WEBSITE_URL,
  TAX_CALCULATOR_URL,
  GOOGLE_AUTH_CLIENT_ID,
  GOOGLE_AUTH_SECRET,
  GOOGLE_AUTH_CALLBACK_URL,
  LAUNCHDARKLY_SDK_KEY,
  JWT_SECRET_KEY,
  NODE_ENV: NODE_ENV as IVarsConfig['NODE_ENV'],
  BETTER_STACK_SOURCE_TOKEN,
  BETTER_STACK_INGESTING_HOST,
  B2_APP_KEY_ID,
  B2_APP_KEY,
  B2_BUCKET_NAME,
  B2_S3_ENDPOINT,
  B2_REGION,
  OPEN_AI_KEY,
  PORT: +PORT,
  POSTGRES_URL,
  REDIS_URL,
  SENTRY_DSN,
  SENTRY_TRACES_SAMPLE_RATE,
  ZEPTO_TOKEN_OSAHON,
  ZEPTO_TOKEN_NOREPLY,
  ZEPTO_TOKEN_NOTIFICATIONS,
});

export default vars;
