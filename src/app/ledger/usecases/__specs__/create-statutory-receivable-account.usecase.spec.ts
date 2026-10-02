import mockEventBus from '@shared/contracts/__mocks__/event-bus.mock';
import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import { ITransactionContext } from '@shared/types/repo.types';
import { TEntityId } from '@shared/types/uuid';
import appError from '@shared/values/errors/app.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import ledgerAccountEntity from '@domain/ledger/entities/ledger-account.entity';
import { ILedgerAccount } from '@domain/ledger/types/ledger.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import actorEntity from '@domain/user/entities/actor.entity';

import mockAppContext from '@app/context/contracts/__mocks__/app-context.mock';
import mockLedgerAccountPersistenceService from '@app/ledger/contracts/__mocks__/ledger-account-persistence.service.mock';
import { mockReceivablesAccountService } from '@app/ledger/contracts/__mocks__/ledger.domain.services.mock';
import { ICreateStatutoryReceivableAccountDto } from '@app/ledger/dtos/receivable-account/receivable-account.dto';
import makeCreateStatutoryReceivableAccountUsecase from '@app/ledger/usecases/create-statutory-receivable-account.usecase';

const actor = actorEntity.makeUser({
  email: 'posting@example.com',
  displayName: 'Posting Owner',
})[0];
const accountingEntity = {
  id: '123e4567-e89b-42d3-a456-426614174001' as TEntityId,
  functionalCurrencyCode: 'NGN',
} as IAccountingEntity;
const correlationId = 'posting-creation-spec';
const tx: ITransactionContext = {};
const repoOptions = { correlationId };
const usecase = makeCreateStatutoryReceivableAccountUsecase({
  appContext: mockAppContext,
  eventBus: mockEventBus,
  repoService: mockRepoService,
  ledgerAccountPersistenceService: mockLedgerAccountPersistenceService,
  receivablesAccountService: mockReceivablesAccountService,
});
const valid: ICreateStatutoryReceivableAccountDto = {
  name: 'Custom account',
  isControlAccount: false,
  currencyCode: 'NGN',
};

const cases = [
  {
    header: '102000',
    subType: 'receivables',
    behavior: 'statutory_receivable',
  },
] as const;

let creation: ReturnType<typeof ledgerAccountEntity.make<ILedgerAccount>>;
function makeAccount(scenario: (typeof cases)[number]) {
  return ledgerAccountEntity.make<ILedgerAccount>({
    name: valid.name,
    code: scenario.header.slice(0, 3) + '099',
    materializedPath:
      scenario.header + '.' + scenario.header.slice(0, 3) + '099',
    accountingEntityId: accountingEntity.id,
    createdBy: actor.id,
    type: 'asset',
    subType: scenario.subType,
    behavior: scenario.behavior,
    normalBalance: 'debit',
    isControlAccount: false,
    controlAccountId: actor.id,
    currency: currencyEntity.getByCode('NGN'),
    status: 'active',
    meta: null,
    contraAccountRule: 'contra_not_permitted',
    adjunctAccountRule: 'adjunct_not_permitted',
  });
}

describe('complete statutory-receivable creation workflow', () => {
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
    creation = makeAccount(cases[0]);
    mockReceivablesAccountService.createStatutoryReceivableSubAccount.mockImplementation(
      async () =>
        creation as Awaited<
          ReturnType<
            typeof mockReceivablesAccountService.createStatutoryReceivableSubAccount
          >
        >
    );
  });
  it.each(cases)(
    'stores the final version 1 account and one creation history for $behavior',
    async (scenario) => {
      creation = makeAccount(scenario);
      const response = await usecase(valid);
      const [account, functionalCurrency, writeOptions] =
        mockLedgerAccountPersistenceService.create.mock.calls[0];
      expect(account).toBe(creation[0]);
      expect(account.version).toBe(1);
      expect(functionalCurrency).toBe(accountingEntity.functionalCurrencyCode);
      expect(writeOptions).toMatchObject({
        correlationId,
        tx: mockRepoTransaction.context,
      });
      expect(writeOptions.history).toHaveLength(1);
      expect(writeOptions.history[0].diff).toMatchObject({
        before: null,
        after: JSON.parse(JSON.stringify(account)),
      });
      expect(response).toMatchObject({
        id: account.id,
        code: account.code,
        materializedPath: account.materializedPath,
      });
      expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(
        mockRepoTransaction.commit.mock.invocationCallOrder[0]
      ).toBeLessThan(mockEventBus.publish.mock.invocationCallOrder[0]);
      expect(mockEventBus.publish.mock.calls[0][0]).toEqual([
        expect.objectContaining({
          correlationId,
          data: expect.objectContaining({ version: 1, code: account.code }),
        }),
      ]);
    }
  );
  it('passes an optional parent ID and the caller transaction to the domain', async () => {
    await usecase({ ...valid, controlAccountId: actor.id });
    expect(
      mockReceivablesAccountService.createStatutoryReceivableSubAccount
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        controlAccountId: actor.id,
        createdBy: actor.id,
        accountingEntity,
        currency: currencyEntity.getByCode('NGN'),
      }),
      { correlationId, tx: mockRepoTransaction.context }
    );
  });
  it('rejects malformed requests before acquiring a transaction', async () => {
    await expect(usecase({ ...valid, name: '' })).rejects.toBeInstanceOf(
      appError.UnprocessableEntity
    );
    expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
  });
  it('propagates acquisition failure without using or disposing a context', async () => {
    const failure = new Error('acquisition failed');
    mockRepoService.createTransaction.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockRepoTransaction.handleError).not.toHaveBeenCalled();
    expect(mockRepoTransaction.dispose).not.toHaveBeenCalled();
  });
  it.each(['creation', 'write', 'commit'] as const)(
    'cleans up after %s failure without publishing',
    async (stage) => {
      const failure = new Error(stage);
      if (stage === 'creation')
        mockReceivablesAccountService.createStatutoryReceivableSubAccount.mockRejectedValueOnce(
          failure
        );
      if (stage === 'write')
        mockLedgerAccountPersistenceService.create.mockRejectedValueOnce(
          failure
        );
      if (stage === 'commit')
        mockRepoTransaction.commit.mockRejectedValueOnce(failure);
      await expect(usecase(valid)).rejects.toBe(failure);
      expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    }
  );
  it('preserves committed state when publication rejects and does not retry writes', async () => {
    const failure = new Error('publication failed');
    mockEventBus.publish.mockRejectedValueOnce(failure);
    await expect(usecase(valid)).rejects.toBe(failure);
    expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
    expect(mockLedgerAccountPersistenceService.create).toHaveBeenCalledTimes(1);
    expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
    expect(mockRepoTransaction.dispose).toHaveBeenCalledTimes(1);
  });
});
