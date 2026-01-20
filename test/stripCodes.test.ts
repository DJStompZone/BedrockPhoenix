import { stripMinecraftFormatting } from '../src/mc/stripCodes';

describe('stripMinecraftFormatting', () => {
  test('removes formatting codes', () => {
    expect(stripMinecraftFormatting('§aHello §bWorld')).toBe('Hello World');
  });
});
