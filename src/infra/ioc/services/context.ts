import makeFeatureFlagAppService from '@app/context/services/feature-flag.service';

import featureFlagService from '@infra/services/feature-flag.service';

export const featureFlagAppService = makeFeatureFlagAppService({
  featureFlagService,
});
