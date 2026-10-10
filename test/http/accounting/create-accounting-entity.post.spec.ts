import { Express } from 'express';
import request from 'supertest';

import { TEntityId } from '@shared/types/uuid';

import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import periodError from '@domain/accounting/errors/period.error';
import { IAccountingEntity } from '@domain/accounting/types/accounting-entity.types';
import { IUser } from '@domain/user/types/user.types';

import { IAccountingEntityCreationDto } from '@app/accounting/dtos/accounting/accounting.dto';
import authError from '@app/auth/errors/auth.error';
import mockFeatureFlagAppService from '@app/context/contracts/__mocks__/feature-flag.service.mock';

import { tokenAppService } from '@infra/ioc/services/auth';
import * as accountingUsecases from '@infra/ioc/usecases/accounting';
import accountingRepos from '@infra/persistence/repos/accounting';
import userRepos from '@infra/persistence/repos/user';
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
    default: jest.requireActual<
      typeof import('@app/context/contracts/__mocks__/feature-flag.service.mock')
    >('@app/context/contracts/__mocks__/feature-flag.service.mock').default,
  })
);

jest.mock('../../../src/infra/ioc/services/auth', () => ({
  __esModule: true,
  tokenAppService: { getAuthUser: jest.fn() },
}));

jest.mock('../../../src/infra/ioc/usecases/accounting', () => ({
  __esModule: true,
  createAccountingEntityUseCase: jest.fn(),
  getJurisdictionsUseCase: jest.fn(),
  getUserAccountingEntitiesUseCase: jest.fn(),
  getActiveAccountingEntityUseCase: jest.fn(),
}));

jest.mock('../../../src/infra/persistence/repos/accounting', () => ({
  __esModule: true,
  default: {
    accountingEntity: {
      findByIdAndUserId: jest.fn(),
    },
  },
}));

jest.mock('../../../src/infra/persistence/repos/user', () => ({
  __esModule: true,
  default: {
    user: {
      findById: jest.fn(),
    },
  },
}));

const ENDPOINT = '/api/v1/accounting/accounting-entity';
const userId = '123e4567-e89b-12d3-a456-426614174000' as TEntityId;
const maximumFiscalYearEndDate = new Date('2027-07-01T00:00:00.000Z');
const overLimitFiscalYearEndDate = new Date('2027-07-01T00:00:00.001Z');

const validPayload: IAccountingEntityCreationDto = {
  name: 'Ada Consulting',
  entityType: 'individual',
  jurisdictionCode: 'US',
  accountingStandardCode: 'US_GAAP',
  functionalCurrencyCode: 'USD',
  reportingCurrencyCode: 'USD',
  fiscalYear: {
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T23:59:59.999Z'),
  },
  accountingPeriod: { unit: 'month', count: 12 },
  reportingPeriod: { unit: 'quarter', count: 4 },
  appPreferences: {
    theme: 'system',
    appUsageMode: 'non_power_user',
  },
};

const createdEntity: IAccountingEntity = {
  createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
  id: '123e4567-e89b-12d3-a456-426614174001' as TEntityId,
  name: validPayload.name,
  type: 'individual',
  ownerId: userId,
  functionalCurrencyCode: 'USD',
  jurisdictionCode: 'US',
  createdAt: new Date('2026-07-26T10:00:00.000Z'),
  updatedAt: new Date('2026-07-26T10:00:00.000Z'),
};

describe('POST /accounting/accounting-entity', () => {
  let app: Express;
  const mockGetAuthUser = tokenAppService.getAuthUser as jest.Mock;
  const mockFindUser = userRepos.user.findById as jest.Mock;
  const mockFindAccountingEntity = accountingRepos.accountingEntity
    .findByIdAndUserId as jest.Mock;
  const mockCreateAccountingEntity =
    accountingUsecases.createAccountingEntityUseCase as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValue(true);
    mockGetAuthUser.mockResolvedValue({ id: userId });
    mockFindUser.mockResolvedValue({
      createdBy: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      actorId: 'a1111111-1111-4111-8111-111111111111' as TEntityId,
      id: userId,
    } as IUser);
    mockFindAccountingEntity.mockResolvedValue(null);
    mockCreateAccountingEntity.mockResolvedValue(createdEntity);
    app = createApplication();
  });

  describe('201 Response', () => {
    it('returns the explicit entity contract with security headers', async () => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(201);
      expect(response.type).toBe('application/json');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.body).toEqual({
        ...createdEntity,
        createdAt: createdEntity.createdAt.toISOString(),
        updatedAt: createdEntity.updatedAt.toISOString(),
      });
      expect(mockCreateAccountingEntity).toHaveBeenCalledWith({
        ...validPayload,
      });
    });

    it('creates a sole trader accounting entity', async () => {
      const soleTraderPayload: IAccountingEntityCreationDto = {
        ...validPayload,
        entityType: 'sole_trader',
      };
      const soleTraderEntity: IAccountingEntity = {
        ...createdEntity,
        type: 'sole_trader',
      };
      mockCreateAccountingEntity.mockResolvedValue(soleTraderEntity);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(soleTraderPayload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ type: 'sole_trader' });
      expect(mockCreateAccountingEntity).toHaveBeenCalledWith(
        soleTraderPayload
      );
    });

    it('creates a private company accounting entity', async () => {
      const privateCompanyPayload: IAccountingEntityCreationDto = {
        ...validPayload,
        entityType: 'private_company',
      };
      const privateCompanyEntity: IAccountingEntity = {
        ...createdEntity,
        type: 'private_company',
      };
      mockCreateAccountingEntity.mockResolvedValue(privateCompanyEntity);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(privateCompanyPayload);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ type: 'private_company' });
      expect(mockCreateAccountingEntity).toHaveBeenCalledWith(
        privateCompanyPayload
      );
    });
  });

  describe('400 Response', () => {
    it('maps a jurisdiction fiscal year limit violation', async () => {
      const overLimitPayload = {
        ...validPayload,
        fiscalYear: {
          ...validPayload.fiscalYear,
          endDate: overLimitFiscalYearEndDate,
        },
      };

      mockCreateAccountingEntity.mockRejectedValue(
        new periodError.FiscalYearExceedsJurisdictionLimit({
          jurisdictionCode: validPayload.jurisdictionCode,
          maxFiscalMonths: 18,
          startDate: validPayload.fiscalYear.startDate,
          endDate: overLimitFiscalYearEndDate,
          maximumEndDate: maximumFiscalYearEndDate,
        })
      );

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(overLimitPayload);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        name: 'PeriodError',
        errorKey:
          'accounting_error_period_fiscal_year_exceeds_jurisdiction_limit_invalid',
        cause: {
          jurisdictionCode: validPayload.jurisdictionCode,
          maxFiscalMonths: 18,
          startDate: validPayload.fiscalYear.startDate.toISOString(),
          endDate: overLimitFiscalYearEndDate.toISOString(),
          maximumEndDate: maximumFiscalYearEndDate.toISOString(),
        },
      });
      expect(mockCreateAccountingEntity).toHaveBeenCalledWith(overLimitPayload);
    });
  });

  describe('409 Response', () => {
    it('maps an existing individual accounting entity violation', async () => {
      mockCreateAccountingEntity.mockRejectedValue(
        new accountingEntityError.OnlyOneIndividualAccountingEntityAllowed({
          ownerId: userId,
        })
      );

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        name: 'AccountingEntityError',
        errorKey:
          'accounting_error_accounting_entity_only_one_individual_accounting_entity_allowed_conflict',
        cause: { ownerId: userId },
      });
    });
  });

  describe('401 Response', () => {
    it.each([
      ['missing authorization', undefined],
      ['wrong authorization scheme', 'Basic token'],
      ['authorization with extra segments', 'Bearer token extra'],
    ])('rejects %s', async (_label, authorization) => {
      const requestBuilder = request(app).post(ENDPOINT).send(validPayload);
      if (authorization) requestBuilder.set('Authorization', authorization);

      const response = await requestBuilder;

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'Unauthorized',
        errorKey: 'app_error_unauthorized',
      });
      expect(mockCreateAccountingEntity).not.toHaveBeenCalled();
    });

    it('rejects a nonexistent user', async () => {
      mockFindUser.mockResolvedValue(null);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(mockCreateAccountingEntity).not.toHaveBeenCalled();
    });

    it('rejects an expired bearer token', async () => {
      mockGetAuthUser.mockRejectedValue(new authError.ExpiredToken());

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer expired-token')
        .send(validPayload);

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        name: 'AuthError',
        errorKey: 'auth_error_token_expired_unauthorized',
      });
      expect(mockCreateAccountingEntity).not.toHaveBeenCalled();
    });
  });

  describe('403 Response', () => {
    it('rejects a user without Alpha 1 access', async () => {
      mockFeatureFlagAppService.canAccessAlpha1.mockResolvedValueOnce(false);

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'FeatureFlagError',
        errorKey: 'feature_flag_error_forbidden',
      });
      expect(mockCreateAccountingEntity).not.toHaveBeenCalled();
    });

    it('rejects a caller-supplied foreign accounting entity context', async () => {
      mockFindAccountingEntity.mockResolvedValue({
        ...createdEntity,
        ownerId: '999e4567-e89b-12d3-a456-426614174999',
      });

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .set('x-accounting-entity-id', createdEntity.id)
        .send(validPayload);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        name: 'Forbidden',
        errorKey: 'app_error_forbidden',
      });
      expect(mockCreateAccountingEntity).not.toHaveBeenCalled();
    });
  });

  describe('422 Response', () => {
    it.each([
      ['unsupported entity type', { entityType: 'partnership' }],
      ['unsupported jurisdiction', { jurisdictionCode: 'ZZ' }],
      [
        'unsupported accounting standard',
        { accountingStandardCode: 'INVALID' },
      ],
      ['unsupported currency', { functionalCurrencyCode: 'ZZZ' }],
      ['unsupported reporting currency', { reportingCurrencyCode: 'ZZZ' }],
      [
        'unsupported mode',
        { appPreferences: { theme: 'system', appUsageMode: 'expert' } },
      ],
      [
        'unsupported theme',
        {
          appPreferences: {
            theme: 'sepia',
            appUsageMode: 'non_power_user',
          },
        },
      ],
      [
        'fractional period count',
        { accountingPeriod: { unit: 'month', count: 1.5 } },
      ],
      [
        'excessive period count',
        { accountingPeriod: { unit: 'day', count: 551 } },
      ],
      ['caller-supplied owner identity', { ownerId: userId }],
      [
        'malformed fiscal year date',
        {
          fiscalYear: {
            startDate: 'not-a-date',
            endDate: validPayload.fiscalYear.endDate,
          },
        },
      ],
    ])('rejects %s before orchestration', async (_label, override) => {
      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validPayload, ...override });

      expect(response.status).toBe(422);
      expect(response.body).toMatchObject({
        name: 'UnprocessableEntity',
        errorKey: 'app_error_validation_error',
      });
      expect(mockCreateAccountingEntity).not.toHaveBeenCalled();
    });
  });

  describe('500 Response', () => {
    it('sanitizes unexpected creation failures', async () => {
      mockCreateAccountingEntity.mockRejectedValue(
        new Error('database credentials leaked')
      );

      const response = await request(app)
        .post(ENDPOINT)
        .set('Authorization', 'Bearer valid-token')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        name: 'InternalServerError',
        errorKey: 'app_error_unexpected',
      });
      expect(JSON.stringify(response.body)).not.toContain(
        'database credentials'
      );
    });
  });
});
