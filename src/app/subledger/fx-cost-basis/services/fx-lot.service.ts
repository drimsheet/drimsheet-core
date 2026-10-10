import { EOutboxType } from '@shared/types/outbox.types';
import { IReadRepoOptions } from '@shared/types/repo.types';
import historyValue from '@shared/values/history/history.vo';

import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import { IExchangeRate } from '@domain/money/types/exchange-rate.types';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import {
  EMissingOfficialFxRateEffectKind,
  IMissingOfficialFxRateOutbox,
  UMissingOfficialFxRateEffectKind,
} from '@app/outbox/types/missing-official-fx-rate.types';
import IFxLotAppService from '@app/subledger/fx-cost-basis/contracts/fx-lot.service.contract';
import { IFxLotAppOperationPayload } from '@app/subledger/fx-cost-basis/types/fx-lot.service.types';

interface IDependencies {
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
}

/**
 * Resolves supplementary official-rate metadata from the participating
 * account's single journal line. Missing, rate-less, or ambiguous line matches
 * return `null`; exchange-rate service failures propagate to the caller.
 */
async function resolveOfficialRate(
  deps: IDependencies,
  payload: IFxLotAppOperationPayload,
  repoOptions: IReadRepoOptions
): Promise<IExchangeRate | null> {
  const accountLines = payload.journalEntry.lines.filter(
    (line) => line.accountId === payload.account.id
  );
  const transactionRate =
    accountLines.length === 1 ? accountLines[0].exchangeRate : null;

  if (!transactionRate) return null;

  return deps.exchangeRateAppService.getOfficialRate(
    transactionRate.currencyPair,
    transactionRate.asOf,
    repoOptions,
    transactionRate
  );
}

/**
 * Prepares the durable missing-official-rate fact for an FX effect without
 * persisting it. Effects that already have an official rate return `null`.
 */
function makeMissingOfficialRateOutbox(
  payload: IFxLotAppOperationPayload,
  repoOptions: IReadRepoOptions,
  effect: {
    id: IMissingOfficialFxRateOutbox['id'];
    journalEntryId: IMissingOfficialFxRateOutbox['data']['journalEntryId'];
    accountingEntityId: IMissingOfficialFxRateOutbox['data']['accountingEntityId'];
    officialRate: IExchangeRate | null;
    effectiveDate: Date;
  },
  effectKind: UMissingOfficialFxRateEffectKind
): IMissingOfficialFxRateOutbox | null {
  if (effect.officialRate !== null) return null;

  return {
    id: effect.id,
    correlationId: repoOptions.correlationId,
    type: EOutboxType.MissingOfficialFxRate,
    data: {
      effectKind,
      journalEntryId: effect.journalEntryId,
      accountingEntityId: effect.accountingEntityId,
      createdBy: payload.actor,
      effectiveDate: effect.effectiveDate,
    },
  };
}

/**
 * Builds the acquisition preparation operation. Drafts short-circuit before
 * official-rate lookup or domain delegation; posted non-FX movements return
 * `null` from the domain service. A non-null result contains histories, events,
 * and persistence-ready FX and outbox records, but performs no writes.
 */
function makeAcquire(deps: IDependencies): IFxLotAppService['acquire'] {
  return async (payload, repoOptions) => {
    if (payload.journalEntry.status === EJournalEntryStatus.Draft) return null;

    const officialRate = await resolveOfficialRate(deps, payload, repoOptions);
    const domainResult = deps.fxCostBasisLotService.acquire({
      createdBy: payload.actor,
      journalEntry: payload.journalEntry,
      account: payload.account,
      officialRate,
    });

    if (!domainResult) return null;

    const [lot, lotEvents, lotAudit] = domainResult.lot;
    const [acquisition, acquisitionEvents, acquisitionAudit] =
      domainResult.acquisition;

    return {
      records: {
        lot,
        acquisition,
        lotHistory: historyValue.make(
          lotAudit,
          payload.actor,
          repoOptions.correlationId
        ),
        acquisitionHistory: historyValue.make(
          acquisitionAudit,
          payload.actor,
          repoOptions.correlationId
        ),
        missingOfficialRateOutbox: makeMissingOfficialRateOutbox(
          payload,
          repoOptions,
          {
            ...acquisition,
            effectiveDate: acquisition.acquisitionDate,
          },
          EMissingOfficialFxRateEffectKind.Acquisition
        ),
      },
      events: [...lotEvents, ...acquisitionEvents],
    };
  };
}

/**
 * Builds the disposition preparation operation. The caller's read repository
 * options are forwarded to official-rate and FIFO lot reads. Drafts and posted
 * non-FX movements return `null`; no writes are initiated.
 */
function makeDispose(deps: IDependencies): IFxLotAppService['dispose'] {
  return async (payload, repoOptions) => {
    if (payload.journalEntry.status === EJournalEntryStatus.Draft) return null;

    const officialRate = await resolveOfficialRate(deps, payload, repoOptions);
    const domainResult = await deps.fxCostBasisLotService.dispose(
      {
        createdBy: payload.actor,
        journalEntry: payload.journalEntry,
        account: payload.account,
        officialRate,
      },
      repoOptions
    );

    if (!domainResult) return null;

    const lots = domainResult.lots.map((auditedLot) => {
      const [lot, , lotAudit] = auditedLot;

      return {
        lot,
        expectedVersion: lot.version - 1,
        history: historyValue.make(
          lotAudit,
          payload.actor,
          repoOptions.correlationId
        ),
      };
    });
    const [disposition, dispositionEvents, dispositionAudit] =
      domainResult.disposition;

    return {
      records: {
        lots,
        disposition,
        dispositionHistory: historyValue.make(
          dispositionAudit,
          payload.actor,
          repoOptions.correlationId
        ),
        allocations: domainResult.allocations,
        missingOfficialRateOutbox: makeMissingOfficialRateOutbox(
          payload,
          repoOptions,
          {
            ...disposition,
            effectiveDate: disposition.dispositionDate,
          },
          EMissingOfficialFxRateEffectKind.Disposition
        ),
      },
      events: [
        ...domainResult.lots.flatMap(([, events]) => events),
        ...dispositionEvents,
      ],
    };
  };
}

/**
 * Prepares versioned lot updates that reverse the FX effects associated with a
 * journal entry. The caller owns persistence and transaction ordering.
 */
function makeReverse(deps: IDependencies): IFxLotAppService['reverse'] {
  return async (journalEntryId, actor, repoOptions) => {
    const domainResult = await deps.fxCostBasisLotService.reverse(
      journalEntryId,
      repoOptions
    );

    if (!domainResult) return null;

    return {
      records: {
        lots: domainResult.lots.map(([lot, , audit]) => ({
          lot,
          expectedVersion: lot.version - 1,
          history: historyValue.make(audit, actor, repoOptions.correlationId),
        })),
      },
      events: domainResult.lots.flatMap(([, events]) => events),
    };
  };
}

/**
 * Constructs the immutable FX lot application preparation capability.
 */
export default function makeFxLotAppService(
  deps: IDependencies
): IFxLotAppService {
  return Object.freeze({
    reverse: makeReverse(deps),
    acquire: makeAcquire(deps),
    dispose: makeDispose(deps),
  });
}
