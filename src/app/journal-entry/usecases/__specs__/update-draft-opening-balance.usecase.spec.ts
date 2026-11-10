import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import generateUUID from '@shared/utils/uuid-generator';

import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import { EJournalSide } from '@domain/journal-entry/types/journal-line.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import { EExchangeRateType } from '@domain/money/types/exchange-rate.types';
import exchangeRateValue from '@domain/money/values/exchange-rate.vo';
import moneyValue from '@domain/money/values/money.vo';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import { IAppContextData } from '@app/context/types/app-context.types';
import mockFileManagementAppService from '@app/file/contracts/__mocks__/file-management.service.mock';
import { EFileUploadPurpose } from '@app/file/types/file.types';
import mockJournalEntryPersistenceAppService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockOpeningBalanceEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import { mockJournalEntryRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import makeUpdateDraftOpeningBalanceUsecase from '@app/journal-entry/usecases/update-draft-opening-balance.usecase';

describe('update draft opening balance use case', () => {
  const actorId = generateUUID();
  const userId = generateUUID();
  const accountingEntityId = generateUUID();
  const repoOptions = {
    correlationId: 'update-draft-opening-balance',
    idempotencyKey: 'update-draft-opening-balance-request',
  };
  const currency = SYSTEM_CURRENCIES.NGN;
  const [entry] = journalEntryEntity.make({
    accountingEntityId,
    createdBy: actorId,
    sourceType: 'opening_balance',
    effectiveDate: new Date('2026-08-03T10:00:00.000Z'),
    postedAt: null,
    memo: null,
    functionalCurrency: currency,
    lines: [EJournalSide.Debit, EJournalSide.Credit].map((side, index) => ({
      accountId: generateUUID(),
      counterpartyId: null,
      sequenceOrder: index + 1,
      side,
      amount: moneyValue.make(100n, currency, true),
      exchangeRate: null,
      description: null,
      functionalCurrency: currency,
    })),
  });
  const usecase = makeUpdateDraftOpeningBalanceUsecase({
    appContext: mockAppContext,
    eventBus: mockEventBus,
    fileManagementAppService: mockFileManagementAppService,
    journalEntryPersistenceAppService: mockJournalEntryPersistenceAppService,
    journalEntryRepo: mockJournalEntryRepo,
    openingBalanceEntryService: mockOpeningBalanceEntryService,
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor: { id: actorId },
      user: { id: userId },
      accountingEntity: { id: accountingEntityId },
      ...repoOptions,
    } as IAppContextData);
    mockJournalEntryRepo.findById.mockResolvedValue(entry);
  });

  it('resolves attachments and persists the audited draft with its proposed date', async () => {
    const reference = generateUUID();
    const attachments = [
      {
        url: 'https://files.example.com/opening-balance.pdf',
        name: 'opening-balance.pdf',
        type: 'application/pdf',
        size: 1024,
      },
    ];
    const effectiveDate = new Date('2099-08-03T10:00:00.000Z');
    const amount = moneyValue.make(200n, SYSTEM_CURRENCIES.USD, true);
    const exchangeRateDto = {
      baseCurrencyCode: 'USD',
      targetCurrencyCode: 'NGN',
      rate: 2,
      type: EExchangeRateType.Negotiated,
      asOf: entry.effectiveDate,
      source: 'Bank quote',
    };
    const exchangeRate = exchangeRateValue.make(exchangeRateDto);
    const [openingLine, offsetLine] = entry.lines;
    const lines = [
      { ...openingLine, amount, exchangeRate },
      {
        ...offsetLine,
        amount: moneyValue.convert(amount, exchangeRate, currency),
      },
    ];
    const mutation = journalEntryEntity.update(
      entry,
      { id: entry.id, effectiveDate, attachments, lines },
      actorId
    );
    mockFileManagementAppService.claimUploads.mockResolvedValue(attachments);
    mockOpeningBalanceEntryService.updateDraft.mockResolvedValue(mutation);

    await expect(
      usecase(entry.id, {
        effectiveDate,
        attachments: { add: [reference] },
        amount: { amount: 200, currencyCode: 'USD', isMinorUnit: true },
        exchangeRate: exchangeRateDto,
      })
    ).resolves.toMatchObject({ effectiveDate, attachments, status: 'draft' });

    expect(mockFileManagementAppService.claimUploads).toHaveBeenCalledWith({
      userId,
      purpose: EFileUploadPurpose.JournalEntryAttachment,
      references: [reference],
    });
    expect(mockOpeningBalanceEntryService.updateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        entry,
        createdBy: actorId,
        effectiveDate,
        amount,
        exchangeRate: expect.objectContaining(exchangeRateDto),
        attachments,
      }),
      repoOptions
    );
    expect(mockJournalEntryPersistenceAppService.update).toHaveBeenCalledWith(
      expect.objectContaining({
        entry: mutation[0],
        expectedVersion: entry.version,
        headerHistory: expect.objectContaining({ actorId, action: 'updated' }),
        linesToUpdate: mutation[0].lines,
        lineHistories: mutation[0].lines.map((line) =>
          expect.objectContaining({
            entityId: line.id,
            actorId,
            action: 'updated',
          })
        ),
      }),
      repoOptions
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      mutation[1].map((event) =>
        expect.objectContaining({
          type: event.type,
          data: event.data,
          ...repoOptions,
        })
      )
    );
  });

  it('returns the unchanged draft without persisting or publishing', async () => {
    mockOpeningBalanceEntryService.updateDraft.mockResolvedValue([
      entry,
      [],
      null,
    ]);

    await expect(usecase(entry.id, {})).resolves.toMatchObject({
      id: entry.id,
    });

    expect(mockFileManagementAppService.claimUploads).not.toHaveBeenCalled();
    expect(mockJournalEntryPersistenceAppService.update).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
