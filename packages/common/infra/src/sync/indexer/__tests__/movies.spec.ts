/**
 * @vitest-environment happy-dom
 */
import 'fake-indexeddb/auto';

import { beforeEach, describe, expect, test } from 'vitest';

import { Document, type Index } from '..';
import { IndexedDBIndex } from '../impl/indexeddb';
import { MemoryIndex } from '../impl/memory';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const moviesJson = require('./movies-250.json');

const schema = {
  Title: 'FullText',
  Year: 'Integer',
  Genre: 'String',
  Director: 'String',
  Actors: 'String',
  Plot: 'FullText',
  Language: 'String',
  Country: 'String',
} as const;

let index: Index<typeof schema> = null!;

describe.each([
  { name: 'memory', backend: MemoryIndex },
  { name: 'idb', backend: IndexedDBIndex },
])('movies tests($name)', ({ backend }) => {
  beforeEach(async () => {
    index = new backend(schema);
    index.clear();

    const writer = await index.write();

    for (const movie of moviesJson.movies) {
      const doc = new Document(movie.imdbID);
      doc.insert('Title', movie.Title);
      doc.insert('Year', movie.Year);
      doc.insert('Genre', movie.Genre.split(', '));
      doc.insert('Director', movie.Director.split(', '));
      doc.insert('Actors', movie.Actors.split(', '));
      doc.insert('Plot', movie.Plot);
      doc.insert('Language', movie.Language.split(', '));
      doc.insert('Country', movie.Country.split(', '));
      writer.insert(doc);
    }

    await writer.commit();
  });

  test('basic', async () => {
    const result = await index.search({
      type: 'match',
      field: 'Title',
      match: 'The Lion King',
    });

    expect(result.nodes[0]).toEqual({
      id: 'tt0110357',
      score: expect.anything(),
    });
  });

  test('the director with the most action movies', async () => {
    const result = await index.aggregate(
      {
        type: 'match',
        field: 'Genre',
        match: 'Action',
      },
      'Director'
    );

    expect(result.buckets.sort((a, b) => b.count - a.count)[0]).toEqual({
      key: 'Christopher Nolan',
      count: 4,
      score: expect.anything(),
    });
  });
});
