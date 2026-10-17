import IFeatureFlagService from '@shared/contracts/feature-flag.service.contract';

import IFeatureFlagAppService from '@app/context/contracts/feature-flag.service.contract';

interface IDependencies {
  featureFlagService: IFeatureFlagService;
}

/** Evaluates Alpha 1 access with a deny fallback; provider failures propagate. */
function makeCanAccessAlpha1(
  deps: IDependencies
): IFeatureFlagAppService['canAccessAlpha1'] {
  return (context) =>
    deps.featureFlagService.isEnabled('v_0_1_0_alpha_1', context, false);
}

export default function makeFeatureFlagAppService(
  deps: IDependencies
): IFeatureFlagAppService {
  return Object.freeze({
    canAccessAlpha1: makeCanAccessAlpha1(deps),
  });
}
