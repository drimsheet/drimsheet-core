import IActorHistoryRepo from '@domain/user/repos/actor-history.repo';
import IActorRepo from '@domain/user/repos/actor.repo';
import IUserHistoryRepo from '@domain/user/repos/user-history.repo';
import IUserRepo from '@domain/user/repos/user.repo';

import IUserPreferencesRepo from '@app/user/contracts/user-preferences.repo.contract';

export const mockUserHistoryRepo: jest.Mocked<IUserHistoryRepo> = {
  save: jest.fn(),
};

export const mockUserPreferencesRepo: jest.Mocked<IUserPreferencesRepo> = {
  clearAccountingEntity: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
};

export const mockUserRepo: jest.Mocked<IUserRepo> = {
  create: jest.fn(),
  update: jest.fn(),
  findByEmail: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
};

export const mockActorRepo: jest.Mocked<IActorRepo> = {
  create: jest.fn(),
  findById: jest.fn(),
  findByUsername: jest.fn(),
};
export const mockActorHistoryRepo: jest.Mocked<IActorHistoryRepo> = {
  save: jest.fn(),
};
