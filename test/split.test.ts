import { splitMessage } from '../src/relay/split';

describe('splitMessage', () => {
  test('splits on word boundaries', () => {
    const chunks = splitMessage('hello world from bedrock', 10);
    expect(chunks).toEqual(['hello', 'world from', 'bedrock']);
  });

  test('hard splits long word', () => {
    const chunks = splitMessage('supercalifragilistic', 5);
    expect(chunks).toEqual(['super', 'calif', 'ragil', 'istic']);
  });

  test('preserves prefix', () => {
    const chunks = splitMessage('hello world', 8, '[X] ');
    expect(chunks).toEqual(['[X] hello', '[X] world']);
  });
});
