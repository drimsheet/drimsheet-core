import launchDarklyClient from '@infra/integrations/launchdarkly/launchdarkly.client';
import featureFlagService from '@infra/services/feature-flag.service';

jest.mock('@infra/integrations/launchdarkly/launchdarkly.client', () => ({
  __esModule: true,
  default: {
    boolVariation: jest.fn(),
  },
}));

describe('feature flag service', () => {
  const client = jest.mocked(launchDarklyClient);

  beforeEach(() => {
    client.boolVariation.mockReset();
  });

  it('evaluates the requested flag with private email targeting', async () => {
    const email = 'user@example.com';
    client.boolVariation.mockResolvedValue(true);

    await expect(
      featureFlagService.isEnabled('requested-flag', { email }, false)
    ).resolves.toBe(true);
    expect(client.boolVariation).toHaveBeenCalledWith(
      'requested-flag',
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

  it.each([true, false])(
    'passes the %s fallback to LaunchDarkly and returns its result',
    async (defaultValue) => {
      client.boolVariation.mockResolvedValue(defaultValue);

      await expect(
        featureFlagService.isEnabled(
          'requested-flag',
          { email: 'user@example.com' },
          defaultValue
        )
      ).resolves.toBe(defaultValue);
      expect(client.boolVariation).toHaveBeenCalledWith(
        'requested-flag',
        expect.objectContaining({ key: 'user@example.com' }),
        defaultValue
      );
    }
  );

  it('propagates provider failures', async () => {
    const error = new Error('Flag evaluation failed');
    client.boolVariation.mockRejectedValue(error);

    await expect(
      featureFlagService.isEnabled(
        'requested-flag',
        { email: 'user@example.com' },
        false
      )
    ).rejects.toBe(error);
  });
});
