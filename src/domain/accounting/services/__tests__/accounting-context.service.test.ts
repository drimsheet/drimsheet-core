import generateUUID from '@shared/utils/uuid-generator';

import { UAccountingStandardCode } from '@domain/accounting/config/accounting-standards.config';
import accountingContextEntity from '@domain/accounting/entities/accounting-context.entity';
import accountingEntityEntity from '@domain/accounting/entities/accounting-entity.entity';
import accountingPeriodEntity from '@domain/accounting/entities/accounting-period.entity';
import fiscalYearEntity from '@domain/accounting/entities/fiscal-year.entity';
import accountingEntityError from '@domain/accounting/errors/accounting-entity.error';
import accountingStandardError from '@domain/accounting/errors/accounting-standard.error';
import accountingError from '@domain/accounting/errors/accounting.error';
import IAccountingContextRepo from '@domain/accounting/repos/accounting-context.repo';
import IAccountingPeriodRepo from '@domain/accounting/repos/accounting-period.repo';
import IFiscalYearRepo from '@domain/accounting/repos/fiscal-year.repo';
import makeAccountingContextService from '@domain/accounting/services/accounting-context.service';
import { EPeriodStatus } from '@domain/accounting/types/period.types';

describe('accountingContextService.create', () => {
  const createdBy = generateUUID();
  const accountingEntity = accountingEntityEntity.make({
    createdBy,
    ownerId: generateUUID(),
    name: 'Business',
    type: 'private_company',
    functionalCurrencyCode: 'NGN',
    jurisdictionCode: 'NG',
  })[0];
  const repoOptions = { correlationId: 'accounting-context-test' };
  const repo: jest.Mocked<IAccountingPeriodRepo> = {
    findAllByFiscalYear: jest.fn(),
    findById: jest.fn(),
    findByDate: jest.fn(),
    findAllByDate: jest.fn(),
    findByRange: jest.fn(),
    create: jest.fn(),
  };
  const contextRepo: jest.Mocked<IAccountingContextRepo> = {
    findById: jest.fn(),
    create: jest.fn(),
    deleteByAccountingEntityId: jest.fn(),
    update: jest.fn(),
  };
  const fiscalYearRepo: jest.Mocked<IFiscalYearRepo> = {
    findByAccountingEntityId: jest.fn(),
    findById: jest.fn(),
    existsByRange: jest.fn(),
    create: jest.fn(),
  };
  const service = makeAccountingContextService({
    accountingPeriodRepo: repo,
    accountingContextRepo: contextRepo,
    fiscalYearRepo,
  });

  function makeFixture(yearNumber = 2026, selectedIndex = 3, count = 12) {
    jest.setSystemTime(new Date(`${yearNumber}-01-01`));
    const fiscalYear = fiscalYearEntity.make({
      accountingEntityId: accountingEntity.id,
      createdBy,
      startDate: new Date(`${yearNumber}-01-01`),
      endDate: new Date(`${yearNumber}-12-31`),
      status: 'open',
    })[0];
    const periods = accountingPeriodEntity
      .make({
        accountingEntityId: accountingEntity.id,
        createdBy,
        fiscalYear,
        unit: count === 1 ? 'year' : 'month',
        count,
      })
      .map(([period]) => period);
    repo.findByRange.mockResolvedValue([...periods].reverse());
    jest.setSystemTime(new Date('2026-10-17'));
    const input = {
      accountingEntity,
      fiscalYear,
      accountingPeriod: periods[selectedIndex],
      createdBy,
      name: 'Working context',
      description: null,
      accountingStandardCode: 'IFRS' as const,
    };
    return { input, periods };
  }

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('rejects context creation for an archived accounting entity', async () => {
    const { input } = makeFixture();
    const [archivedEntity] = accountingEntityEntity.archive(
      input.accountingEntity
    );
    await expect(
      service.create(
        { ...input, accountingEntity: archivedEntity },
        repoOptions
      )
    ).rejects.toThrow(accountingEntityError.Archived);
  });

  it.each([2025, 2026, 2027])(
    'creates a valid context for year %s with the explicit selection and its event/audit',
    async (yearNumber) => {
      const { input, periods } = makeFixture(yearNumber);
      const [context, events, audit] = await service.create(input, repoOptions);
      expect(repo.findByRange).toHaveBeenCalledWith(
        accountingEntity.id,
        {
          startDate: input.fiscalYear.startDate,
          endDate: input.fiscalYear.endDate,
        },
        repoOptions
      );
      expect(repo.create).not.toHaveBeenCalled();
      expect(context).toMatchObject({
        accountingEntityId: accountingEntity.id,
        fiscalYearId: input.fiscalYear.id,
        currentAccountingPeriodId: input.accountingPeriod.id,
        previousAccountingPeriodId: periods[2].id,
        nextAccountingPeriodId: periods[4].id,
        accountingStandardCode: 'IFRS',
        createdBy,
        name: input.name,
        description: null,
        closedAt: null,
      });
      expect(Object.isFrozen(service)).toBe(true);
      expect(Object.isFrozen(context)).toBe(true);
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual(context);
      expect(audit.diff).toEqual({ before: null, after: context });
    }
  );

  it.each([0, 11])(
    'resolves neighbors at period index %s',
    async (selectedIndex) => {
      const { input, periods } = makeFixture(2026, selectedIndex);
      const [context] = await service.create(input, repoOptions);

      expect(context.previousAccountingPeriodId).toBe(
        selectedIndex === 0 ? null : periods[10].id
      );
      expect(context.nextAccountingPeriodId).toBe(
        selectedIndex === 0 ? periods[1].id : null
      );
    }
  );

  it('uses null for both neighbors when the fiscal year contains one period', async () => {
    const { input } = makeFixture(2026, 0, 1);
    const [context] = await service.create(input, repoOptions);

    expect(context.previousAccountingPeriodId).toBeNull();
    expect(context.nextAccountingPeriodId).toBeNull();
  });

  it('propagates a repository read failure', async () => {
    const { input } = makeFixture();
    const failure = new Error('Period lookup failed');
    repo.findByRange.mockRejectedValueOnce(failure);

    await expect(service.create(input, repoOptions)).rejects.toBe(failure);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects a selected period missing from the stored fiscal-year periods', async () => {
    const { input } = makeFixture();
    repo.findByRange.mockResolvedValueOnce([]);

    await expect(service.create(input, repoOptions)).rejects.toThrow(
      accountingError.InvalidCurrentAccountingPeriodId
    );
  });

  it('rejects a fiscal year belonging to another entity', async () => {
    const { input } = makeFixture();
    await expect(
      service.create(
        {
          ...input,
          fiscalYear: {
            ...input.fiscalYear,
            accountingEntityId: generateUUID(),
          },
        },
        repoOptions
      )
    ).rejects.toThrow(accountingError.InvalidFiscalYearId);
  });

  it.each(['accountingEntityId', 'fiscalYearId'] as const)(
    'rejects a selected period with a different %s',
    async (field) => {
      const { input } = makeFixture();
      await expect(
        service.create(
          {
            ...input,
            accountingPeriod: {
              ...input.accountingPeriod,
              [field]: generateUUID(),
            },
          },
          repoOptions
        )
      ).rejects.toThrow(accountingError.InvalidCurrentAccountingPeriodId);
    }
  );

  it.each(['UNKNOWN', 'US_GAAP', 'CASH_BASIS'])(
    'rejects an unrecognized or impermissible standard %s inside the domain',
    async (accountingStandardCode) => {
      await expect(
        service.create(
          {
            ...makeFixture().input,
            accountingStandardCode:
              accountingStandardCode as UAccountingStandardCode,
          },
          repoOptions
        )
      ).rejects.toThrow(accountingStandardError.Invalid);
    }
  );

  it.each(Object.values(EPeriodStatus))(
    'preserves period status %s when selecting it',
    async (status) => {
      const { input } = makeFixture();
      const accountingPeriod = Object.freeze({
        ...input.accountingPeriod,
        status,
      });
      const before = JSON.stringify(accountingPeriod);
      const [context] = await service.create(
        { ...input, accountingPeriod },
        repoOptions
      );
      expect(context.currentAccountingPeriodId).toBe(accountingPeriod.id);
      expect(JSON.stringify(accountingPeriod)).toBe(before);
    }
  );

  it('enforces entity field validity as part of domain creation', async () => {
    await expect(
      service.create({ ...makeFixture().input, name: '' }, repoOptions)
    ).rejects.toThrow(accountingError.InvalidName);
  });
  describe('updateCurrentAccountingPeriod', () => {
    async function updateFixture(selectedIndex = 3) {
      const { input, periods } = makeFixture(2026, selectedIndex);
      const [context] = await service.create(input, repoOptions);
      contextRepo.findById.mockResolvedValue(context);
      fiscalYearRepo.findById.mockResolvedValue(input.fiscalYear);
      jest.setSystemTime(new Date('2026-10-18'));
      return {
        context,
        periods,
        fiscalYear: input.fiscalYear,
        update: {
          accountingContextId: context.id,
          previousState: {
            currentAccountPeriod: periods[selectedIndex].id,
            nextAccountingPeriod: periods[selectedIndex + 1].id,
          },
        },
      };
    }

    it.each([3, 10])(
      'prepares all three references from storage at index %s without persisting',
      async (selectedIndex) => {
        const { context, periods, update, fiscalYear } =
          await updateFixture(selectedIndex);
        const [updated, events, audit] =
          await service.updateCurrentAccountingPeriod(update, repoOptions);
        expect(contextRepo.findById).toHaveBeenCalledWith(
          context.id,
          repoOptions
        );
        expect(fiscalYearRepo.findById).toHaveBeenCalledWith(
          context.accountingEntityId,
          context.fiscalYearId,
          repoOptions
        );
        expect(repo.findByRange).toHaveBeenLastCalledWith(
          context.accountingEntityId,
          {
            startDate: fiscalYear.startDate,
            endDate: fiscalYear.endDate,
          },
          repoOptions
        );
        expect(updated).toEqual({
          ...context,
          previousAccountingPeriodId: periods[selectedIndex].id,
          currentAccountingPeriodId: periods[selectedIndex + 1].id,
          nextAccountingPeriodId: periods[selectedIndex + 2]?.id ?? null,
          updatedAt: new Date('2026-10-18'),
        });
        expect(Object.isFrozen(updated)).toBe(true);
        expect(events).toHaveLength(1);
        expect(events[0].data).toBe(updated);
        expect(audit?.action).toBe('updated');
        expect(context.currentAccountingPeriodId).toBe(
          periods[selectedIndex].id
        );
        expect(contextRepo.update).not.toHaveBeenCalled();
        expect(contextRepo.create).not.toHaveBeenCalled();
      }
    );

    it('returns the existing context unchanged for an already applied transition', async () => {
      const { update } = await updateFixture();
      const [updated] = await service.updateCurrentAccountingPeriod(
        update,
        repoOptions
      );
      contextRepo.findById.mockResolvedValue(updated);
      jest.setSystemTime(new Date('2026-10-19'));
      const [repeated, events, audit] =
        await service.updateCurrentAccountingPeriod(update, repoOptions);
      expect(repeated).toBe(updated);
      expect(events).toEqual([]);
      expect(audit).toBeNull();
    });

    it.each([
      [
        'currentAccountingPeriodId',
        accountingError.InvalidCurrentAccountingPeriodId,
      ],
      ['nextAccountingPeriodId', accountingError.InvalidNextAccountingPeriodId],
    ] as const)(
      'rejects stale %s from the discovered transition',
      async (field, error) => {
        const { context, update } = await updateFixture();
        const [changed] = accountingContextEntity.update(context, {
          [field]: generateUUID(),
        });
        contextRepo.findById.mockResolvedValue(changed);
        await expect(
          service.updateCurrentAccountingPeriod(update, repoOptions)
        ).rejects.toThrow(error);
      }
    );

    it('rejects missing contexts', async () => {
      const { update } = await updateFixture();
      contextRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateCurrentAccountingPeriod(update, repoOptions)
      ).rejects.toThrow(accountingError.AccountingContextNotFound);
      expect(fiscalYearRepo.findById).not.toHaveBeenCalled();
    });

    it('rejects missing fiscal years', async () => {
      const { update } = await updateFixture();
      fiscalYearRepo.findById.mockResolvedValue(null);
      await expect(
        service.updateCurrentAccountingPeriod(update, repoOptions)
      ).rejects.toThrow(accountingError.FiscalYearNotFound);
    });

    it('excludes periods belonging to another fiscal year', async () => {
      const { update, periods } = await updateFixture();
      repo.findByRange.mockResolvedValue(
        periods.map((period) => ({ ...period, fiscalYearId: generateUUID() }))
      );
      await expect(
        service.updateCurrentAccountingPeriod(update, repoOptions)
      ).rejects.toThrow(accountingError.InvalidNextAccountingPeriodId);
    });

    it('rejects a transition that skips the next chronological period', async () => {
      const { update, periods } = await updateFixture();
      update.previousState.nextAccountingPeriod = periods[6].id;
      await expect(
        service.updateCurrentAccountingPeriod(update, repoOptions)
      ).rejects.toThrow(accountingError.InvalidPreviousAccountingPeriodId);
    });

    it('propagates repository failures without writing', async () => {
      const { update } = await updateFixture();
      const failure = new Error('Context read failed');
      contextRepo.findById.mockRejectedValue(failure);
      await expect(
        service.updateCurrentAccountingPeriod(update, repoOptions)
      ).rejects.toBe(failure);
      expect(contextRepo.update).not.toHaveBeenCalled();
    });
  });
});
