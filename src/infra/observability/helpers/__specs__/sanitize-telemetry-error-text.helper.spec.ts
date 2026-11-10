import * as sanitizer from '@shared/utils/sanitizer';

import sanitizeTelemetryErrorTextHelper from '@infra/observability/helpers/sanitize-telemetry-error-text.helper';

describe('sanitizeTelemetryErrorTextHelper', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the caller fallback when string sanitization returns no string', () => {
    jest.spyOn(sanitizer, 'sanitizeData').mockReturnValue(undefined);

    expect(
      sanitizeTelemetryErrorTextHelper('private value', 'safe fallback')
    ).toBe('safe fallback');
  });
});
