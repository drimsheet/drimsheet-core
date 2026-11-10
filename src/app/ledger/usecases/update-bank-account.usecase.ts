/**
 * SUMMARY
 * Updates a bank account's name, currency, bank details, or opening balance in
 * the selected entity. Currency changes and opening-journal changes undergo
 * their own eligibility checks. Creates or revises an eligible opening journal
 * when requested. Saves account, bank-detail, balance-denomination, journal,
 * audit, and applicable FX changes together. Publishes events, requests any
 * balance propagation, and returns the account with opening-journal or balance
 * information.
 *
 * WHEN TO USE
 * Use to maintain bank-account setup. A currency eligibility preview is
 * advisory; this operation also checks journal references and hierarchy
 * compatibility.
 *
 * SEQUENCE DIAGRAM
 * @see ./__docs__/update-bank-account.sequence.md
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import IEventBus from '@shared/contracts/event-bus.contract';
import { IRepoService } from '@shared/contracts/repo.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';
import zodValidationRunner from '@shared/utils/zod-validation-runner';
import eventValue from '@shared/values/events/event.vo';
import { IEvent } from '@shared/values/events/types/event.types';
import historyValue from '@shared/values/history/history.vo';

import IJournalEntryRepo from '@domain/journal-entry/repos/journal-entry.repo';
import { EJournalEntryStatus } from '@domain/journal-entry/types/journal-entry.types';
import { IOpeningBalanceEntryService } from '@domain/journal-entry/types/opening-balance-entry.service.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import IBankAccountRepo from '@domain/ledger/repos/bank-account.repo';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';
import ICashAccountService from '@domain/ledger/types/cash-account.service.types';
import ILedgerAccountBalanceService from '@domain/ledger/types/ledger-account-balance.service.types';
import currencyEntity from '@domain/money/entities/currency.entity';
import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryPersistenceAppService from '@app/journal-entry/contracts/journal-entry-persistence.service.contract';
import getJournalEntryPersistencePayloadHelper from '@app/journal-entry/usecases/helpers/get-journal-entry-persistence-payload.helper';
import ILedgerBalanceAdjustmentQueue from '@app/ledger/contracts/ledger-balance-adjustment-queue.contract';
import { IBankAccountUpdateReq } from '@app/ledger/dtos/asset-account/asset-account.dto';
import { bankAccountUpdateReqValidation } from '@app/ledger/dtos/asset-account/asset-account.dto.validation';
import { ILedgerAccountDto } from '@app/ledger/dtos/ledger-account/ledger-account.dto';
import ledgerAppError from '@app/ledger/errors/ledger.error';
import ledgerAccountToDtoMapperHelper from '@app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper';
import loadLedgerAccountDtosWithBalancesHelper from '@app/ledger/usecases/helpers/load-ledger-account-dtos-with-balances.helper';
import openingBalanceExchangeRateGetterHelper from '@app/ledger/usecases/helpers/opening-balance-exchange-rate-getter.helper';
import prepareOpeningBalanceEditHelper from '@app/ledger/usecases/helpers/prepare-opening-balance-edit.helper';
import IExchangeRateAppService from '@app/money/contracts/exchange-rate.service.contract';
import moneyMapper from '@app/money/dtos/money/money.dto.mapper';
import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';
import getFxLotEventsHelper from '@app/subledger/fx-cost-basis/get-fx-lot-events.helper';
import resolveOfficialRateHelper from '@app/subledger/fx-cost-basis/resolve-official-rate.helper';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  eventBus: IEventBus;
  repoService: IRepoService;
  ledgerAccountRepo: ILedgerAccountRepo;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
  ledgerAccountBalanceService: ILedgerAccountBalanceService;
  bankAccountRepo: IBankAccountRepo;
  cashAccountService: ICashAccountService;
  journalEntryRepo: IJournalEntryRepo;
  openingBalanceEntryService: IOpeningBalanceEntryService;
  fxCostBasisLotService: IFxCostBasisLotService;
  exchangeRateAppService: IExchangeRateAppService;
  journalEntryPersistenceAppService: IJournalEntryPersistenceAppService;
  fxCostBasisPersistenceAppService: IFxCostBasisPersistenceAppService;
  ledgerBalanceAdjustmentQueue: ILedgerBalanceAdjustmentQueue;
}

export default function makeUpdateBankAccountUsecase(
  deps: Readonly<IDependencies>
) {
  return async (
    id: string,
    payload: IBankAccountUpdateReq
  ): Promise<ILedgerAccountDto> => {
    stringUtils.validateUUID(id, ledgerAccountError.InvalidId);
    zodValidationRunner(bankAccountUpdateReqValidation, payload);

    const { actor, accountingEntity, correlationId, idempotencyKey } =
      deps.appContext.get(['actor', 'accountingEntity']);

    const repoOptions = { correlationId };

    const currency =
      payload.currencyCode === undefined
        ? undefined
        : currencyEntity.getByCode(payload.currencyCode);

    const transaction = await deps.repoService.createTransaction();

    try {
      const transactionOptions = { ...repoOptions, tx: transaction.context };

      const updatePayload = {
        id: id as TEntityId,
        accountingEntityId: accountingEntity.id,
        currency,
        name: payload.name,
        openingBalanceDate: payload.openingBalance?.date,
        bankDetails: payload.bankAccount,
      };
      const update = await deps.cashAccountService.updateBankSubAccount(
        updatePayload,
        transactionOptions
      );

      const [account, accountEvents, accountAudit] = update;
      const existingAccount = accountAudit?.diff.before ?? account;

      const openingBalance = payload.openingBalance;
      const openingBalanceEntryMutation = openingBalance
        ? await prepareOpeningBalanceEditHelper(
            deps,
            {
              accountingEntityId: accountingEntity.id,
              functionalCurrencyCode: accountingEntity.functionalCurrencyCode,
              account,
              amount: moneyMapper.fromDto(openingBalance.amount),
              effectiveDate: openingBalance.date,
              exchangeRate:
                openingBalanceExchangeRateGetterHelper(openingBalance),
              createdBy: actor.id,
            },
            transactionOptions
          )
        : null;

      const journalEntry = openingBalanceEntryMutation?.currentJournalEntry;
      const postedJournal =
        journalEntry?.status === EJournalEntryStatus.Posted
          ? journalEntry
          : null;
      const fxAcquisition = postedJournal
        ? deps.fxCostBasisLotService.acquire({
            journalEntry: postedJournal,
            account,
            createdBy: actor.id,
            officialRate: await resolveOfficialRateHelper(
              deps.exchangeRateAppService,
              postedJournal.lines,
              account.id,
              transactionOptions
            ),
          })
        : null;

      const accountAudits = accountAudit ? [accountAudit] : [];
      for (const currentAccountAudit of accountAudits) {
        // The account lock protects this read and write until the transaction commits.
        const existingBalance =
          await deps.ledgerAccountBalanceRepo.findByAccountId(
            account.id,
            accountingEntity.id,
            transactionOptions
          );
        if (!existingBalance) {
          throw new ledgerAppError.BalanceNotFound();
        }

        const balance = deps.ledgerAccountBalanceService.updateBalance({
          existingAccount,
          updatedAccount: account,
          existingBalance,
        });
        if (balance !== existingBalance) {
          await deps.ledgerAccountBalanceRepo.update(balance, {
            ...transactionOptions,
            expectedVersion: existingBalance.version,
          });
        }

        await deps.ledgerAccountRepo.update(account, {
          ...transactionOptions,
          expectedVersion: existingAccount.version,
          history: historyValue.make(
            currentAccountAudit,
            actor.id,
            correlationId
          ),
        });
      }

      const shouldPersistBankDetails = Boolean(
        accountAudit && payload.bankAccount
      );
      if (shouldPersistBankDetails) {
        await deps.bankAccountRepo.update(
          account.id,
          accountingEntity.id,
          account.meta,
          transactionOptions
        );
      }

      if (
        openingBalanceEntryMutation &&
        (openingBalanceEntryMutation.entryUpdate ||
          openingBalanceEntryMutation.entriesToCreate.length > 0)
      ) {
        const journalPersistencePayload =
          getJournalEntryPersistencePayloadHelper(
            openingBalanceEntryMutation,
            actor.id,
            correlationId
          );
        await deps.journalEntryPersistenceAppService.rectify(
          journalPersistencePayload,
          transactionOptions
        );
      }

      if (fxAcquisition) {
        await deps.fxCostBasisPersistenceAppService.persistAcquisition(
          fxAcquisition,
          actor.id,
          transactionOptions
        );
      }

      await transaction.commit();

      const events: IEvent<unknown>[] = [
        ...accountEvents,
        ...(openingBalanceEntryMutation?.events ?? []),
        ...getFxLotEventsHelper(fxAcquisition),
      ];
      await deps.eventBus.publish(
        eventValue.enrichAll(events, { correlationId, idempotencyKey })
      );

      if (postedJournal) {
        await deps.ledgerBalanceAdjustmentQueue.add(correlationId, {
          journalEntryId: postedJournal.id,
        });
      }

      if (openingBalanceEntryMutation) {
        return ledgerAccountToDtoMapperHelper(
          account,
          openingBalanceEntryMutation.currentJournalEntry,
          accountingEntity.functionalCurrencyCode
        );
      }

      const [response] = await loadLedgerAccountDtosWithBalancesHelper(
        deps.ledgerAccountBalanceRepo,
        [account],
        accountingEntity.id,
        repoOptions
      );
      return response;
    } catch (error) {
      return await transaction.handleError(error);
    }
  };
}
