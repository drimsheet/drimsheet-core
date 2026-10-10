import ILedgerAccountBalanceEnrichmentAppService from '@app/ledger/contracts/ledger-account-balance-enrichment.service.contract';

const mockLedgerAccountBalanceEnrichmentAppService: jest.Mocked<ILedgerAccountBalanceEnrichmentAppService> =
  { enrich: jest.fn() };

export default mockLedgerAccountBalanceEnrichmentAppService;
