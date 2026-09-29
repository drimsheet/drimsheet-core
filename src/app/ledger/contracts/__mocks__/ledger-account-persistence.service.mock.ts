import ILedgerAccountPersistenceService from '@app/ledger/contracts/ledger-account-persistence.service.contract';

const mockLedgerAccountPersistenceService: jest.Mocked<ILedgerAccountPersistenceService> =
  { createWithoutAssigningCode: jest.fn(), createAndAssignCode: jest.fn() };

export default mockLedgerAccountPersistenceService;
