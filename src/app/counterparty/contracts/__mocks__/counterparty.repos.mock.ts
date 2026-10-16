import ICounterpartyHistoryRepo from '@domain/counterparty/repos/counterparty-history.repo';
import ICounterpartyRepo from '@domain/counterparty/repos/counterparty.repo';

export const mockCounterpartyHistoryRepo: jest.Mocked<ICounterpartyHistoryRepo> =
  { save: jest.fn() };
export const mockCounterpartyRepo: jest.Mocked<ICounterpartyRepo> = {
  deleteByAccountingEntityId: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findAll: jest.fn(),
  findById: jest.fn(),
};
