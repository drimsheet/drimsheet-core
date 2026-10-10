import featureFlagAppService from '@infra/integrations/launchdarkly/launchdarkly-feature-flag.service';
import launchDarklyClient from '@infra/integrations/launchdarkly/launchdarkly.client';

jest.mock('@infra/integrations/launchdarkly/launchdarkly.client', () => ({
  __esModule: true,
  default: {
    boolVariation: jest.fn(),
  },
}));

describe('LaunchDarkly feature flag service', () => {
  const client = jest.mocked(launchDarklyClient);

  beforeEach(() => {
    client.boolVariation.mockReset();
  });

  it('evaluates Alpha 1 access for the user', async () => {
    const email = 'user@example.com';
    client.boolVariation.mockResolvedValue(true);

    await expect(
      featureFlagAppService.canAccessAlpha1({ email })
    ).resolves.toBe(true);
    expect(client.boolVariation).toHaveBeenCalledWith(
      'v_0_1_0_alpha_1',
      {
        kind: 'user',
        key: email,
        email,
        _meta: {
          privateAttributes: ['email'],
        },
      },
      false
    );
  });

  it('returns the false fallback from LaunchDarkly', async () => {
    client.boolVariation.mockResolvedValue(false);

    await expect(
      featureFlagAppService.canAccessAlpha1({ email: 'user@example.com' })
    ).resolves.toBe(false);
  });
});
