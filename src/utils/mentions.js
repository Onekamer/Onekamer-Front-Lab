export const extractUniqueMentions = (text = '') => {
  // Mention valide si '@' en début de chaîne ou précédé d'un espace, puis [a-z0-9._-] (max ~30)
  const mentionRegex = /(?:^|[^\w@])@([A-Za-z0-9À-ÖØ-öø-ÿ'’._-]{1,30})(?=$|[^A-Za-z0-9À-ÖØ-öø-ÿ'’._-])/g;
  const matches = new Set();
  if (!text) return [];

  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    matches.add(match[1]);
  }

  return Array.from(matches);
};

export default extractUniqueMentions;
