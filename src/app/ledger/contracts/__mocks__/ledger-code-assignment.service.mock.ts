import ILedgerCodeAssignmentAppService from '@app/ledger/contracts/ledger-code-assignment.service.contract';

const mockLedgerCodeAssignmentAppService: jest.Mocked<ILedgerCodeAssignmentAppService> =
  {
    assign: jest.fn(),
  };

export default mockLedgerCodeAssignmentAppService;
