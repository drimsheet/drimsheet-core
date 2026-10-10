import { Express } from 'express';
import request from 'supertest';

import mockRepoService, {
  mockRepoTransaction,
} from '@shared/contracts/__mocks__/repo.mock';
import generateUUID from '@shared/utils/uuid-generator';
import repoError from '@shared/values/errors/repo.error';

import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import counterpartyEntity from '@domain/counterparty/entities/counterparty.entity';
import journalLineEntity from '@domain/journal-entry/entities/journal-line.entity';
import { SYSTEM_CURRENCIES } from '@domain/money/config/currencies.config';
import moneyValue from '@domain/money/values/money.vo';
import actorEntity from '@domain/user/entities/actor.entity';
import { IUser } from '@domain/user/types/user.types';

import { mockAccountingEntityRepo } from '@app/accounting/contracts/__mocks__/accounting.repos.mock';
import mockTokenAppService from '@app/auth/contracts/__mocks__/token-service.mock';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';
import { mockCounterpartyRepo } from '@app/counterparty/contracts/__mocks__/counterparty.repos.mock';
import makeDeleteCounterpartyUsecase from '@app/counterparty/usecases/delete-counterparty.usecase';
import { mockJournalLineRepo } from '@app/journal-entry/contracts/__mocks__/journal-entry.repos.mock';
import { mockActorService } from '@app/user/contracts/__mocks__/actor.services.mock';
import { mockUserRepo } from '@app/user/contracts/__mocks__/user.repos.mock';

import * as counterpartyUseCases from '@infra/ioc/usecases/counterparty';
import appContext from '@infra/runtime/app-context';
import { createApplication } from '@infra/server';

jest.mock('@infra/ioc/services/user', () => ({
  ...jest.requireActual('@infra/ioc/services/user'),
  actorService: jest.requireActual(
    '@app/user/contracts/__mocks__/actor.services.mock'
  ).mockActorService,
}));
jest.mock(
  '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service',
  () => ({
    __esModule: true,
    default: jest.requireActual(
      '@app/context/contracts/__mocks__/feature-flag.service.mock'
    ).default,
  })
);
jest.mock('@infra/ioc/services/auth', () => ({
  ...jest.requireActual('@infra/ioc/services/auth'),
  tokenAppService: jest.requireActual(
    '@app/auth/contracts/__mocks__/token-service.mock'
  ).default,
}));
jest.mock('@infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/persistence/repos/accounting').default,
    accountingEntity: jest.requireActual(
      '@app/accounting/contracts/__mocks__/accounting.repos.mock'
    ).mockAccountingEntityRepo,
  },
}));
jest.mock('@infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@infra/persistence/repos/user').default,
    user: jest.requireActual('@app/user/contracts/__mocks__/user.repos.mock')
      .mockUserRepo,
  },
}));

const [actor] = actorEntity.makeUser({
  email: 'delete-http@example.test',
  displayName: 'Deleter',
});
const userId = generateUUID();
const accountingEntityId = generateUUID();
const accountingEntity = {
  id: accountingEntityId,
  createdBy: actor.id,
  ownerId: userId,
  functionalCurrencyCode: 'NGN',
  jurisdictionCode: 'NG',
} as IAccountingEntity;
const [counterparty] = counterpartyEntity.make({
  createdBy: actor.id,
  accountingEntityId,
  name: 'Unused',
  type: 'individual',
  status: 'active',
});
const [referencedLine] = journalLineEntity.make(
  {
    id: generateUUID(),
    createdBy: actor.id,
    memo: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    accountId: generateUUID(),
    counterpartyId: counterparty.id,
    sequenceOrder: 1,
    amount: moneyValue.make(1000, SYSTEM_CURRENCIES.NGN, true),
    exchangeRate: null,
    side: 'debit',
    description: null,
    functionalCurrency: SYSTEM_CURRENCIES.NGN,
  }
);
const endpoint = `/api/v1/counterparties/${counterparty.id}`;
describe('DELETE /counterparties/{id}', () => {
  let app: Express;
  const remove = jest.spyOn(counterpartyUseCases, 'deleteCounterpartyUseCase');

  beforeEach(() => {
    jest.resetAllMocks();
    mockActorService.resolveUser.mockResolvedValue(actor);
    mockTokenAppService.getAuthUser.mockResolvedValue({ id: userId });
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockUserRepo.findById.mockResolvedValue({
      id: userId,
      actorId: actor.id,
      createdBy: actor.id,
    } as IUser);
    mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue(
      accountingEntity
    );
    mockCounterpartyRepo.findById.mockResolvedValue(counterparty);
    mockCounterpartyRepo.delete.mockResolvedValue();
    mockJournalLineRepo.findAllByCounterpartyId.mockResolvedValue([]);
    mockRepoService.createTransaction.mockResolvedValue(mockRepoTransaction);
    mockRepoTransaction.handleError.mockImplementation(async (error) => {
      throw error;
    });
    remove.mockImplementation(
      makeDeleteCounterpartyUsecase({
        appContext,
        repoService: mockRepoService,
        counterpartyRepo: mockCounterpartyRepo,
        journalLineRepo: mockJournalLineRepo,
      })
    );
    app = createApplication();
  });

  const deleteRequest = (url = endpoint) =>
    request(app)
      .delete(url)
      .set('Authorization', 'Bearer valid-token')
      .set('x-accounting-entity-id', accountingEntityId);

  describe('204 Response', () => {
    it.each(['draft', 'active', 'archived'] as const)(
      'permanently deletes an unassociated %s counterparty',
      async (status) => {
        const [current] = counterpartyEntity.make({
          createdBy: actor.id,
          accountingEntityId,
          name: 'Unused',
          type: 'individual',
          status,
        });
        mockCounterpartyRepo.findById.mockResolvedValue(current);
        const response = await deleteRequest(
          `/api/v1/counterparties/${current.id}`
        );
        expect(response.status).toBe(204);
        expect(response.text).toBe('');
        expect(response.headers['content-type']).toBeUndefined();
        expect(remove).toHaveBeenCalledWith(current.id);
        expect(mockCounterpartyRepo.delete).toHaveBeenCalledWith(
          current.id,
          accountingEntityId,
          {
            correlationId: expect.any(String),
            tx: mockRepoTransaction.context,
            expectedVersion: current.version,
          }
        );
        expect(mockRepoTransaction.commit).toHaveBeenCalledTimes(1);
        expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
        expect(mockJournalLineRepo.delete).not.toHaveBeenCalled();
        expect(mockJournalLineRepo.update).not.toHaveBeenCalled();
      }
    );

    it('allows deletion after the last transaction association is removed', async () => {
      mockJournalLineRepo.findAllByCounterpartyId
        .mockResolvedValueOnce([referencedLine])
        .mockResolvedValueOnce([]);
      expect((await deleteRequest()).status).toBe(409);
      expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
      expect((await deleteRequest()).status).toBe(204);
      expect(mockCounterpartyRepo.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('400 Response', () => {
    it('rejects malformed IDs before transaction access', async () => {
      const response = await deleteRequest('/api/v1/counterparties/invalid');
      expect(response.status).toBe(400);
      expect(response.body.errorKey).toBe(
        'counterparty_error_counterparty_id_invalid'
      );
      expect(mockRepoService.createTransaction).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('401 Response', () => {
    it('rejects unauthenticated callers before feature/access checks or orchestration', async () => {
      const response = await request(app).delete(endpoint);
      expect(response.status).toBe(401);
      expect(mockFeatureFlagAppService.canAccessAlpha1).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects callers without Alpha 1 access before orchestration', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(false);
      expect((await deleteRequest()).status).toBe(403);
      expect(remove).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
    });

    it('rejects a foreign accounting entity context before orchestration', async () => {
      mockAccountingEntityRepo.findByIdAndUserId.mockResolvedValue({
        ...accountingEntity,
        ownerId: generateUUID(),
      });
      expect((await deleteRequest()).status).toBe(403);
      expect(remove).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('404 Response', () => {
    it.each([null, { ...counterparty, accountingEntityId: generateUUID() }])(
      'hides missing or foreign counterparties %p',
      async (stored) => {
        mockCounterpartyRepo.findById.mockResolvedValue(stored);
        const response = await deleteRequest();
        expect(response.status).toBe(404);
        expect(response.body.errorKey).toBe('app_error_resource_not_found');
        expect(mockCounterpartyRepo.findById).toHaveBeenCalledWith(
          counterparty.id,
          accountingEntityId,
          {
            correlationId: expect.any(String),
            tx: mockRepoTransaction.context,
            lock: 'update',
          }
        );
        expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
      }
    );

    it('returns not found on repeat deletion after success', async () => {
      mockCounterpartyRepo.delete.mockImplementation(async () => {
        mockCounterpartyRepo.findById.mockResolvedValue(null);
      });
      expect((await deleteRequest()).status).toBe(204);
      expect((await deleteRequest()).status).toBe(404);
      expect(mockCounterpartyRepo.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe('409 Response', () => {
    it('returns transaction history and archive guidance without changing any references', async () => {
      mockJournalLineRepo.findAllByCounterpartyId.mockResolvedValue([
        referencedLine,
      ]);
      const response = await deleteRequest();
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        errorKey:
          'counterparty_error_deletion_with_transaction_references_conflict',
        cause: {
          reason: 'transaction_usage',
          nextAction: 'archive_counterparty',
        },
      });
      expect(mockCounterpartyRepo.delete).not.toHaveBeenCalled();
      expect(mockCounterpartyRepo.update).not.toHaveBeenCalled();
      expect(mockJournalLineRepo.delete).not.toHaveBeenCalled();
      expect(mockJournalLineRepo.update).not.toHaveBeenCalled();
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    });

    it('maps conditional repository deletion conflicts', async () => {
      mockCounterpartyRepo.delete.mockRejectedValue(
        new repoError.VersionNotFound()
      );
      const response = await deleteRequest();
      expect(response.status).toBe(409);
      expect(response.body.errorKey).toBe('repo_error_version_conflict');
      expect(mockRepoTransaction.commit).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it.each(['read', 'usage', 'delete', 'commit'] as const)(
      'sanitizes unexpected %s failure',
      async (stage) => {
        const failure = new Error('private database details');
        if (stage === 'read')
          mockCounterpartyRepo.findById.mockRejectedValue(failure);
        if (stage === 'usage')
          mockJournalLineRepo.findAllByCounterpartyId.mockRejectedValue(
            failure
          );
        if (stage === 'delete')
          mockCounterpartyRepo.delete.mockRejectedValue(failure);
        if (stage === 'commit')
          mockRepoTransaction.commit.mockRejectedValue(failure);
        const response = await deleteRequest();
        expect(response.status).toBe(500);
        expect(response.body.errorKey).toBe('app_error_unexpected');
        expect(JSON.stringify(response.body)).not.toContain(
          'private database details'
        );
        expect(mockRepoTransaction.handleError).toHaveBeenCalledWith(failure);
      }
    );
  });
});
