import makeCounterpartyService from '@domain/counterparty/services/counterparty.service';

import journalRepos from '@infra/persistence/repos/journal-entry';

export const counterpartyService = makeCounterpartyService({
  journalLineRepo: journalRepos.journalLine,
});
