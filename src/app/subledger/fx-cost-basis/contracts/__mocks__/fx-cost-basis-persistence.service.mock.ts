import IFxCostBasisPersistenceAppService from '@app/subledger/fx-cost-basis/contracts/fx-cost-basis-persistence.service.contract';

const persistence: jest.Mocked<IFxCostBasisPersistenceAppService> = {
  persistAcquisition: jest.fn(),
  persistDisposition: jest.fn(),
  persistReversal: jest.fn(),
};

const mockFxLotCostBasisAppService = Object.freeze({
  persistence,
});

export default mockFxLotCostBasisAppService;
