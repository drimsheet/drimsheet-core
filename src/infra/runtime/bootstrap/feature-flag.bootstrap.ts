import featureFlagLifecycle from '@infra/runtime/lifecycle/feature-flag.lifecycle';

export default async function bootstrapFeatureFlags() {
  await featureFlagLifecycle.initialize();
  featureFlagLifecycle.registerShutdown();
}
