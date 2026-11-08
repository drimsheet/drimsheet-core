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
import { mockPaymentEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { IUpdateDraftPaymentReq } from '@app/journal-entry/dtos/payment-entry/payment-entry.dto';
import makeUpdateDraftPaymentUsecase from '@app/journal-entry/usecases/update-draft-payment.usecase';
import { mockLedgerAccountRepo } from '@app/ledger/contracts/__mocks__/ledger.repos.mock';

describe('update draft payment use case', () => {
  const actorId = generateUUID();
  const accountingEntityId = generateUUID();
  const effectiveDate = new Date('2026-08-03T10:00:00.000Z');
  const repoOptions = {
    correlationId: 'update-draft-payment',
    idempotencyKey: 'update-draft-payment-request',
  };
  const [counterparty] = counterpartyEntity.make({
    accountingEntityId,
    createdBy: actorId,
    name: 'Vendor',
    type: 'organization',
  });
  const sourceAccount = { id: generateUUID() };
  const destinationAccount = { id: generateUUID() };
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
    sourceType: 'payment',
    effectiveDate,
    postedAt: null,
    memo: null,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    lines: [
      {
        accountId: sourceAccount.id,
        counterpartyId: counterparty.id,
        sequenceOrder: 1,
        side: EJournalSide.Credit,
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.USD, true),
        exchangeRate: exchangeRateValue.make(exchangeRate),
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      ...[2, 3].map((sequenceOrder) => ({
        accountId: destinationAccount.id,
        counterpartyId: counterparty.id,
        sequenceOrder,
        side: EJournalSide.Debit,
        amount: moneyValue.make(100n, SYSTEM_CURRENCIES.NGN, true),
        exchangeRate: null,
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      })),
    ],
  });
  const [source, retained, removed] = entry.lines;
  const request = {
    memo: 'Revised payment',
    sourceLine: {
      id: source.id,
      accountId: source.accountId,
      counterpartyId: counterparty.id,
      sequenceOrder: 1,
      amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
      exchangeRate,
      description: 'Bank payment',
    },
    destinationLines: [2, 3].map((sequenceOrder) => ({
      id: sequenceOrder === 2 ? retained.id : undefined,
      accountId: destinationAccount.id,
      counterpartyId: counterparty.id,
      sequenceOrder,
      amount: { amount: 100, currencyCode: 'NGN', isMinorUnit: true },
      exchangeRate: null,
      description: null,
    })),
  } satisfies IUpdateDraftPaymentReq;
  const mutation = journalEntryEntity.update(
    entry,
    {
      id: entry.id,
      memo: request.memo,
      lines: [
        { ...source, description: request.sourceLine.description },
        retained,
        { ...removed, id: generateUUID() },
      ],
    },
    actorId
  );
  const usecase = makeUpdateDraftPaymentUsecase({
    appContext: mockAppContext,
    counterpartyRepo: mockCounterpartyRepo,
    eventBus: mockEventBus,
    journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
    journalEntryRepo: mockJournalEntryRepo,
    ledgerAccountRepo: mockLedgerAccountRepo,
    paymentEntryService: mockPaymentEntryService,
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
    ] as Awaited<ReturnType<typeof mockLedgerAccountRepo.findAllByIds>>);
    mockCounterpartyRepo.findByIds.mockResolvedValue([counterparty]);
    mockPaymentEntryService.updateDraft.mockReturnValue(mutation);
  });

  it('passes resolved payment data to the domain and persists its audited edit', async () => {
    const [updated, events] = mutation;
    const updatedDraft = await usecase(entry.id, request);
    expect(updatedDraft).toMatchObject({
      id: entry.id,
      status: 'draft',
      memo: request.memo,
    });
    expect(updatedDraft).not.toHaveProperty('effectiveDate');

    expect(mockLedgerAccountRepo.findAllByIds).toHaveBeenCalledWith(
      [sourceAccount.id, destinationAccount.id],
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
    expect(mockPaymentEntryService.updateDraft).toHaveBeenCalledWith({
      entry,
      actor: actorId,
      memo: request.memo,
      accounts: [sourceAccount, destinationAccount],
      counterparties: [counterparty],
      sourceLine: expect.objectContaining({
        id: source.id,
        accountId: sourceAccount.id,
        counterpartyId: counterparty.id,
        amount: source.amount,
        exchangeRate: expect.objectContaining(exchangeRate),
      }),
      destinationLines: [
        expect.objectContaining({ id: retained.id }),
        expect.objectContaining({ id: undefined }),
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
          expect.objectContaining({ entityId: source.id, action: 'updated' }),
          expect.objectContaining({
            entityId: updated.lines[2].id,
            action: 'created',
          }),
        ],
        linesToCreate: [updated.lines[2]],
        linesToUpdate: [updated.lines[0]],
        lineIdsToDelete: [removed.id],
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
    mockPaymentEntryService.updateDraft.mockReturnValue([entry, [], null]);

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
    expect(mockPaymentEntryService.updateDraft).not.toHaveBeenCalled();
  });

  it('stops before fetching counterparties when the account read fails', async () => {
    const error = new repoError.TransactionInactive();
    mockLedgerAccountRepo.findAllByIds.mockRejectedValue(error);
    await expect(usecase(entry.id, request)).rejects.toBe(error);
    expect(mockCounterpartyRepo.findByIds).not.toHaveBeenCalled();
    expect(mockPaymentEntryService.updateDraft).not.toHaveBeenCalled();
  });

  it('passes only the requested source fields and retains omitted destinations', async () => {
    await usecase(entry.id, { sourceLine: { description: 'Updated note' } });

    expect(mockPaymentEntryService.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceLine: expect.objectContaining({ description: 'Updated note' }),
        destinationLines: undefined,
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
