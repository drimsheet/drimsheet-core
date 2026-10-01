import { ERepoLock, IReadRepoOptions } from '@shared/types/repo.types';
import generateUUID from '@shared/utils/uuid-generator';

import counterpartyServiceValidation from '@domain/counterparty/services/validations/counterparty.validation';
import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import IJournalLineRepo from '@domain/journal-entry/repos/journal-line.repo';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

describe('counterparty service validation', () => {
  const counterpartyId = generateUUID();
  const accountingEntityId = generateUUID();
  const options = Object.freeze<IReadRepoOptions>({
    correlationId: 'counterparty-validation',
    tx: { _brand: 'DrimsheetTransactionContext' },
    lock: ERepoLock.Share,
  });
  const journalLineRepo: jest.Mocked<IJournalLineRepo> = {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findAllByAccountId: jest.fn(),
    findAllByCounterpartyId: jest.fn(),
  };

  beforeEach(() => jest.resetAllMocks());

  it('exports a frozen validation object', () => {
    expect(Object.isFrozen(counterpartyServiceValidation)).toBe(true);
  });

  it('returns no value for unused counterparties and preserves scoped read options', async () => {
    journalLineRepo.findAllByCounterpartyId.mockResolvedValue([]);

    await expect(
      counterpartyServiceValidation.validateTypeChangeAllowed(
        journalLineRepo,
        counterpartyId,
        accountingEntityId,
        options
      )
    ).resolves.toBeUndefined();

    expect(journalLineRepo.findAllByCounterpartyId).toHaveBeenCalledWith(
      counterpartyId,
      accountingEntityId,
      options
    );
    expect(journalLineRepo.findAllByCounterpartyId.mock.calls[0][2].tx).toBe(
      options.tx
    );
  });

  it('rejects transaction usage with type and replacement guidance', async () => {
    const [line] = journalLineEntity.make(
      {
        id: generateUUID(),
        createdBy: generateUUID(),
        memo: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        accountId: generateUUID(),
        counterpartyId,
        sequenceOrder: 1,
        amount: moneyValue.make(1000, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        side: 'debit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      }
    );
    journalLineRepo.findAllByCounterpartyId.mockResolvedValue([line]);

    await expect(
      counterpartyServiceValidation.validateTypeChangeAllowed(
        journalLineRepo,
        counterpartyId,
        accountingEntityId,
        options
      )
    ).rejects.toMatchObject({
      errorKey: 'counterparty_error_type_change_after_transaction_use_conflict',
      cause: {
        field: 'type',
        reason: 'transaction_usage',
        nextAction: 'create_counterparty',
      },
    });
  });

  it('propagates lookup failure rather than treating it as no usage', async () => {
    const failure = new Error('usage lookup failed');
    journalLineRepo.findAllByCounterpartyId.mockRejectedValue(failure);

    await expect(
      counterpartyServiceValidation.validateTypeChangeAllowed(
        journalLineRepo,
        counterpartyId,
        accountingEntityId,
        options
      )
    ).rejects.toBe(failure);
  });
});
