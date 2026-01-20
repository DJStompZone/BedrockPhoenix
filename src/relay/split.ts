export function splitMessage(
  text: string,
  maxLen: number,
  prefix: string = ""
): string[] {
  const effectiveMax = maxLen - prefix.length;
  if (effectiveMax <= 0) {
    // Fallback if prefix eats everything, though shouldn't happen with reasonable config
    return [text.substring(0, maxLen)];
  }

  if (text.length <= effectiveMax) {
    return [prefix + text];
  }

  const parts: string[] = [];
  const words = text.split(" ");
  let currentPart = "";

  for (const word of words) {
    // If adding next word exceeds limit
    if ((currentPart + (currentPart ? " " : "") + word).length > effectiveMax) {
      if (currentPart.length > 0) {
        parts.push(prefix + currentPart);
        currentPart = word;
      } else {
        // Word itself is too long, must split hard or accept overflow?
        // Let's hard split the long word
        let remaining = word;
        while (remaining.length > effectiveMax) {
          parts.push(prefix + remaining.substring(0, effectiveMax));
          remaining = remaining.substring(effectiveMax);
        }
        currentPart = remaining;
      }
    } else {
      currentPart += (currentPart ? " " : "") + word;
    }
  }

  if (currentPart.length > 0) {
    parts.push(prefix + currentPart);
  }

  return parts;
}
