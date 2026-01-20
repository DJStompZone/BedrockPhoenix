export function stripMinecraftFormatting(message: string): string {
  return message.replace(/§./g, '');
}
