import IReporter from '@shared/contracts/reporter.contract';

import {
  configureRateLimiter,
  RATE_LIMITER_MAX,
  RATE_LIMITER_WINDOW_MS,
} from '@infra/config/rate-limiter.config';

export default function makeGlobalRateLimiter(reporter: IReporter) {
  return configureRateLimiter(
    {
      scope: 'global',
      windowMs: RATE_LIMITER_WINDOW_MS,
      max: RATE_LIMITER_MAX,
    },
    reporter
  );
}
