export function stripMcFormatting(text: string): string {
  // Matches § followed by any character
  return text.replace(/§./g, "");
}

export function sanitizeDiscordToMc(
  text: string,
  mentionPolicy: "none" | "users" | "all" = "none"
): string {
  let clean = text;

  // Collapse newlines to spaces
  clean = clean.replace(/[\r\n]+/g, " ");

  // Handle Mentions
  // Discord mentions: <@ID>, <@!ID>, <@&ID> (role), @everyone, @here

  // Always neutralize everyone/here
  clean = clean.replace(/@(everyone|here)/g, "$1"); // Remove @ symbol

  // Roles: <@&ID> -> Removed or neutralized
  clean = clean.replace(/<@&(\d+)>/g, "");

  // User mentions: <@ID> or <@!ID>
  if (mentionPolicy === "none") {
    // Remove completely or replace with name?
    // Without Discord client resolution, we can't easily resolve ID to Name here purely statelessly.
    // The Discord client layer will handle resolving to names BEFORE passing to sanitize usually?
    // Or we leave it as valid mention string if Policy allows?
    // For 'none', let's neutralize the format.
    clean = clean.replace(/<@!?(\d+)>/g, "");
  } else if (mentionPolicy === "users") {
    // Keep them, BDS might ignore them but they are readable if client resolves them?
    // Actually BDS doesn't resolve Discord IDs.
    // Usually the logic is: Resolve IDs to Names in the Discord Client event handler,
    // THEN pass to sanitize.
    // But if any slip through:
    // We'll leave them if policy is users, but stripped if none.
    // Spec says: "remove/neutralize mentions per policy"
    // Let's assume resolution happens upstream or we just leave raw syntax if 'users' allowed.
  }

  // Strip Markdown (Basic)
  // Remove bold/italic/strike/spoiler etc?
  // Common: **bold** -> bold, *italic* -> italic.
  // Simple regex to remove common MD symbols but keep text.
  clean = clean.replace(/[*_~`|]/g, ""); // Naive strip

  return clean.trim();
}
