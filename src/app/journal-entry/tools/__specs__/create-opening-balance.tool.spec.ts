import appError from '@shared/values/errors/app.error';

import makeCreateOpeningBalanceTool from '@app/journal-entry/tools/create-opening-balance.tool';

type TUseCase = Parameters<typeof makeCreateOpeningBalanceTool>[0]['usecase'];

describe('opening balance tool', () => {
  const usecase = jest.fn<ReturnType<TUseCase>, Parameters<TUseCase>>();
  const payload = {
    accountId: 'a1111111-1111-4111-8111-111111111111',
    amount: { amount: 12500, currencyCode: 'NGN', isMinorUnit: true },
    date: '2026-01-01T00:00:00.000Z',
    exchangeRate: null,
  };
  beforeEach(() => jest.resetAllMocks());

  it('acknowledges completion only after the injected use case resolves', async () => {
    let complete!: () => void;
    usecase.mockReturnValue(
      new Promise<undefined>((resolve) => {
        complete = () => resolve(undefined);
      })
    );
    const tool = makeCreateOpeningBalanceTool({ usecase });
    const input = tool.inputSchema.parse(payload);
    const settled = jest.fn();
    const execution = Promise.resolve(tool.func(input)).then(settled);
    await Promise.resolve();

    expect(settled).not.toHaveBeenCalled();
    expect(usecase).toHaveBeenCalledWith(input);
    expect(input.date).toBeInstanceOf(Date);

    complete();
    await execution;
    expect(settled).toHaveBeenCalledWith({ success: true });
  });

  it('propagates failure instead of acknowledging success', async () => {
    const error = new appError.BadRequest();
    usecase.mockRejectedValue(error);
    const tool = makeCreateOpeningBalanceTool({ usecase });

    await expect(tool.func(tool.inputSchema.parse(payload))).rejects.toBe(
      error
    );
  });
});
