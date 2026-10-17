import IAppContextService from '@shared/contracts/app-context.service.contract';

import { IAppContextData } from '@app/context/types/app-context.types';

export const mockClientSession = {
  setRefreshToken: jest.fn(),
  getRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
};

const mockAppContext = {
  init: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
} satisfies jest.Mocked<IAppContextService<IAppContextData>>;

export default mockAppContext;
