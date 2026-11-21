import ILedgerAccountPersistenceAppService from '@app/ledger/contracts/services/ledger-account-persistence.service.contract';

const mockLedgerAccountPersistenceAppService: jest.Mocked<ILedgerAccountPersistenceAppService> =
  { create: jest.fn(), promote: jest.fn() };

export default mockLedgerAccountPersistenceAppService;
