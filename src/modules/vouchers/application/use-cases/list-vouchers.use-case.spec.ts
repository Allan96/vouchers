import { Voucher } from '../../domain/entities/voucher.js';
import { InMemoryVoucherRepository } from '../../infrastructure/persistence/in-memory/in-memory-voucher.repository.js';
import { ListVouchersUseCase } from './list-vouchers.use-case.js';

describe('ListVouchersUseCase', () => {
  let vouchers: InMemoryVoucherRepository;
  let useCase: ListVouchersUseCase;

  beforeEach(() => {
    vouchers = new InMemoryVoucherRepository();
    useCase = new ListVouchersUseCase(vouchers);
  });

  it('returns an empty list when there is no voucher', async () => {
    await expect(useCase.execute()).resolves.toEqual([]);
  });

  it('returns the vouchers as output DTOs', async () => {
    vouchers.add(
      Voucher.create({
        uuid: 'ff4b6e1c-6a4a-4f9e-9b6c-0f1d2e3a4b5c',
        code: 'WELCOME10',
        value: 10,
        limit: 5,
        userLimit: 1,
        restriction: { firstPurchaseOnly: true },
      }),
    );

    const [output] = await useCase.execute();

    expect(output).toMatchObject({
      uuid: 'ff4b6e1c-6a4a-4f9e-9b6c-0f1d2e3a4b5c',
      code: 'WELCOME10',
      value: 10,
      limit: 5,
      userLimit: 1,
      restriction: { firstPurchaseOnly: true },
    });
  });

  it('skips soft-deleted vouchers', async () => {
    vouchers.add(
      Voucher.restore({
        uuid: 'ff4b6e1c-6a4a-4f9e-9b6c-0f1d2e3a4b5c',
        code: 'EXPIRED',
        value: 10,
        limit: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      }),
    );

    await expect(useCase.execute()).resolves.toEqual([]);
  });
});
