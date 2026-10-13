import { TEntityId } from '@shared/types/uuid';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import { ICounterpartyHistory } from '@domain/counterparty/types/counterparty-audit.types';
import { ICounterparty } from '@domain/counterparty/types/counterparty.types';

import { ICounterpartyFindOrCreateRes } from '@app/counterparty/contracts/counterparty.service.contract';

interface INewCounterparties {
  records: [ICounterparty, ICounterpartyHistory][];
  events: IEvent<ICounterparty>[];
}

/**
 * Converts newly prepared counterparties into persistence records with
 * histories and a flat event collection. Existing counterparties are omitted.
 */
export default function getNewCounterpartiesHelper(
  counterparties: Map<string, ICounterpartyFindOrCreateRes>,
  actor: TEntityId,
  correlationId: string
): INewCounterparties {
  const records: INewCounterparties['records'] = [];
  const events: INewCounterparties['events'] = [];

  for (const foundOrCreatedCounterparty of counterparties.values()) {
    if (!foundOrCreatedCounterparty.new) {
      continue;
    }

    const [counterparty, counterpartyEvents, audit] =
      foundOrCreatedCounterparty.data;
    const history = historyValue.make(audit, actor, correlationId);

    records.push([counterparty, history]);
    events.push(...counterpartyEvents);
  }

  return { records, events };
}
