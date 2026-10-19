import bootstrapObservability from '@infra/runtime/bootstrap/observability.bootstrap';

async function startExchangeRateIngestion(): Promise<void> {
  const { default: exchangeRateIngestionRuntime } =
    await import('@infra/runtime/_ingestion/exchange-rate/exchange-rate-ingestion.runtime');

  process.exitCode = await exchangeRateIngestionRuntime.run();
}

bootstrapObservability();
void startExchangeRateIngestion();
