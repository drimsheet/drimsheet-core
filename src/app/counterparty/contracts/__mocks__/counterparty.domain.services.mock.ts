import ICounterpartyService from '@domain/counterparty/types/counterparty.service.types';

export const mockCounterpartyService: jest.Mocked<ICounterpartyService> = {
  create: jest.fn(),
  update: jest.fn(),
};
