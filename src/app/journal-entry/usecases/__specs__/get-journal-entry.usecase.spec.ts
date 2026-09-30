import { TEntityId } from '@shared/types/uuid';

import { EAccountingEntityType } from '@domain/accounting/types/accounting-entity.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/contracts/app-context.contract';
import mockJournalEntryQueryRepo from '@app/journal-entry/contracts/__mocks__/journal-entry.query.repo.mock';
import { IJournalEntryDetails } from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import journalEntryDtoMapper from '@app/journal-entry/dtos/journal-entry/journal-entry.dto.mapper';
import makeGetJournalEntryUsecase from '@app/journal-entry/usecases/get-journal-entry.usecase';

describe('makeGetJournalEntryUsecase', () => {
  const accountingEntityId =
    '123e4567-e89b-12d3-a456-426614174001' as TEntityId;
  const userId = '123e4567-e89b-12d3-a456-426614174002' as TEntityId;
  const accountId = '123e4567-e89b-12d3-a456-426614174003' as TEntityId;
  const otherAccountId = '123e4567-e89b-12d3-a456-426614174004' as TEntityId;
  const counterpartyId = '123e4567-e89b-12d3-a456-426614174005' as TEntityId;
  const correlationId = 'test-correlation-id';
  const amount = moneyValue.make(25_00, SYSTEM_CURRENCIES.NGN, true);
  const [journalEntry] = journalEntryEntity.make({
    accountingEntityId,
    sourceType: EJournalEntrySourceType.Receipt,
    effectiveDate: new Date('2026-09-01T00:00:00.000Z'),
    postedAt: null,
    memo: 'Customer receipt',
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    createdBy: userId,
    lines: [
      {
        accountId,
        sequenceOrder: 1,
        amount,
        exchangeRate: null,
        side: EJournalSide.Debit,
        description: 'Cash received',
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      {
        accountId: otherAccountId,
        sequenceOrder: 2,
        amount,
        exchangeRate: null,
        side: EJournalSide.Credit,
        description: 'Receipt income',
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
    ],
  });
  const journalEntryDetails: IJournalEntryDetails = {
    ...journalEntry,
    lines: [
      {
        ...journalEntry.lines[0],
        counterpartyId,
        account: { id: accountId, name: 'Cash' },
        counterparty: {
          status: 'active' as const,
          id: counterpartyId,
          name: 'Acme Ltd',
        },
      },
      {
        ...journalEntry.lines[1],
        account: { id: otherAccountId, name: 'Sales' },
        counterparty: null,
      },
    ],
  };

  const getJournalEntry = makeGetJournalEntryUsecase({
    appContext: mockAppContext,
    journalEntryQueryRepo: mockJournalEntryQueryRepo,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppContext.get.mockReturnValue({
      correlationId,
      accountingEntity: {
        createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
        id: accountingEntityId,
        ownerId: userId,
        name: 'Test Business',
        type: EAccountingEntityType.Individual,
        functionalCurrencyCode: SYSTEM_CURRENCIES.NGN.code,
        jurisdictionCode: 'NG',
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        updatedAt: new Date('2026-09-01T00:00:00.000Z'),
      },
    } as IAppContextData);
    mockJournalEntryQueryRepo.findById.mockResolvedValue(journalEntryDetails);
  });

  it('returns the mapped journal entry from the active accounting entity', async () => {
    const result = await getJournalEntry(journalEntry.id);

    expect(mockJournalEntryQueryRepo.findById).toHaveBeenCalledWith(
      journalEntry.id,
      accountingEntityId,
      { correlationId }
    );
    expect(result).toEqual(
      journalEntryDtoMapper.toListDto(journalEntryDetails)
    );
  });

  it('rejects an invalid id before reading context', async () => {
    await expect(getJournalEntry('invalid-id')).rejects.toBeInstanceOf(
      journalEntryError.InvalidJournalEntry
    );

    expect(mockAppContext.get).not.toHaveBeenCalled();
    expect(mockJournalEntryQueryRepo.findById).not.toHaveBeenCalled();
  });

  it('returns resource not found when no scoped journal entry exists', async () => {
    mockJournalEntryQueryRepo.findById.mockResolvedValue(null);

    await expect(getJournalEntry(journalEntry.id)).rejects.toThrow(
      'app_error_resource_not_found'
    );
  });

  it('propagates repository failures', async () => {
    const repositoryFailure = new Error('repository failure');
    mockJournalEntryQueryRepo.findById.mockRejectedValue(repositoryFailure);

    await expect(getJournalEntry(journalEntry.id)).rejects.toBe(
      repositoryFailure
    );
  });
});
