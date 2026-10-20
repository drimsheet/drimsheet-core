import { TEntityId } from '@shared/types/uuid';

import { ILedgerAccountBalanceAdjustmentDto } from '@app/ledger/dtos/ledger-account-balance-adjustment/ledger-account-balance-adjustment.dto';
import makeLedgerAccountBalanceAdjustmentWorker from '@app/ledger/workers/ledger-account-balance-adjustment.worker';

describe('makeLedgerAccountBalanceAdjustmentWorker', () => {
  const payload: ILedgerAccountBalanceAdjustmentDto = {
    journalEntryId: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
  };

  it('adjusts the ledger account balance', async () => {
    const usecase = jest.fn().mockResolvedValue(undefined);
    const worker = makeLedgerAccountBalanceAdjustmentWorker({
      usecase,
    });

    await worker(payload);

    expect(usecase).toHaveBeenCalledWith(payload);
  });

  it('propagates adjustment failures', async () => {
    const adjustmentError = new Error('adjustment failed');
    const usecase = jest.fn().mockRejectedValue(adjustmentError);
    const worker = makeLedgerAccountBalanceAdjustmentWorker({
      usecase,
    });

    await expect(worker(payload)).rejects.toBe(adjustmentError);
  });
});
