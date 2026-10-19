import IFeatureFlagService, {
  IFeatureFlagContext,
} from '@shared/contracts/feature-flag.service.contract';

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

/** Evaluates a boolean flag, preserving the caller's fallback and SDK errors. */
async function isEnabled(
  flagKey: string,
  context: IFeatureFlagContext,
  defaultValue: boolean
) {
  return await launchDarklyClient.boolVariation(
    flagKey,
    buildUserKind(context.email),
    defaultValue
  );
}

const featureFlagService: IFeatureFlagService = Object.freeze({
  isEnabled,
});

export default featureFlagService;
