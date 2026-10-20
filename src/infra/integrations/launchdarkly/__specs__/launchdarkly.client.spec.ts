import { init } from '@launchdarkly/node-server-sdk';

import launchDarklyClient from '@infra/integrations/launchdarkly/launchdarkly.client';

jest.mock('@launchdarkly/node-server-sdk', () => ({
  init: jest.fn(() => 'launchdarkly-client'),
}));

jest.mock('@infra/config/vars.config', () => ({
  __esModule: true,
  default: { LAUNCHDARKLY_SDK_KEY: 'test-sdk-key' },
}));

describe('LaunchDarkly client', () => {
  it('defers client creation until first use and reuses the initialized client', () => {
    expect(init).not.toHaveBeenCalled();
    expect(launchDarklyClient.getInitialized()).toBeUndefined();
    expect(launchDarklyClient.get()).toBe('launchdarkly-client');
    expect(launchDarklyClient.get()).toBe('launchdarkly-client');
    expect(launchDarklyClient.getInitialized()).toBe('launchdarkly-client');
    expect(init).toHaveBeenCalledTimes(1);
    expect(init).toHaveBeenCalledWith('test-sdk-key');
  });
});
