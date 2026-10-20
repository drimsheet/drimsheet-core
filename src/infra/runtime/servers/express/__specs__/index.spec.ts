import { Server } from 'node:http';

import setupOAuth from '@infra/integrations/oauth/google-oauth.strategy';
import setupServer from '@infra/runtime/servers/express';

const mockListen = jest.fn();

jest.mock('@infra/integrations/oauth/google-oauth.strategy', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { PORT: 3_000 },
}));
jest.mock('@interface/http/application', () => ({
  __esModule: true,
  default: jest.fn(() => ({ listen: mockListen })),
}));

describe('server setup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('configures OAuth and exposes the listening server to the runtime', () => {
    const server = new Server();
    mockListen.mockReturnValue(server);

    expect(setupServer()).toBe(server);
    expect(setupOAuth).toHaveBeenCalledTimes(1);
    expect(
      jest.requireMock('@interface/http/application').default
    ).toHaveBeenCalledWith();
    expect(mockListen).toHaveBeenCalledWith(3_000);
  });

  it('propagates synchronous setup failures', () => {
    const failure = new Error('Cannot listen');
    mockListen.mockImplementationOnce(() => {
      throw failure;
    });

    expect(setupServer).toThrow(failure);
  });
});
