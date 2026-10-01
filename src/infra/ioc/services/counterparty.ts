import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';

import makeCounterpartyAppService from '@app/counterparty/services/counterparty.service';

import counterpartyRepos from '@infra/persistence/repos/counterparty';
import journalRepos from '@infra/persistence/repos/journal-entry';

export const counterpartyService = makeCounterpartyService({
  journalLineRepo: journalRepos.journalLine,
});

export const counterpartyAppService = makeCounterpartyAppService({
  counterpartyRepo: counterpartyRepos.counterparty,
  counterpartyService,
});
