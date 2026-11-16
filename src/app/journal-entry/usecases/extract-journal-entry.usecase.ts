import IAppContextService from '@shared/contracts/app-context.service.contract';
import IPdfService from '@shared/contracts/pdf.service.contract';
import { EFileAttachmentType } from '@shared/values/file-attachments/types/file-attachment.types';

import { IAppContextData } from '@app/context/types/app-context.types';
import IFileStorageClient from '@app/file/contracts/file-storage-client.contract';
import {
  IJournalEntryExtractionAiResponse,
  IJournalEntryExtractionDto,
} from '@app/journal-entry/dtos/journal-entry-extraction/journal-entry-extraction.dto';

interface IDependencies {
  appContext: IAppContextService<IAppContextData>;
  fileStorageClient: IFileStorageClient;
  pdfService: IPdfService;
  journalEntryLlmExtractor: (
    input: string
  ) => Promise<IJournalEntryExtractionAiResponse>;
}

export default function makeExtractJournalEntryUsecase(deps: IDependencies) {
  return async (payload: IJournalEntryExtractionDto) => {
    const downloadUrl = await deps.fileStorageClient.getDownloadUrl(
      payload.file.url
    );

    const pdfTextContent =
      payload.file.type === EFileAttachmentType.Pdf
        ? await deps.pdfService.convertToText(downloadUrl)
        : null;

    if (!pdfTextContent) {
      // TODO: implement other file types later
      return;
    }

    // an agent should be called here

    const extractedEntries =
      await deps.journalEntryLlmExtractor(pdfTextContent);

    /**
     * STEPS
     * - Determine upload type:
     *  - Expense/Income Receipt
     *    - determine source account
     *    - determine destination account
     *    - determine counterparty
     *    - extract info
     *    - save progress and extracted info
     
     *  - Bank Statement
     *    - determine account
     *    - row.forEach(
     *        - determine source type
     *        - determine revenue/expense/liability account
     *        - determine counterparty
     *      )
     *    - save progress
     *  - Excel Expense Sheet
     *    - Determine Source Accounts
     *
     * 
     * 
     */

    /**
     * - Determine whether all the transactions is linked to one asset/liability account
     *  - One originating account:
     *    - determine account. use `__undetermined__` for undetermined account
     *    - entries.forEach(
     *      - determine source type
     *      - determine opposite account
     *      - determine counterparty.  use suspense asset/liability for undetermined counterparty based on the source type
     *    )
     *    - save progress
     *
     *  - Multiple originating accounts:
     *    - entries.forEach(
     *      - determine originating account. use `__undetermined__` for undetermined account
     *      - determine source type
     *      - determine opposite account. use suspense asset/liability for undetermined opposite account based on the source type
     *      - determine counterparty. use suspense asset/liability for undetermined counterparty based on the source type
     *    )
     *    - save progress


      extractionResponse {
        originatingAccount: {
          value: string | __undetermined__;
          confidence: number;
        }
        hasSingleOriginatingAccount: {
          value: boolean;
          confidence: number
        },
        ledgerAccounts: {
          temporaryId: string;
          name: string;
          type: ULedgerType; 
          normalBalance: UNormalBalance;
          subType: ULedgerAccountSubType;
          behavior: ULedgerAccountBehavior;
        }[]
        counterparties: {
          temporaryId: string;
          type: UCounterpartyType;
          roles: UCounterpartyRole[];
          roleDetails: ICounterpartyRoleDetails;
        }[]
        entries: {
          temporaryId: string
          sourceType: UJournalEntrySourceType | __undetermined__
          memo: string | null;
          status: 'draft' | 'posted' | 'voided' | 'archived';
          effectiveDate: Date;
          postedAt: Date | null;
          voidedAt: Date | null;
          voidingEntryTemporaryId: string;
          functionalCurrencyCode: string;
          lines: {
            temporaryId: string;
            accountTemporary: string;
            sequenceOrder: number;
            amount: IMoneyDto;
            exchangeRate: IExchangeRateDto;
            side: UJournalSide;
            description: string;
            counterpartyTemporaryId: string;
            functionalCurrency: IMoneyDto;
          }[]
        }[]
      }

     */
    console.log('>>>>>>>>>>>>>>>>', pdfTextContent);

    return await Promise.resolve();
  };
}
