import { TokenBucket } from '../src/relay/rateLimit';

describe('TokenBucket', () => {
  test('consumes tokens and refills', () => {
    const bucket = new TokenBucket(1, 2);
    expect(bucket.tryTake(1, 0)).toBe(true);
    expect(bucket.tryTake(1, 0)).toBe(true);
    expect(bucket.tryTake(1, 0)).toBe(false);
    expect(bucket.tryTake(1, 1000)).toBe(true);
  });
});
