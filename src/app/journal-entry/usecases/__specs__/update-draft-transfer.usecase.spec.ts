import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';
import appError from '@shared/values/errors/app.error';
import repoError from '@shared/values/errors/repo.error';

import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockTransferEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { IUpdateDraftTransferReq } from '@app/journal-entry/dtos/transfer-entry/transfer-entry.dto';
import makeUpdateDraftTransferUsecase from '@app/journal-entry/usecases/update-draft-transfer.usecase';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

describe('update draft transfer use case', () => {
  const actorId = generateUUID();
  const accountingEntityId = generateUUID();
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions = {
    correlationId: 'update-draft-transfer',
    idempotencyKey: 'update-draft-transfer-request',
  };
  const [counterparty] = counterpartyEntity.make({
    accountingEntityId,
    createdBy: actorId,
    name: 'Transfer provider',
    type: 'organization',
  });
  const sourceAccount = { id: generateUUID() };
  const destinationAccount = { id: generateUUID() };
  const chargeAccount = { id: generateUUID() };
  const exchangeRate = {
    baseCurrencyCode: 'USD',
    targetCurrencyCode: 'NGN',
    rate: 2,
    type: 'negotiated' as const,
    asOf: effectiveDate,
    source: 'Bank',
  };
  const [entry] = journalEntryEntity.make({
    accountingEntityId,
    createdBy: actorId,
    sourceType: 'transfer',
    effectiveDate,
    postedAt: null,
    memo: null,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    lines: [
      {
        accountId: sourceAccount.id,
        counterpartyId: null,
        sequenceOrder: 1,
        side: EJournalSide.Credit,
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
        exchangeRate: exchangeRateValue.make(exchangeRate),
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      {
        accountId: destinationAccount.id,
        counterpartyId: null,
        sequenceOrder: 2,
        side: EJournalSide.Debit,
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      ...[3, 4].map((sequenceOrder) => ({
        accountId: chargeAccount.id,
        counterpartyId: counterparty.id,
        sequenceOrder,
        side: EJournalSide.Debit,
        amount: moneyValue.make(50n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      })),
    ],
  });
  const [source, destination, retainedCharge, removedCharge] = entry.lines;
  const request = {
    memo: 'Revised transfer',
    sourceLine: {
      id: source.id,
      accountId: source.accountId,
      amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
      exchangeRate,
      description: 'Bank withdrawal',
    },
    chargeLines: [
      { id: retainedCharge.id },
      {
        accountId: chargeAccount.id,
        counterpartyId: counterparty.id,
        sequenceOrder: 4,
        amount: { amount: 50, currencyCode: 'NGN', isMinorUnit: true },
      },
    ],
  } satisfies IUpdateDraftTransferReq;
  const mutation = journalEntryEntity.update(
    entry,
    {
      id: entry.id,
      memo: request.memo,
      lines: [
        { ...source, description: request.sourceLine.description },
        destination,
        retainedCharge,
        { ...removedCharge, id: generateUUID() },
      ],
    },
    actorId
  );
  const usecase = makeUpdateDraftTransferUsecase({
    appContext: mockAppContext,
    counterpartyRepo: mockCounterpartyRepo,
    eventBus: mockEventBus,
    journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
    journalEntryRepo: mockJournalEntryRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    transferEntryService: mockTransferEntryService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      accountingEntity: {
        id: accountingEntityId,
        functionalCurrencyCode: 'NGN',
      },
      ...repoOptions,
    } as IAppContextData);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
    mockLedgerAccountRepo.findAllByIds.mockResolvedValue([
      sourceAccount,
      destinationAccount,
      chargeAccount,
    ] as Awaited<ReturnType<typeof mockLedgerAccountRepo.findAllByIds>>);
    mockCounterpartyRepo.findByIds.mockResolvedValue([counterparty]);
    mockTransferEntryService.updateDraft.mockReturnValue(mutation);
  });

  it('passes resolved transfer data to the domain and persists its audited edit', async () => {
    const [updated, events] = mutation;
    const updatedDraft = await usecase(entry.id, request);
    expect(updatedDraft).toMatchObject({
      id: entry.id,
      status: 'draft',
      memo: request.memo,
    });
    expect(updatedDraft).not.toHaveProperty('effectiveDate');

    expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      [sourceAccount.id, destinationAccount.id, chargeAccount.id],
      accountingEntityId,
      repoOptions
    );
    expect(mockCounterpartyRepo.findByIds).toHaveBeenCalledWith(
      [counterparty.id],
      accountingEntityId,
      repoOptions
    );
    expect(
      mockLedgerAccountRepo.findAllByIds.mock.invocationCallOrder[0]
    ).toBeLessThan(mockCounterpartyRepo.findByIds.mock.invocationCallOrder[0]);
    expect(mockTransferEntryService.updateDraft).toHaveBeenCalledWith({
      entry,
      actor: actorId,
      memo: request.memo,
      accounts: [sourceAccount, destinationAccount, chargeAccount],
      counterparties: [counterparty],
      sourceLine: expect.objectContaining({
        id: source.id,
        accountId: sourceAccount.id,
        amount: source.amount,
        exchangeRate: expect.objectContaining(exchangeRate),
      }),
      destinationLine: undefined,
      chargeLines: [
        expect.objectContaining({ id: retainedCharge.id }),
        expect.objectContaining({
          id: undefined,
          counterpartyId: counterparty.id,
        }),
      ],
    });
    expect(mockJournalEntryPersistenceAppService.update).toHaveBeenCalledWith(
      {
        entry: updated,
        expectedVersion: entry.version,
        headerHistory: expect.objectContaining({
          actorId,
          action: 'updated',
        }),
        lineHistories: [
          expect.objectContaining({
            entityId: source.id,
            action: 'updated',
          }),
          expect.objectContaining({
            entityId: updated.lines[3].id,
            action: 'created',
          }),
        ],
        linesToCreate: [updated.lines[3]],
        linesToUpdate: [updated.lines[0]],
        lineIdsToDelete: [removedCharge.id],
      },
      repoOptions
    );
    expect(
      mockJournalEntryPersistenceAppService.rectify
    ).not.toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      events.map((event) =>
        expect.objectContaining({
          type: event.type,
          data: event.data,
          ...repoOptions,
        })
      )
    );
  });

  it('returns an unchanged draft without persisting or publishing', async () => {
    mockTransferEntryService.updateDraft.mockReturnValue([entry, [], null]);

    await expect(usecase(entry.id, {})).resolves.toMatchObject({
      id: entry.id,
      memo: entry.memo,
    });

    expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('rejects malformed IDs and dates before reading the journal', async () => {
    await expect(usecase('invalid', request)).rejects.toThrow(
      journalEntryError.InvalidJournalEntry
    );
    for (const field of ['effectiveDate', 'postedAt']) {
      const invalidRequest = { ...request, [field]: effectiveDate };
      await expect(usecase(entry.id, invalidRequest)).rejects.toThrow(
        appError.UnprocessableEntity
      );
    }
    expect(mockJournalEntryRepo.findById).not.toHaveBeenCalled();
  });

  it('rejects an entry belonging to another accounting entity', async () => {
    mockJournalEntryRepo.findById.mockResolvedValue({
      ...entry,
      accountingEntityId: generateUUID(),
    });
    await expect(usecase(entry.id, request)).rejects.toThrow(
      appError.ResourceNotFound
    );
    expect(mockLedgerAccountRepo.findAllByIds).not.toHaveBeenCalled();
    expect(mockTransferEntryService.updateDraft).not.toHaveBeenCalled();
  });

  it('stops before fetching counterparties when the account read fails', async () => {
    const error = new repoError.TransactionInactive();
    mockLedgerAccountRepo.findAllByIds.mockRejectedValue(error);
    await expect(usecase(entry.id, request)).rejects.toBe(error);
    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockTransferEntryService.updateDraft).not.toHaveBeenCalled();
  });

  it('passes only the requested destination fields and retains omitted charges', async () => {
    await usecase(entry.id, {
      destinationLine: { description: 'Updated note' },
    });

    expect(mockTransferEntryService.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        destinationLine: expect.objectContaining({
          description: 'Updated note',
        }),
        sourceLine: undefined,
        chargeLines: undefined,
        memo: undefined,
      })
    );
  });

  it('propagates a version conflict without publishing the draft events', async () => {
    const error = new repoError.VersionNotFound();
    mockJournalEntryPersistenceAppService.update.mockRejectedValue(error);

    await expect(usecase(entry.id, request)).rejects.toBe(error);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
