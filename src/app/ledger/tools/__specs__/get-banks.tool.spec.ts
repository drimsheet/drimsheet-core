import appError from '@shared/values/errors/app.error';

import makeGetBanksTool from '@app/ledger/tools/get-banks.tool';

type TUseCase = Parameters<typeof makeGetBanksTool>[0]['usecase'];

describe('bank directory tool', () => {
  const usecase = jest.fn<ReturnType<TUseCase>, Parameters<TUseCase>>();
  beforeEach(() => jest.resetAllMocks());

  it('passes parsed input to the injected use case and returns application data', async () => {
    const banks: Awaited<ReturnType<TUseCase>> = [];
    usecase.mockResolvedValue(banks);
    const tool = makeGetBanksTool({ usecase });
    const input = tool.inputSchema.parse({ countryCode: 'ng' });

    const response = await tool.func(input);

    expect(usecase).toHaveBeenCalledTimes(1);
    expect(usecase).toHaveBeenCalledWith({ countryCode: 'NG' });
    expect(response.data).toBe(banks);
  });

  it('propagates failures unchanged for the caller to handle', async () => {
    const error = new appError.BadRequest();
    usecase.mockRejectedValue(error);
    const tool = makeGetBanksTool({ usecase });

    await expect(
      tool.func(tool.inputSchema.parse({ countryCode: 'NG' }))
    ).rejects.toBe(error);
  });
});
