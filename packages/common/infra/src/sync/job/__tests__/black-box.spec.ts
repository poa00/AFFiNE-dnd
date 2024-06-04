/**
 * @vitest-environment happy-dom
 */
import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, test, vitest } from 'vitest';

import { IndexedDBJobQueue } from '../impl/indexeddb';
import type { JobQueue } from '../queue';

let queue: JobQueue<{
  a: string;
}> = null!;

describe.each([{ name: 'idb', backend: IndexedDBJobQueue }])(
  'impl tests($name)',
  ({ backend }) => {
    beforeEach(async () => {
      queue = new backend();
      await queue.initialize(true);

      vitest.useFakeTimers({
        toFake: ['Date'],
      });
    });

    afterEach(() => {
      vitest.useRealTimers();
    });

    test('basic', async () => {
      await queue.enqueue([
        {
          batchKey: '1',
          payload: { a: 'hello' },
        },
        {
          batchKey: '2',
          payload: { a: 'world' },
        },
      ]);
      const job1 = await queue.accept();
      const job2 = await queue.accept();

      expect([...job1!, ...job2!]).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            batchKey: '1',
            payload: { a: 'hello' },
          },
          {
            id: expect.any(String),
            batchKey: '2',
            payload: { a: 'world' },
          },
        ])
      );

      const job3 = await queue.accept();
      expect(job3).toBeNull();

      await queue.complete(job1!);
      await queue.complete(job2!);
    });

    test('batch', async () => {
      await queue.enqueue([
        {
          batchKey: '1',
          payload: { a: 'hello' },
        },
        {
          batchKey: '1',
          payload: { a: 'world' },
        },
      ]);
      const job1 = await queue.accept();

      expect(job1).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            batchKey: '1',
            payload: { a: 'hello' },
          },
          {
            id: expect.any(String),
            batchKey: '1',
            payload: { a: 'world' },
          },
        ])
      );
    });

    test('priority', async () => {
      await queue.enqueue([
        {
          batchKey: '1',
          payload: { a: 'hello' },
        },
        {
          batchKey: '2',
          payload: { a: 'foo' },
        },
      ]);

      queue.setPriority('2', 1);

      const job1 = await queue.accept();

      expect(job1).toEqual([
        {
          id: expect.any(String),
          batchKey: '2',
          payload: { a: 'foo' },
        },
      ]);

      await queue.enqueue([
        {
          batchKey: '2',
          payload: { a: 'bar' },
        },
      ]);

      const job2 = await queue.accept();

      expect(job2).toEqual([
        {
          id: expect.any(String),
          batchKey: '2',
          payload: { a: 'bar' },
        },
      ]);
    });

    test('timeout', async () => {
      await queue.enqueue([
        {
          batchKey: '1',
          payload: { a: 'hello' },
        },
      ]);
      {
        const job = await queue.accept();

        expect(job).toEqual([
          {
            id: expect.any(String),
            batchKey: '1',
            payload: { a: 'hello' },
          },
        ]);
      }

      {
        const job = await queue.accept();

        expect(job).toBeNull();
      }

      vitest.advanceTimersByTime(1000 * 60 * 60);

      {
        const job = await queue.accept();

        expect(job).toEqual([
          {
            id: expect.any(String),
            batchKey: '1',
            payload: { a: 'hello' },
          },
        ]);
      }
    });
  }
);
