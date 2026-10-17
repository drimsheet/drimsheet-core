import bootstrapSentry from '@infra/integrations/sentry/sentry.bootstrap';
import bootstrapObservability from '@infra/runtime/bootstrap/observability.bootstrap';

jest.mock('@infra/integrations/sentry/sentry.bootstrap', () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe('bootstrapObservability', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates provider initialization to Sentry', () => {
    bootstrapObservability();

    expect(bootstrapSentry).toHaveBeenCalledTimes(1);
  });
});
