import bootstrapObservability from '@infra/runtime/bootstrap/observability.bootstrap';

async function startApplication(): Promise<void> {
  /*
   * These imports must remain dynamic. Static imports are evaluated before this
   * module's body runs, regardless of where their declarations appear in the
   * file. Making the application imports static would therefore load Express,
   * PostgreSQL, Redis, and the messaging libraries before
   * bootstrapObservability() initializes Sentry, preventing Sentry from
   * installing its automatic instrumentation for those libraries.
   *
   * startApplication() is invoked only after bootstrapObservability() below.
   * This dynamic-import boundary preserves _http/index.ts as the established
   * process entrypoint while guaranteeing that observability initializes before
   * the rest of the application dependency graph is loaded.
   */
  const [
    { default: registerWorkers },
    { default: setupServer },
    { bootstrapAccountingContext },
    { default: eventsRegistry },
    { default: bootstrapFeatureFlags },
    { default: bootstrapCurrencies },
  ] = await Promise.all([
    import('@infra/messaging/workers'),
    import('@infra/server'),
    import('@infra/runtime/bootstrap/accounting-context.bootstrap'),
    import('@infra/runtime/bootstrap/events.bootstrap'),
    import('@infra/runtime/bootstrap/feature-flag.bootstrap'),
    import('@infra/runtime/bootstrap/currencies.bootstrap'),
  ]);

  async function bootstrapDependencies() {
    await bootstrapFeatureFlags();
    await bootstrapCurrencies();
    await bootstrapAccountingContext();
    registerWorkers();
    eventsRegistry();
  }

  setupServer(bootstrapDependencies);
}

bootstrapObservability();
void startApplication();
