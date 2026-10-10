import IFeatureFlagAppService, {
  IFeatureFlagContext,
} from '@app/context/contracts/feature-flag.service.contract';

import launchDarklyClient from '@infra/integrations/launchdarkly/launchdarkly.client';

function buildUserKind(email: string) {
  return {
    kind: 'user',
    key: email,
    email,
    _meta: {
      privateAttributes: ['email'],
    },
  };
}

async function canAccessAlpha1(context: IFeatureFlagContext) {
  return await launchDarklyClient.boolVariation(
    'v_0_1_0_alpha_1',
    buildUserKind(context.email),
    false
  );
}

const featureFlagAppService: IFeatureFlagAppService = Object.freeze({
  canAccessAlpha1,
});

export default featureFlagAppService;
