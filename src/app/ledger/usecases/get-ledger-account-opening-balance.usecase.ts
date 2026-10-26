/**
 * SUMMARY
 * Retrieves the current opening-balance amount, date, and exchange rate for an
 * account in the selected entity. Considers current draft or posted opening
 * journals, excluding voided originals. Returns openingBalance as null if no
 * matching opening line exists; rejects a missing account.
 *
 * WHEN TO USE
 * Use to display opening-balance setup separately from the account's current
 * running balance.
 *
 * SEQUENCE DIAGRAM
 * Not required for this straightforward workflow.
 */

import IAppContextService from '@shared/contracts/app-context.service.contract';
import { TEntityId } from '@shared/types/uuid';
import stringUtils from '@shared/utils/string';

import { EJournalEntrySourceType } from '@domain/journal-entry/types/journal-entry.types';
import ledgerAccountError from '@domain/ledger/errors/ledger-account.error';
import ILedgerAccountRepo from '@domain/ledger/repos/ledger-account.repo';

import { IAppContextData } from '@app/context/types/app-context.types';
import IJournalEntryQueryRepo from '@app/journal-entry/contracts/journal-entry.query.repo.contract';
import { ILedgerAccountOpeningBalanceDto } from '@app/ledger/dtos/ledger-account-opening-balance/ledger-account-opening-balance.dto';
import ledgerAccountOpeningBalanceDtoMapper from '@app/ledger/dtos/ledger-account-opening-balance/ledger-account-opening-balance.dto.mapper';
import ledgerAppError from '@app/ledger/errors/ledger.error';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  ledgerAccountRepo: ILedgerAccountRepo;
  journalEntryQueryRepo: IJournalEntryQueryRepo;
}

export default function makeGetLedgerAccountOpeningBalanceUsecase(
  deps: IDependencies
) {
  return async (
    accountId: TEntityId
  ): Promise<ILedgerAccountOpeningBalanceDto> => {
    stringUtils.validateUUID(accountId, ledgerAccountError.InvalidId);
    const { correlationId, accountingEntity } = deps.appContext.get([
      'accountingEntity',
    ]);
    const account = await deps.ledgerAccountRepo.findById(
      accountId,
      accountingEntity.id,
      { correlationId }
    );
    if (!account) {
      throw new ledgerAppError.AccountNotFound();
    }

    // The query defaults to current draft/posted entries, excluding voided originals.
    const entries = await deps.journalEntryQueryRepo.findAll(
      accountingEntity.id,
      {
        correlationId,
        accountId: account.id,
        sourceType: EJournalEntrySourceType.OpeningBalance,
        limit: 1,
      }
    );
    return ledgerAccountOpeningBalanceDtoMapper.toDto(
      entries.data[0],
      account.id
    );
  };
}
