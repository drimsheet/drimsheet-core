import bootstrapObservability from '@infra/runtime/bootstrap/observability.bootstrap';

async function startBackground(): Promise<void> {
  // Load clients only after observability has installed instrumentation.
  const { default: runBackground } =
    await import('@infra/runtime/lifecycle/background-runtime.lifecycle');
  await runBackground();
}

bootstrapObservability();
void startBackground();
