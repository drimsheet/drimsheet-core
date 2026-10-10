import { EOutboxType } from '@shared/types/outbox.types';

import IOutboxRepo from '@app/outbox/contracts/outbox.repo.contract';
import IOutboxAppService from '@app/outbox/contracts/outbox.service.contract';

interface IDependencies {
  outboxRepo: IOutboxRepo;
}

export default function makeOutboxAppService(
  deps: IDependencies
): IOutboxAppService {
  return {
    async createBalancePropagation(journalEntryId, options) {
      const outbox = {
        id: journalEntryId,
        correlationId: options.correlationId,
        type: EOutboxType.BalancePropagation,
        data: null,
      };
      await deps.outboxRepo.create(outbox, options);
    },
  };
}
