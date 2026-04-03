/**
 * Prompt cleanup utility.
 * Removes filler words, normalizes punctuation, and cleans up spoken text.
 */

const FILLER_WORDS = [
  'um', 'uh', 'uhh', 'umm', 'hmm', 'hm',
  'like', 'you know', 'basically', 'actually',
  'literally', 'so yeah', 'i mean', 'kind of',
  'sort of', 'right', 'okay so', 'well',
];

/**
 * Remove filler words from transcribed text.
 */
function removeFillerWords(text: string): string {
  let cleaned = text;

  // Sort by length descending so longer phrases are matched first
  const sortedFillers = [...FILLER_WORDS].sort((a, b) => b.length - a.length);

  for (const filler of sortedFillers) {
    // Match filler word as a standalone word (bounded by word boundaries or punctuation)
    const regex = new RegExp(
      `\\b${filler}\\b[,\\s]*`,
      'gi'
    );
    cleaned = cleaned.replace(regex, ' ');
  }

  return cleaned;
}

/**
 * Normalize punctuation and whitespace.
 */
function normalizePunctuation(text: string): string {
  let result = text;

  // Remove multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  // Remove space before punctuation
  result = result.replace(/\s+([.,!?;:])/g, '$1');

  // Ensure space after punctuation
  result = result.replace(/([.,!?;:])([A-Za-z])/g, '$1 $2');

  // Capitalize first letter
  result = result.charAt(0).toUpperCase() + result.slice(1);

  // Capitalize after sentence-ending punctuation
  result = result.replace(/([.!?]\s+)([a-z])/g, (_match, p1, p2) => {
    return p1 + p2.toUpperCase();
  });

  return result.trim();
}

/**
 * Clean up a transcribed prompt by removing fillers and normalizing text.
 */
export function cleanupPrompt(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let result = text.trim();
  result = removeFillerWords(result);
  result = normalizePunctuation(result);

  return result;
}
