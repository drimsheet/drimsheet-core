import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';

const mockLedgerAccountPersistenceService: jest.Mocked<ILedgerAccountPersistenceService> =
  { create: jest.fn() };

export default mockLedgerAccountPersistenceService;
