export function splitMessage(message: string, maxLen: number, prefix = ''): string[] {
  const clean = message.trim();
  if (!clean) {
    return [];
  }
  const available = Math.max(1, maxLen - prefix.length);
  const words = clean.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current.length) {
      if (word.length > available) {
        for (let i = 0; i < word.length; i += available) {
          chunks.push(prefix + word.slice(i, i + available));
        }
      } else {
        current = word;
      }
      continue;
    }
    if (current.length + 1 + word.length <= available) {
      current = `${current} ${word}`;
      continue;
    }
    chunks.push(prefix + current);
    if (word.length > available) {
      for (let i = 0; i < word.length; i += available) {
        chunks.push(prefix + word.slice(i, i + available));
      }
      current = '';
    } else {
      current = word;
    }
  }

  if (current.length) {
    chunks.push(prefix + current);
  }
  return chunks;
}
