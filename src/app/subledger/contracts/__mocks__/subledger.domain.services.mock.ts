import IFxCostBasisLotService from '@domain/subledger/fx-cost-basis/types/lot.service.types';

export const mockFxCostBasisLotService: jest.Mocked<IFxCostBasisLotService> = {
  reverse: jest.fn(),
  acquire: jest.fn(),
  dispose: jest.fn(),
};
