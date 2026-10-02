import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { TEntityId } from '@shared/types/uuid';

import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import periodError from '@domain/accounting/errors/period.error';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { ICashAndCashEquivalentAccount } from '@domain/ledger/types/asset-account.types';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockJournalEntryPersistenceService from '@app/journal-entry/contracts/__mocks__/journal-entry-persistence.service.mock';
import { mockJournalEntryService } from '@app/journal-entry/contracts/__mocks__/journal-entry.domain.services.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import mockLedgerAccountBalanceAdjustmentQueue from '@app/ledger/contracts/__mocks__/ledger-balance-adjustment-queue.mock';
import { mockAssetAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { IPettyCashAccountCreationReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import makeCreatePettyCashAccountUseCase from '@app/ledger/usecases/create-petty-cash-account.usecase';
import mockOutboxService from '@app/outbox/contracts/__mocks__/outbox.service.mock';
import mockFxLotCostBasisService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-cost-basis-persistence.service.mock';
import mockFxLotAppService from '@app/subledger/fx-cost-basis/contracts/__mocks__/fx-lot.service.mock';
import { TFxLotAcquisitionAppResult } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

const [actor] = actorEntity.makeUser({
  email: 'actor@example.com',
  displayName: 'Actor',
});
const [accountingEntity] = accountingEntityEntity.make({
  name: 'Business',
  type: 'private_company',
  ownerId: actor.id,
  createdBy: actor.id,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
});
const parentId = 'c3333333-3333-4333-8333-333333333333' as TEntityId;
const date = new Date('2026-03-01T00:00:00Z');
const correlationId = 'bank-creation';
const options = { correlationId, tx: mockRepoTransaction.context };
const payload: IPettyCashAccountCreationReq = {
  name: 'Operating Bank',
  currencyCode: 'NGN',
  isControlAccount: false,
  openingBalance: null,
};
const openingPayload: IPettyCashAccountCreationReq = {
  ...payload,
  openingBalance: {
    amount: { amount: 10000, currencyCode: 'NGN', isMinorUnit: true },
    date,
    exchangeRate: null,
  },
};
const deps = {
  appContext: mockAppContext,
  eventBus: mockEventBus,
  cashAccountService: mockAssetAccountService,
  journalEntryService: mockJournalEntryService,
  journalEntryPersistenceService: mockJournalEntryPersistenceService,
  outboxService: mockOutboxService,
  ledgerBalanceAdjustmentQueue: mockLedgerAccountBalanceAdjustmentQueue,
  repoService: mockRepoService,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
  fxLotAppService: mockFxLotAppService,
  fxCostBasisPersistenceService: mockFxLotCostBasisService.persistence,
};
function makePettyCash(openingBalanceDate: Date | undefined = undefined) {
  return ledgerAccountEntity.make<ICashAndCashEquivalentAccount>({
    name: payload.name,
    code: '100042',
    materializedPath: '100000.100042',
    accountingEntityId: accountingEntity.id,
    createdBy: actor.id,
    type: 'asset',
    subType: 'cash_and_cash_equivalent',
    behavior: 'petty_cash',
    normalBalance: 'debit',
    isControlAccount: false,
    controlAccountId: parentId,
    currency: SYSTEM_CURRENCIES.NGN,
    status: 'active',
    contraAccountRule: 'contra_permitted',
    adjunctAccountRule: 'adjunct_permitted',
    meta: null,
    openingBalanceDate,
  });
}
let bank = makePettyCash();
function makeJournal(posted = true) {
  return journalEntryEntity.make({
    accountingEntityId: accountingEntity.id,
    sourceType: 'opening_balance',
    effectiveDate: date,
    postedAt: posted ? date : null,
    memo: 'Opening balance',
    createdBy: actor.id,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
    lines: [
      {
        accountId: bank[0].id,
        sequenceOrder: 1,
        amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        side: 'debit',
        description: 'Opening balance',
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
      {
        accountId: parentId,
        sequenceOrder: 2,
        amount: { amount: 10000n, currency: SYSTEM_CURRENCIES.NGN },
        exchangeRate: null,
        side: 'credit',
        description: null,
        functionalCurrency: SYSTEM_CURRENCIES.NGN,
      },
    ],
  });
}
let journal = makeJournal();

describe('petty cash account creation workflow', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockAppContext.get.mockReturnValue({
      actor,
      accountingEntity,
      correlationId,
    });
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    bank = makePettyCash();
    journal = makeJournal();
    mockAssetAccountService.createPettyCashSubAccount.mockImplementation(
      async (creation) => {
        bank = makePettyCash(creation.openingBalanceDate);
        return bank;
      }
    );
    mockJournalEntryService.createInitialOpeningBalance.mockImplementation(
      async () => {
        journal = makeJournal();
        return journal;
      }
    );
    mockFxLotAppService.acquire.mockResolvedValue(null);
  });
  it.each([false, true])(
    'persists a complete version 1 account and initial balance in one transaction (opening: %s)',
    async (withOpening) => {
      const response = await makeCreatePettyCashAccountUseCase(deps)(
        withOpening ? openingPayload : payload
      );
      expect(response).toMatchObject({
        id: bank[0].id,
        code: '100042',
        materializedPath: '100000.100042',
        openingBalanceDate: withOpening ? date : null,
      });
      const [account, , writeOptions] =
        mockLedgerAccountPersistenceService.create.mock.calls[0];
      expect(account).toBe(bank[0]);
      expect(account.version).toBe(1);
      expect(writeOptions.tx).toBe(options.tx);
      expect(writeOptions.history).toHaveLength(1);
      expect(writeOptions.history[0].diff).toMatchObject({
        before: null,
        after: JSON.parse(JSON.stringify(account)),
      });
      expect(mockRepoService.runInTransaction).not.toHaveBeenCalled();
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish.mock.calls[0][0]).toHaveLength(
        withOpening ? bank[1].length + journal[1].length : 1
      );
      if (withOpening) {
        expect(
          mockJournalEntryService.createInitialOpeningBalance
        ).toHaveBeenCalledWith(
          expect.objectContaining({ account, effectiveDate: date }),
          options
        );
        expect(mockJournalEntryPersistenceService.create).toHaveBeenCalledWith(
          journal[0],
          expect.objectContaining({
            diff: JSON.parse(JSON.stringify(journal[2].header.diff)),
          }),
          expect.any(Array),
          options
        );
        expect(mockOutboxService.createBalancePropagation).toHaveBeenCalledWith(
          journal[0].id,
          options
        );
        expect(mockEventBus.publish.mock.invocationCallOrder[0]).toBeLessThan(
          mockLedgerAccountBalanceAdjustmentQueue.add.mock
            .invocationCallOrder[0]
        );
        expect(
          mockLedgerAccountBalanceAdjustmentQueue.add
        ).toHaveBeenCalledWith({
          journalEntryId: journal[0].id,
          correlationId,
        });
      } else {
        expect(
          mockJournalEntryPersistenceService.create
        ).not.toHaveBeenCalled();
        expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
        expect(
          mockOutboxService.createBalancePropagation
        ).not.toHaveBeenCalled();
        expect(
          mockLedgerAccountBalanceAdjustmentQueue.add
        ).not.toHaveBeenCalled();
      }
    }
  );
  it('passes domain creation facts including optional ID and initial date', async () => {
    await makeCreatePettyCashAccountUseCase(deps)({
      ...openingPayload,
      controlAccountId: parentId,
    });
    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).toHaveBeenCalledWith(
      {
        name: payload.name,
        currency: SYSTEM_CURRENCIES.NGN,
        isControlAccount: false,
        createdBy: actor.id,
        accountingEntity,
        controlAccountId: parentId,
        openingBalanceDate: date,
      },
      options
    );
    expect(mockJournalEntryService.createOpeningBalance).not.toHaveBeenCalled();
  });
  it('retains draft journal behavior without propagation side effects', async () => {
    mockJournalEntryService.createInitialOpeningBalance.mockImplementation(
      async () => {
        journal = makeJournal(false);
        return journal;
      }
    );
    await makeCreatePettyCashAccountUseCase(deps)(openingPayload);
    expect(mockJournalEntryPersistenceService.create).toHaveBeenCalled();
    expect(mockFxLotAppService.acquire).toHaveBeenCalledWith(
      { journalEntry: journal[0], account: bank[0], actor: actor.id },
      options
    );
    expect(mockOutboxService.createBalancePropagation).not.toHaveBeenCalled();
    expect(mockLedgerAccountBalanceAdjustmentQueue.add).not.toHaveBeenCalled();
  });
  it('persists prepared FX records with the same transaction and publishes their events', async () => {
    const records = {
      lot: { id: parentId },
      acquisition: { id: parentId },
      lotHistory: { entityId: parentId },
      acquisitionHistory: { entityId: parentId },
      missingOfficialRateOutbox: null,
    } as unknown as TFxLotAcquisitionAppResult['records'];
    const events = [
      {
        type: 'fx_cost_basis_lot_created',
        data: { id: parentId },
        occurredAt: date,
        enrichedAt: null,
      },
    ];
    mockFxLotAppService.acquire.mockResolvedValue({ records, events });
    await makeCreatePettyCashAccountUseCase(deps)(openingPayload);
    expect(
      mockFxLotCostBasisService.persistence.persistAcquisition
    ).toHaveBeenCalledWith(records, options);
    expect(mockEventBus.publish.mock.calls[0][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: events[0].type }),
      ])
    );
  });
  it('validates malformed requests before acquiring a transaction', async () => {
    await expect(
      makeCreatePettyCashAccountUseCase(deps)({ ...payload, name: '' })
    ).rejects.toThrow();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
  it('rejects invalid exchange-rate requirements before acquiring a transaction', async () => {
    await expect(
      makeCreatePettyCashAccountUseCase(deps)({
        ...openingPayload,
        currencyCode: 'USD',
        openingBalance: {
          ...openingPayload.openingBalance!,
          amount: { amount: 100, currencyCode: 'USD', isMinorUnit: true },
          exchangeRate: null,
        },
      })
    ).rejects.toThrow();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
  it('rejects unknown currency before acquiring a transaction', async () => {
    await expect(
      makeCreatePettyCashAccountUseCase(deps)({
        ...payload,
        currencyCode: 'ZZZ',
      })
    ).rejects.toThrow();
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
  it('propagates transaction acquisition failure without using a context', async () => {
    const failure = new Error('connection unavailable');
    mockRepoService.createTransaction.mockRejectedValueOnce(failure);
    await expect(makeCreatePettyCashAccountUseCase(deps)(payload)).rejects.toBe(
      failure
    );
    expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    expect(
      mockAssetAccountService.createPettyCashSubAccount
    ).not.toHaveBeenCalled();
  });
  it.each([
    'period',
    'account',
    'journal',
    'fx',
    'ledger-write',
    'journal-write',
    'fx-write',
    'outbox',
    'commit',
  ] as const)(
    'cleans up and suppresses side effects after %s failure',
    async (stage) => {
      const failure =
        stage === 'period'
          ? new periodError.PostingPeriodNotOpen()
          : new Error(stage);
      const mocks = {
        period: mockJournalEntryService.createInitialOpeningBalance,
        account: mockAssetAccountService.createPettyCashSubAccount,
        journal: mockJournalEntryService.createInitialOpeningBalance,
        fx: mockFxLotAppService.acquire,
        'ledger-write': mockLedgerAccountPersistenceService.create,
        'journal-write': mockJournalEntryPersistenceService.create,
        'fx-write': mockFxLotCostBasisService.persistence.persistAcquisition,
        outbox: mockOutboxService.createBalancePropagation,
        commit: mockRepoTransaction.commit,
      };
      if (stage === 'fx-write')
        mockFxLotAppService.acquire.mockResolvedValue({
          records: {} as TFxLotAcquisitionAppResult['records'],
          events: [],
        });
      mocks[stage].mockRejectedValueOnce(failure);
      await expect(
        makeCreatePettyCashAccountUseCase(deps)(openingPayload)
      ).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
    }
  );
  it.each(['ledger-write', 'commit', 'publication'] as const)(
    'cleans up the early-return path after %s failure',
    async (stage) => {
      const failure = new Error(stage);
      const stages = {
        'ledger-write': mockLedgerAccountPersistenceService.create,
        commit: mockRepoTransaction.commit,
        publication: mockEventBus.publish,
      };
      stages[stage].mockRejectedValueOnce(failure);

      await expect(
        makeCreatePettyCashAccountUseCase(deps)(payload)
      ).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(
        mockJournalEntryService.createInitialOpeningBalance
      ).not.toHaveBeenCalled();
      expect(mockFxLotAppService.acquire).not.toHaveBeenCalled();
      expect(
        mockLedgerAccountBalanceAdjustmentQueue.add
      ).not.toHaveBeenCalled();
      if (stage === 'publication') {
        expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      } else {
        expect(mockEventBus.publish).not.toHaveBeenCalled();
      }
    }
  );
  it('waits for successful commit before publishing', async () => {
    let release!: () => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    mockRepoTransaction.commit.mockImplementation(async () => {
      started();
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });
    const creation = makeCreatePettyCashAccountUseCase(deps)(payload);
    await ready;
    expect(mockLedgerAccountPersistenceService.create).toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
    release();
    await creation;
    expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
  });
  it.each(['queue', 'publication'] as const)(
    'retains the commit when post-commit %s fails',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'queue')
        mockLedgerAccountBalanceAdjustmentQueue.add.mockRejectedValueOnce(
          failure
        );
      else mockEventBus.publish.mockRejectedValueOnce(failure);
      await expect(
        makeCreatePettyCashAccountUseCase(deps)(openingPayload)
      ).rejects.toBe(failure);
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    }
  );
});
