import bootstrapObservability from '@infra/runtime/bootstrap/observability.bootstrap';

async function startApplication(): Promise<void> {
  // Load clients only after observability has installed instrumentation.
  const { default: runHttp } =
    await import('@infra/runtime/lifecycle/http-runtime.lifecycle');
  await runHttp();
}

bootstrapObservability();
void startApplication();
