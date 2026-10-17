import generateUUID from '@shared/utils/uuid-generator';

import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';

import { actorService } from '@infra/ioc/services/user';
import observability from '@infra/observability';
import currencyRepos from '@infra/persistence/repos/money';

export default async function bootstrapCurrencies() {
  const correlationId = `bootstrap-currencies-${generateUUID()}`;
  observability.logger.info('runtime.currency_bootstrap.started', {
    bootstrapCorrelationId: correlationId,
  });

  const actor = await actorService.resolveByUsername('drimsheet-core', {
    correlationId: 'currency-bootstrap',
  });
  for (const currency of Object.values(SYSTEM_CURRENCIES)) {
    await currencyRepos.currency.create(currency, actor.id, {
      correlationId,
    });
  }

  observability.logger.info('runtime.currency_bootstrap.completed', {
    bootstrapCorrelationId: correlationId,
    outcome: 'success',
  });
}
