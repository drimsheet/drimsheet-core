import Sentry from '@sentry/node';

import * as sanitizer from '@shared/utils/sanitizer';

import reporter from '@infra/integrations/sentry/sentry-reporter';
import logger from '@infra/observability/logger';
import appContext from '@infra/runtime/app-context';

const originalAppEnv = process.env.APP_ENV;

jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: {
    BETTER_STACK_SOURCE_TOKEN: '',
    BETTER_STACK_INGESTING_HOST: '',
    get APP_ENV() {
      return process.env.APP_ENV || 'test';
    },
  },
}));

type TReportContext = NonNullable<Parameters<typeof reporter.report>[2]>;
type TAbuseContext = Parameters<typeof reporter.reportAbuse>[1];

describe('reporter', () => {
  const validCorrelationId = '0198ad49-0f4a-7709-a5bf-2f7cfbaea7c4';

  afterEach(() => {
    if (originalAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = originalAppEnv;
    }

    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('projects approved context and reports one canonical error', () => {
    const loggerErrorSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    const error = Object.assign(
      new Error(
        'Failed for private.person@example.com with token: secret_abc123'
      ),
      {
        errorKey: 'auth_error_token_invalid_unauthorized',
        cause: { userId: 'private-user-id' },
        validationErrors: [{ field: 'email' }],
      }
    );
    const context = {
      operation: 'finalize-password-reset-token',
      queue: 'test-queue',
      transport: 'bullmq',
      attempt: 2,
      source: 'worker',
      signal: 'SIGTERM',
      subscriber: 'queue-worker',
      eventType: 'domain:test:event',
      eventTypes: ['domain:test:first', 'domain:test:second'],
      password: 'super-secret-pass',
      userId: 'private-user-id',
      payload: { amount: 100 },
    } as unknown as TReportContext;

    appContext.init(
      { correlationId: validCorrelationId, idempotencyKey: '' },
      () =>
        reporter.report(
          'auth.password_reset.finalization_failed',
          error,
          context
        )
    );

    const loggerFields = loggerErrorSpy.mock.calls[0][1];
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      'auth.password_reset.finalization_failed',
      {
        operation: 'finalize-password-reset-token',
        queue: 'test-queue',
        transport: 'bullmq',
        attempt: 2,
        source: 'worker',
        signal: 'SIGTERM',
        subscriber: 'queue-worker',
        eventType: 'domain:test:event',
        eventTypes: ['domain:test:first', 'domain:test:second'],
        error: expect.any(Error),
      }
    );
    expect(loggerFields).not.toHaveProperty('password');
    expect(loggerFields).not.toHaveProperty('userId');
    expect(loggerFields).not.toHaveProperty('payload');

    const sentryError = jest.mocked(Sentry.captureException).mock.calls[0][0];
    const sentryContext = jest.mocked(Sentry.captureException).mock
      .calls[0][1] as { extra?: Record<string, unknown> } | undefined;

    expect(sentryError).toEqual(expect.any(Error));
    expect((sentryError as Error).message).not.toContain(
      'private.person@example.com'
    );
    expect((sentryError as Error).message).not.toContain('secret_abc123');
    expect(sentryError).toHaveProperty(
      'errorKey',
      'auth_error_token_invalid_unauthorized'
    );
    expect(sentryError).not.toHaveProperty('cause');
    expect(sentryError).not.toHaveProperty('validationErrors');
    expect(sentryContext?.extra).toEqual({
      operation: 'finalize-password-reset-token',
      queue: 'test-queue',
      transport: 'bullmq',
      attempt: 2,
      source: 'worker',
      signal: 'SIGTERM',
      subscriber: 'queue-worker',
      eventType: 'domain:test:event',
      eventTypes: ['domain:test:first', 'domain:test:second'],
      errorKey: 'auth_error_token_invalid_unauthorized',
      correlationId: validCorrelationId,
    });
  });

  it('omits malformed contextual correlation IDs without failing reporting', () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const malformedCorrelationId = 'private.person@example.com';

    expect(() =>
      appContext.init(
        { correlationId: malformedCorrelationId, idempotencyKey: '' },
        () =>
          reporter.report('queue.job.processing_failed', new Error('failed'))
      )
    ).not.toThrow();

    const sentryContext = jest.mocked(Sentry.captureException).mock
      .calls[0][1] as { extra?: Record<string, unknown> } | undefined;

    expect(sentryContext?.extra).toEqual({});
    expect(JSON.stringify(sentryContext)).not.toContain(malformedCorrelationId);
  });

  it('does not serialize a non-Error thrown value', () => {
    const loggerErrorSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);

    reporter.report('queue.job.processing_failed', {
      email: 'private@example.com',
      amount: 100,
    });

    const sentryError = jest.mocked(Sentry.captureException).mock.calls[0][0];
    expect(sentryError).toEqual(expect.any(Error));
    expect((sentryError as Error).name).toBe('UnknownError');
    expect((sentryError as Error).message).toBe(
      'A non-Error value was thrown (type: object)'
    );
    expect(JSON.stringify(sentryError)).not.toContain('private@example.com');
    expect(loggerErrorSpy).toHaveBeenCalledWith('queue.job.processing_failed', {
      error: sentryError,
    });
  });

  it('reports abuse with only bounded threshold facts', () => {
    const loggerWarnSpy = jest
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);
    const context = {
      method: 'POST',
      scope: 'login-with-email',
      used: 6,
      limit: 5,
      ip: '192.0.2.1',
      url: '/auth/login?email=private@example.com',
      userAgent: 'PrivateAgent',
    } as unknown as TAbuseContext;

    reporter.reportAbuse(
      'Too many attempts for private.person@example.com',
      context
    );

    expect(loggerWarnSpy).toHaveBeenCalledWith('security.abuse.detected', {
      method: 'POST',
      scope: 'login-with-email',
      used: 6,
      limit: 5,
      message: 'Too many attempts for [REDACTED]',
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Too many attempts for [REDACTED]',
      {
        level: 'warning',
        extra: {
          method: 'POST',
          scope: 'login-with-email',
          used: 6,
          limit: 5,
        },
      }
    );
  });

  it('handles empty messages and missing runtime context safely', () => {
    const loggerWarnSpy = jest
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);

    reporter.reportAbuse('', undefined as unknown as TAbuseContext);

    expect(loggerWarnSpy).toHaveBeenCalledWith('security.abuse.detected', {
      message: '',
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith('', {
      level: 'warning',
      extra: {},
    });
  });

  it('drops malformed values from runtime-projected context', () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const context = {
      operation: { payload: 'private' },
      transport: 'kafka',
      attempt: Number.POSITIVE_INFINITY,
      eventTypes: ['domain:test:safe', 42],
    } as unknown as TReportContext;

    reporter.report(
      'queue.job.processing_failed',
      new Error('failed'),
      context
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: {},
    });
  });

  it('drops malformed values from runtime-projected abuse context', () => {
    const loggerWarnSpy = jest
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);
    const context = {
      method: 42,
      scope: { name: 'login-with-email' },
      used: Number.POSITIVE_INFINITY,
      limit: Number.NaN,
    } as unknown as TAbuseContext;

    reporter.reportAbuse('Request threshold exceeded', context);

    expect(loggerWarnSpy).toHaveBeenCalledWith('security.abuse.detected', {
      message: 'Request threshold exceeded',
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Request threshold exceeded',
      {
        level: 'warning',
        extra: {},
      }
    );
  });

  it('uses safe defaults when context sanitization produces no output', () => {
    const sanitizeData = sanitizer.sanitizeData;
    jest
      .spyOn(sanitizer, 'sanitizeData')
      .mockImplementation((value: unknown) =>
        typeof value === 'object' && value !== null
          ? undefined
          : sanitizeData(value)
      );
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);

    reporter.report('queue.job.processing_failed', new Error('failed'), {
      queue: 'test-queue',
    });
    reporter.reportAbuse('Request threshold exceeded', {
      method: 'POST',
      scope: 'reset-password',
      used: 6,
      limit: 5,
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: {},
    });
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Request threshold exceeded',
      {
        level: 'warning',
        extra: {},
      }
    );
  });

  it('uses a fallback for non-string abuse messages and includes correlation', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const context: TAbuseContext = {
      method: 'POST',
      scope: 'login-with-email',
      used: 6,
      limit: 5,
    };

    appContext.init(
      { correlationId: validCorrelationId, idempotencyKey: '' },
      () =>
        reporter.reportAbuse(
          { private: 'message' } as unknown as string,
          context
        )
    );

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Abuse threshold exceeded',
      {
        level: 'warning',
        extra: {
          ...context,
          correlationId: validCorrelationId,
        },
      }
    );
  });

  it('does not send abuse reports externally in the local environment', () => {
    const loggerWarnSpy = jest
      .spyOn(logger, 'warn')
      .mockImplementation(() => undefined);
    process.env.APP_ENV = 'local';
    const context: TAbuseContext = {
      method: 'GET',
      scope: 'global',
      used: 701,
      limit: 700,
    };

    reporter.reportAbuse('Request threshold exceeded', context);

    expect(loggerWarnSpy).toHaveBeenCalledWith('security.abuse.detected', {
      ...context,
      message: 'Request threshold exceeded',
    });
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('emits a bounded fallback event when external error reporting fails', () => {
    const loggerErrorSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    jest.mocked(Sentry.captureException).mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });
    const context = {
      queue: 'test-queue',
      transport: 'bullmq',
      payload: { email: 'private@example.com' },
    } as unknown as TReportContext;

    reporter.report(
      'queue.job.processing_failed',
      new Error('job failed'),
      context
    );

    expect(loggerErrorSpy).toHaveBeenLastCalledWith(
      'observability.error.reporting_failed',
      {
        error: expect.any(Error),
        sourceEvent: 'queue.job.processing_failed',
        queue: 'test-queue',
        transport: 'bullmq',
      }
    );
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('uses the same bounded fallback when abuse reporting fails', () => {
    const loggerErrorSpy = jest
      .spyOn(logger, 'error')
      .mockImplementation(() => undefined);
    jest.mocked(Sentry.captureMessage).mockImplementationOnce(() => {
      throw new Error('Sentry unavailable');
    });
    const context: TAbuseContext = {
      method: 'POST',
      scope: 'reset-password',
      used: 6,
      limit: 5,
    };

    reporter.reportAbuse('Request threshold exceeded', context);

    expect(loggerErrorSpy).toHaveBeenLastCalledWith(
      'observability.error.reporting_failed',
      {
        error: expect.any(Error),
        sourceEvent: 'security.abuse.detected',
        ...context,
      }
    );
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
  });

  it('does not throw when caller context cannot be inspected', () => {
    jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const context = new Proxy(
      {},
      {
        get() {
          throw new Error('blocked context');
        },
      }
    ) as TReportContext;

    expect(() =>
      reporter.report(
        'queue.job.processing_failed',
        new Error('failed'),
        context
      )
    ).not.toThrow();
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      extra: {},
    });
  });

  it('does not throw when abuse context cannot be inspected', () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const context = new Proxy(
      {},
      {
        get() {
          throw new Error('blocked context');
        },
      }
    ) as TAbuseContext;

    expect(() =>
      reporter.reportAbuse('Request threshold exceeded', context)
    ).not.toThrow();
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Request threshold exceeded',
      {
        level: 'warning',
        extra: {},
      }
    );
  });
});
