import ILedgerBalancePropagationPreparationAppService from '@app/ledger/contracts/ledger-balance-propagation-preparation.service.contract';

const mockLedgerBalancePropagationPreparationAppService: jest.Mocked<ILedgerBalancePropagationPreparationAppService> =
  { prepare: jest.fn() };

export default mockLedgerBalancePropagationPreparationAppService;
