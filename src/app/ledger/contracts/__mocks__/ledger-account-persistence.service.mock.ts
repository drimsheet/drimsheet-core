import ILedgerAccountPersistenceAppService from '@app/ledger/contracts/ledger-account-persistence.service.contract';

const mockLedgerAccountPersistenceAppService: jest.Mocked<ILedgerAccountPersistenceAppService> =
  { create: jest.fn() };

export default mockLedgerAccountPersistenceAppService;
