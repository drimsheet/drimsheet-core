import normalizeTelemetryErrorHelper from '@infra/observability/helpers/normalize-telemetry-error.helper';

describe('normalizeTelemetryErrorHelper', () => {
  it('keeps canonical sanitized Error fields and drops custom properties', () => {
    const error = Object.assign(
      new TypeError(
        'Invalid email private.person@example.com and credential private-refresh-token'
      ),
      {
        errorKey: 'auth_error_token_invalid_unauthorized',
        cause: { userId: 'private-user-id' },
        amount: 100,
      }
    );

    const normalized = normalizeTelemetryErrorHelper(error);
    expect(normalized).toEqual({
      name: 'TypeError',
      message: 'Invalid email [REDACTED] and credential [REDACTED]',
      stack: expect.any(String),
      errorKey: 'auth_error_token_invalid_unauthorized',
    });
    expect(normalized.stack).not.toContain('private.person@example.com');
    expect(normalized.stack).not.toContain('private-refresh-token');
    expect(normalized).not.toHaveProperty('cause');
    expect(normalized).not.toHaveProperty('amount');
  });

  it('handles an Error without a stack or error key', () => {
    const error = new Error('plain failure');
    delete error.stack;

    expect(normalizeTelemetryErrorHelper(error)).toEqual({
      name: 'Error',
      message: 'plain failure',
    });
  });

  it.each([
    ['string', 'private@example.com'],
    ['object', { email: 'private@example.com' }],
    ['array', ['private@example.com']],
    ['null', null],
    ['undefined', undefined],
  ])('represents a non-Error %s without its original value', (type, value) => {
    const normalized = normalizeTelemetryErrorHelper(value);

    expect(normalized).toEqual({
      name: 'UnknownError',
      message: `A non-Error value was thrown (type: ${type})`,
    });
    expect(JSON.stringify(normalized)).not.toContain('private@example.com');
  });

  it('falls back safely when an Error property cannot be inspected', () => {
    const error = new Error('private@example.com');
    Object.defineProperty(error, 'name', {
      get() {
        throw new Error('blocked');
      },
    });

    expect(normalizeTelemetryErrorHelper(error)).toEqual({
      name: 'UnknownError',
      message: 'An Error instance could not be inspected safely',
    });
  });

  it('uses stable fallbacks for malformed Error identity fields', () => {
    const error = new Error('');
    error.name = '';
    Object.defineProperty(error, 'message', { value: 42 });
    Object.defineProperty(error, 'errorKey', { value: 42 });

    expect(normalizeTelemetryErrorHelper(error)).toEqual({
      name: 'Error',
      message: 'Error',
      stack: expect.any(String),
    });
  });
});
