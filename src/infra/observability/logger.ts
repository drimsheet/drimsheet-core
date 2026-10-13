import * as winston from 'winston';

import ILogger from '@shared/contracts/logger.contract';
import IVarsConfig from '@shared/contracts/vars-config.contract';
import {
  ELogLevel,
  ILogFields,
  ULogLevel,
} from '@shared/types/observability.types';
import safeJSON from '@shared/utils/safe-json';
import { sanitizeData } from '@shared/utils/sanitizer';

import IAppContext from '@app/context/contracts/app-context.contract';

import vars from '@infra/config/vars.config';
import makeBetterStackLogRuntime from '@infra/integrations/better-stack/better-stack-log-runtime';
import { BETTER_STACK_CONFIG } from '@infra/integrations/better-stack/better-stack.config';
import tracer from '@infra/integrations/sentry/sentry-tracer';
import safeGetCorrelationId from '@infra/observability/helpers/get-correlation-id';
import { normalizeTelemetryError } from '@infra/observability/helpers/telemetry-error';

import packageJson from '../../../package.json';

type TCorrelationContext = Pick<IAppContext, 'get'>;

interface ILoggerOptions {
  appContext?: TCorrelationContext;
  appEnv?: IVarsConfig['APP_ENV'];
  service?: string;
  remoteTransport?: winston.transport;
  transport?: winston.transport;
  version?: string;
}

const LOGGER_OWNED_FIELDS = new Set([
  'timestamp',
  'level',
  'event',
  'service',
  'environment',
  'version',
  'correlationId',
  'traceId',
  'spanId',
]);

const LOCAL_PREFIX_FIELDS = new Set([
  'timestamp',
  'level',
  'event',
  'message',
  'service',
  'environment',
  'version',
]);

const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/;

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  debug: 'grey',
});

const omitEmptyMessageFormat = winston.format((info) => {
  if (info.message === '') {
    delete info.message;
  }
  return info;
});

const localFormat = winston.format.combine(
  winston.format.colorize({ level: true }),
  winston.format.printf((fields) => {
    const message = fields.message as string;
    const humanMessage = message ? `: ${message}` : '';
    const staticContext = `${fields.service} ${fields.environment}@${fields.version}`;
    const metadataFields = Object.fromEntries(
      Object.entries(fields).filter(
        ([field]) => !LOCAL_PREFIX_FIELDS.has(field)
      )
    );
    const metadata = Object.keys(metadataFields).length
      ? ` ${safeJSON.stringify(metadataFields)}`
      : '';

    return `${fields.timestamp} [${fields.level}] ${fields.event}${humanMessage} (${staticContext})${metadata}`;
  })
);

const jsonFormat = winston.format.combine(
  omitEmptyMessageFormat(),
  winston.format.json()
);

function prepareFields(fields: ILogFields = {}): ILogFields {
  const sanitizedInput = sanitizeData(fields);
  const sanitizedFields =
    sanitizedInput &&
    typeof sanitizedInput === 'object' &&
    !Array.isArray(sanitizedInput)
      ? (sanitizedInput as ILogFields)
      : {};
  const error = fields?.error;

  LOGGER_OWNED_FIELDS.forEach((field) => delete sanitizedFields[field]);

  if (typeof sanitizedFields.message !== 'string') {
    delete sanitizedFields.message;
  }

  if (error !== undefined) {
    const normalizedError = normalizeTelemetryError(error);
    sanitizedFields.error = normalizedError;

    if (normalizedError.errorKey) {
      sanitizedFields.errorKey = normalizedError.errorKey;
    } else {
      delete sanitizedFields.errorKey;
    }
  }

  return sanitizedFields;
}

function safeGetActiveTrace() {
  try {
    const activeTrace = tracer.getActiveTrace();

    return activeTrace &&
      TRACE_ID_PATTERN.test(activeTrace.traceId) &&
      SPAN_ID_PATTERN.test(activeTrace.spanId)
      ? activeTrace
      : undefined;
  } catch {
    return undefined;
  }
}

export function makeLogger(options: ILoggerOptions = {}): ILogger {
  const appEnv = options.appEnv ?? vars.APP_ENV;
  const service = options.service ?? packageJson.name;
  const version = options.version ?? vars.APP_VERSION;

  const transports = [options.transport ?? new winston.transports.Console()];

  if (appEnv !== 'local' && options.remoteTransport) {
    transports.push(options.remoteTransport);
  }

  const winstonLogger = winston.createLogger({
    level: 'debug',
    format: appEnv === 'local' ? localFormat : jsonFormat,
    transports,
  });

  const log = (level: ULogLevel, event: string, fields?: ILogFields) => {
    const correlationId = safeGetCorrelationId(options.appContext);
    const activeTrace = safeGetActiveTrace();
    const preparedFields = prepareFields(fields);

    winstonLogger.log({
      ...preparedFields,
      timestamp: new Date().toISOString(),
      level,
      event: sanitizeData(event) as string,
      service,
      environment: appEnv,
      version,
      ...(correlationId ? { correlationId } : {}),
      ...activeTrace,
      message: preparedFields.message ?? '',
    });
  };

  const logger: ILogger = {
    info: (event, fields) => log(ELogLevel.Info, event, fields),
    warn: (event, fields) => log(ELogLevel.Warn, event, fields),
    error: (event, fields) => log(ELogLevel.Error, event, fields),
    debug: (event, fields) => log(ELogLevel.Debug, event, fields),
  };

  return logger;
}

export const betterStackLogRuntime =
  makeBetterStackLogRuntime(BETTER_STACK_CONFIG);

export default makeLogger({
  remoteTransport: betterStackLogRuntime.transport,
});
