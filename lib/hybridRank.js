import { getWordVariations, sanitizeWord } from './stemmer';

export function calculateHybridScore(doc, query) {
  const cleanQuery = sanitizeWord(query);
  const queryTokens = cleanQuery.split(/\s+/).filter(Boolean);
  
  if (queryTokens.length === 0) {
    return {
      titleScore: 0,
      descriptionScore: 0,
      headingScore: 0,
      frequencyScore: 0,
      pageRankScore: 0,
      totalScore: 0,
      matchedVariations: []
    };
  }

  // Gather all variations for all tokens in query
  const allVariations = [];
  queryTokens.forEach(token => {
    allVariations.push(...getWordVariations(token));
  });
  const uniqueVariations = Array.from(new Set(allVariations));

  const title = (doc.title || '').toLowerCase();
  const description = (doc.metaDescription || '').toLowerCase();
  const headings = Array.isArray(doc.headings) ? doc.headings.join(' ').toLowerCase() : '';
  const bodyText = (doc.bodyText || '').toLowerCase();

  let titleScore = 0;
  let descriptionScore = 0;
  let headingScore = 0;
  let rawFreq = 0;
  const matchedVariations = new Set();

  uniqueVariations.forEach(variation => {
    let matchedInDoc = false;

    // Title score (+15 points per matched query token variation)
    if (title.includes(variation)) {
      titleScore += 15;
      matchedInDoc = true;
    }

    // Description score (+10 points)
    if (description.includes(variation)) {
      descriptionScore += 10;
      matchedInDoc = true;
    }

    // Heading score (+8 points)
    if (headings.includes(variation)) {
      headingScore += 8;
      matchedInDoc = true;
    }

    // Body frequency (+1 point per match, capped at 35 points to prevent keyword stuffing)
    if (variation.length >= 3) {
      try {
        const regex = new RegExp(`\\b${variation}\\b`, 'gi');
        const matches = bodyText.match(regex);
        if (matches) {
          rawFreq += matches.length;
          matchedInDoc = true;
        }
      } catch (e) {
        // Fallback for special characters
        if (bodyText.includes(variation)) {
          rawFreq += 1;
          matchedInDoc = true;
        }
      }
    }

    if (matchedInDoc) {
      matchedVariations.add(variation);
    }
  });

  // Cap frequency score to 30 points to balance with SEO & PageRank
  const frequencyScore = Math.min(rawFreq, 30);

  // PageRank Authority score (1.0 to 25.0 points)
  let pageRankScore = 0;
  if (typeof doc.pageRankNormalized === 'number' && doc.pageRankNormalized > 0) {
    pageRankScore = Math.round(doc.pageRankNormalized * 10) / 10;
  } else if (typeof doc.pageRank === 'number' && doc.pageRank > 0) {
    pageRankScore = Math.round((1.0 + Math.min(doc.pageRank * 100, 24)) * 10) / 10;
  } else {
    pageRankScore = 3.0; // default baseline for newly discovered uncalculated pages
  }

  // If there is zero text match (none of the query terms found in page), total score is 0
  const hasTextMatch = titleScore > 0 || descriptionScore > 0 || headingScore > 0 || frequencyScore > 0;
  
  const totalScore = hasTextMatch
    ? Math.round((titleScore + descriptionScore + headingScore + frequencyScore + pageRankScore) * 10) / 10
    : 0;

  return {
    titleScore,
    descriptionScore,
    headingScore,
    frequencyScore,
    pageRankScore,
    totalScore,
    matchedVariations: Array.from(matchedVariations)
  };
}
