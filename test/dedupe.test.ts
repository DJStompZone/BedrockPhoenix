import { DedupeCache } from '../src/relay/dedupe';

describe('DedupeCache', () => {
  test('expires entries by ttl', () => {
    const cache = new DedupeCache(1000, 10);
    cache.add('a', 0);
    expect(cache.has('a', 500)).toBe(true);
    expect(cache.has('a', 1500)).toBe(false);
  });

  test('evicts by max entries', () => {
    const cache = new DedupeCache(10000, 2);
    cache.add('a', 0);
    cache.add('b', 1);
    cache.add('c', 2);
    expect(cache.has('a', 3)).toBe(false);
    expect(cache.has('b', 3)).toBe(true);
  });
});
