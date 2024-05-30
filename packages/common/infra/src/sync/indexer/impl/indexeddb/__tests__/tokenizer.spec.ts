import { expect, test } from 'vitest';

import { SimpleTokenizer } from '../tokenizer';

test('tokenizer', () => {
  const tokens = new SimpleTokenizer().tokenize('hello  world,\n AFFiNE');

  expect(tokens).toEqual([
    { term: 'hello', start: 0, end: 5 },
    { term: 'world', start: 7, end: 12 },
    { term: 'affine', start: 15, end: 21 },
  ]);
});
