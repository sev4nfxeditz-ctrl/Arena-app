// ---- Profanity Filter Service ----
// Server-side content moderation for chat

const BAD_WORDS = new Set([
  // Common English profanity (abbreviated list — extend as needed)
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'dick', 'bastard',
  'cunt', 'crap', 'piss', 'cock', 'pussy', 'fag', 'slut',
  'whore', 'nigger', 'nigga', 'retard', 'faggot',
  // Gaming-specific toxicity
  'kys', 'noob', 'stfu', 'gtfo',
]);

// Leet-speak character mapping
const LEET_MAP: Record<string, string> = {
  '@': 'a', '4': 'a',
  '3': 'e',
  '1': 'i', '!': 'i',
  '0': 'o',
  '5': 's', '$': 's',
  '7': 't',
  '|_|': 'u',
};

function normalizeLeetSpeak(text: string): string {
  let normalized = text.toLowerCase();
  for (const [leet, char] of Object.entries(LEET_MAP)) {
    normalized = normalized.split(leet).join(char);
  }
  // Remove repeated characters (e.g., "fuuuck" → "fuck")
  normalized = normalized.replace(/(.)\1{2,}/g, '$1');
  return normalized;
}

export function containsProfanity(text: string): boolean {
  const normalized = normalizeLeetSpeak(text);
  const words = normalized.split(/[\s,.!?;:'"()\[\]{}\-_/\\|]+/);

  for (const word of words) {
    if (BAD_WORDS.has(word)) return true;
  }

  // Also check full text for hidden words
  const cleanText = normalized.replace(/[\s\-_.,!?;:'"()]/g, '');
  for (const bad of BAD_WORDS) {
    if (cleanText.includes(bad)) return true;
  }

  return false;
}

export function filterProfanity(text: string): string {
  let result = text;
  const normalized = normalizeLeetSpeak(text);

  for (const bad of BAD_WORDS) {
    // Case-insensitive replacement with asterisks
    const regex = new RegExp(bad.split('').join('[\\s._-]*'), 'gi');
    result = result.replace(regex, '*'.repeat(bad.length));
  }

  return result;
}

export function isValidMessage(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: 'Message cannot be empty' };
  }
  if (text.length > 500) {
    return { valid: false, error: 'Message too long (max 500 characters)' };
  }
  return { valid: true };
}
