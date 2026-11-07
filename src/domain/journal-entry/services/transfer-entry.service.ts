import IAccountingPeriodService from '@domain/accounting/types/accounting-period.service.types';
import journalEntryEntity from '@domain/journal-entry/entities/journal-entry.entity';
import journalEntryError from '@domain/journal-entry/errors/journal-entry.error';
import getJournalEntryLinesHelper from '@domain/journal-entry/services/helpers/get-journal-entry-lines.helper';
import journalEntryServiceValidation from '@domain/journal-entry/services/validations/journal-entry.validation';
import { IJournalEntryHeaderPayload } from '@domain/journal-entry/types/journal-entry.service.types';
import {
  EJournalEntrySourceType,
  EJournalEntryStatus,
} from '@domain/journal-entry/types/journal-entry.types';
import {
  EJournalSide,
  IJournalLineMakePayload,
} from '@domain/journal-entry/types/journal-line.types';
import { ITransferEntryService } from '@domain/journal-entry/types/transfer-entry.service.types';
import ILedgerAccountBalanceRepo from '@domain/ledger/repos/ledger-account-balance.repo';
import currencyEntity from '@domain/money/entities/currency.entity';

interface IDependencies {
  accountingPeriodService: IAccountingPeriodService;
  ledgerAccountBalanceRepo: ILedgerAccountBalanceRepo;
}

/**
 * Builds an audited transfer with its destination asset account. Checks the
 * source balance when the transfer is created as posted.
 */
function makeCreate(deps: IDependencies): ITransferEntryService['create'] {
  return async (payload, repoOptions) => {
    const { header, sourceLine, destinationLines, attachments } = payload;
    const journalLines = [sourceLine, ...destinationLines];

    journalEntryServiceValidation.validateTransferAccountComposition(
      sourceLine.account,
      destinationLines
    );

    const destinationAssetAccount = destinationLines.find((line) =>
      journalEntryServiceValidation.isTransferAssetAccount(line.account)
    )!.account;

    if (sourceLine.account.id === destinationAssetAccount.id) {
      throw new journalEntryError.DuplicateAccountsNotPermitted({
        accountIds: [sourceLine.account.id, destinationAssetAccount.id],
      });
    }

    journalEntryServiceValidation.validateAccounts(header, journalLines);

    const shouldValidateSourceBalance = header.postedAt !== null;

    if (shouldValidateSourceBalance) {
      const sourceAccountBalance =
        await deps.ledgerAccountBalanceRepo.findByAccountId(
          sourceLine.account.id,
          header.accountingEntityId,
          repoOptions
        );
      journalEntryServiceValidation.validateSourceAccountBalance(
        sourceLine.account.id,
        sourceLine.amount,
        sourceAccountBalance
      );
    }

    await deps.accountingPeriodService.validatePostingPeriod(
      header.accountingEntityId,
      header.effectiveDate,
      repoOptions
    );

    journalEntryServiceValidation.validateCounterparties(
      header,
      destinationLines
    );

    const functionalCurrency = currencyEntity.getByCode(
      header.functionalCurrencyCode
    );
    const sourceLinePayload: IJournalLineMakePayload = {
      accountId: sourceLine.account.id,
      counterpartyId: null,
      sequenceOrder: sourceLine.sequenceOrder,
      amount: sourceLine.amount,
      exchangeRate: sourceLine.exchangeRate,
      side: EJournalSide.Credit,
      description: sourceLine.description,
      functionalCurrency,
    };
    const destinationLinePayloads: IJournalLineMakePayload[] =
      destinationLines.map((line) => ({
        accountId: line.account.id,
        counterpartyId: line.counterparty?.id,
        sequenceOrder: line.sequenceOrder,
        amount: line.amount,
        exchangeRate: line.exchangeRate,
        description: line.description,
        functionalCurrency,
        side: EJournalSide.Debit,
      }));

    const journalEntry = journalEntryEntity.make({
      accountingEntityId: header.accountingEntityId,
      sourceType: EJournalEntrySourceType.Transfer,
      effectiveDate: header.effectiveDate,
      postedAt: header.postedAt,
      memo: header.memo,
      createdBy: header.createdBy,
      functionalCurrency,
      attachments,
      lines: [sourceLinePayload, ...destinationLinePayloads],
    });

    return { journalEntry, destinationAssetAccount };
  };
}

/**
 * Revalidates current transfer participants and the effective posting period
 * before preparing an audited posting that preserves the draft's identity.
 */
function makePostDraft(
  deps: IDependencies
): ITransferEntryService['postDraft'] {
  return async ({ entry, accounts, counterparties, actor }, repoOptions) => {
    const isDraftTransfer =
      entry.sourceType === EJournalEntrySourceType.Transfer &&
      entry.status === EJournalEntryStatus.Draft &&
      entry.postedAt === null;
    if (!isDraftTransfer) {
      throw new journalEntryError.RectificationNotPermitted({
        journalEntryId: entry.id,
        sourceType: entry.sourceType,
        status: entry.status,
      });
    }

    const journalLines = getJournalEntryLinesHelper(
      entry.lines,
      accounts,
      counterparties
    );
    const sourceLines = journalLines.filter(
      (line) => line.side === EJournalSide.Credit
    );
    const destinationLines = journalLines.filter(
      (line) => line.side === EJournalSide.Debit
    );
    if (sourceLines.length !== 1) {
      throw new journalEntryError.InvalidSourceType({
        journalEntryId: entry.id,
      });
    }
    const sourceLine = sourceLines[0];
    const postingDate = new Date();
    const header: IJournalEntryHeaderPayload = {
      accountingEntityId: entry.accountingEntityId,
      effectiveDate: entry.effectiveDate,
      postedAt: postingDate,
      memo: entry.memo,
      createdBy: entry.createdBy,
      functionalCurrencyCode: sourceLine.functionalAmount.currency.code,
    };

    journalEntryServiceValidation.validateTransferAccountComposition(
      sourceLine.account,
      destinationLines
    );
    const destinationAssetAccount = destinationLines.find((line) =>
      journalEntryServiceValidation.isTransferAssetAccount(line.account)
    )!.account;
    if (sourceLine.account.id === destinationAssetAccount.id) {
      throw new journalEntryError.DuplicateAccountsNotPermitted({
        accountIds: [sourceLine.account.id, destinationAssetAccount.id],
      });
    }

    journalEntryServiceValidation.validateAccounts(header, journalLines);
    journalEntryServiceValidation.validateCounterparties(header, journalLines);

    const sourceBalance = await deps.ledgerAccountBalanceRepo.findByAccountId(
      sourceLine.account.id,
      entry.accountingEntityId,
      repoOptions
    );
    journalEntryServiceValidation.validateSourceAccountBalance(
      sourceLine.account.id,
      sourceLine.amount,
      sourceBalance
    );

    await deps.accountingPeriodService.validatePostingPeriod(
      entry.accountingEntityId,
      entry.effectiveDate,
      repoOptions
    );

    const entryUpdateInput = {
      id: entry.id,
      status: EJournalEntryStatus.Posted,
      postedAt: postingDate,
    };

    const updatedEntry = journalEntryEntity.update(
      entry,
      entryUpdateInput,
      actor
    );

    return {
      journalEntry: updatedEntry,
      sourceAccount: sourceLine.account,
      destinationAssetAccount,
    };
  };
}

/** Voids a transfer and prepares a posted replacement on its effective date. */
function makeVoidAndReplace(
  create: ITransferEntryService['create']
): ITransferEntryService['voidAndReplace'] {
  return async (
    { entry, voidingEntryId, sourceLine, destinationLines, createdBy },
    repoOptions
  ) => {
    if (entry.sourceType !== EJournalEntrySourceType.Transfer) {
      throw new journalEntryError.RectificationNotPermitted({
        journalEntryId: entry.id,
        sourceType: entry.sourceType,
      });
    }

    const voided = journalEntryEntity.void(entry, { voidingEntryId });
    const [, , audit] = voided;

    if (audit === null) {
      return { voided, replacement: null };
    }

    const replacement = await create(
      {
        header: {
          accountingEntityId: entry.accountingEntityId,
          effectiveDate: entry.effectiveDate,
          postedAt: new Date(),
          memo: entry.memo,
          functionalCurrencyCode: entry.lines[0].functionalAmount.currency.code,
          createdBy,
        },
        sourceLine,
        destinationLines,
        attachments: entry.attachments,
      },
      repoOptions
    );

    return { voided, replacement };
  };
}

export default function makeTransferEntryService(
  deps: IDependencies
): ITransferEntryService {
  const create = makeCreate(deps);
  const service: ITransferEntryService = {
    create,
    postDraft: makePostDraft(deps),
    voidAndReplace: makeVoidAndReplace(create),
  };

  return Object.freeze(service);
}
