import { strict as assert } from 'assert';
import migration56 from './056';

describe('migration #56', function () {
  it('should update the version metadata', async function () {
    const oldStorage = {
      meta: {
        version: 55,
      },
      data: {},
    };

    const newStorage = await migration56.migrate(oldStorage);
    assert.deepEqual(newStorage.meta, {
      version: 56,
    });
  });

  it('should transactions array into an object keyed by id', async function () {
    const oldStorage = {
      meta: {},
      data: {
        TransactionController: {
          transactions: [
            {
              id: 0,
              txParams: { foo: 'bar' },
            },
            {
              id: 1,
              txParams: { foo: 'bar' },
            },
            {
              id: 2,
              txParams: { foo: 'bar' },
            },
            {
              id: 3,
              txParams: { foo: 'bar' },
            },
          ],
        },
        foo: 'bar',
      },
    };

    const newStorage = await migration56.migrate(oldStorage);
    assert.deepEqual(newStorage.data, {
      TransactionController: {
        transactions: {
          0: {
            id: 0,
            txParams: { foo: 'bar' },
          },
          1: {
            id: 1,
            txParams: { foo: 'bar' },
          },
          2: {
            id: 2,
            txParams: { foo: 'bar' },
          },
          3: { id: 3, txParams: { foo: 'bar' } },
        },
      },
      foo: 'bar',
    });
  });

  it('should do nothing if transactions state does not exist', async function () {
    const oldStorage = {
      meta: {},
      data: {
        TransactionController: {
          bar: 'baz',
        },
        foo: 'bar',
      },
    };

    const newStorage = await migration56.migrate(oldStorage);
    assert.deepEqual(oldStorage.data, newStorage.data);
  });

  it('should convert empty array into empty object', async function () {
    const oldStorage = {
      meta: {},
      data: {
        TransactionController: {
          transactions: [],
          bar: 'baz',
        },
        foo: 'bar',
      },
    };

    const newStorage = await migration56.migrate(oldStorage);
    assert.deepEqual(newStorage.data, {
      TransactionController: {
        transactions: {},
        bar: 'baz',
      },
      foo: 'bar',
    });
  });

  it('should do nothing if state is empty', async function () {
    const oldStorage = {
      meta: {},
      data: {},
    };

    const newStorage = await migration56.migrate(oldStorage);
    assert.deepEqual(oldStorage.data, newStorage.data);
  });
});
