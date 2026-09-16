import { getDatabase } from '../../lib/db';
import { sanitizeWord, getWordVariations } from '../../lib/stemmer';
import { calculateHybridScore } from '../../lib/hybridRank';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query.q;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const startTime = Date.now();
  const cleaned = sanitizeWord(query);
  if (!cleaned) {
    return res.json({ results: [], query, timeTakenMs: 0 });
  }

  try {
    const db = await getDatabase();
    const tokens = cleaned.split(/\s+/).filter(Boolean);
    const variations = Array.from(new Set(tokens.flatMap(t => getWordVariations(t))));

    // Build regex query to find candidate documents
    const regexList = variations.map(v => new RegExp(v, 'i'));
    const candidateQuery = {
      $or: [
        { title: { $in: regexList } },
        { metaDescription: { $in: regexList } },
        { headings: { $in: regexList } },
        { bodyText: { $in: regexList } }
      ]
    };

    // Fetch matching documents
    const candidates = await db.pages.find(candidateQuery).limit(100).toArray();

    // Calculate hybrid scores for each candidate
    const scoredResults = candidates
      .map(doc => {
        const scores = calculateHybridScore(doc, query);
        if (scores.totalScore <= 0) return null;

        // Generate clean snippet from metaDescription or bodyText
        let snippet = doc.metaDescription;
        if (!snippet || snippet.length < 20) {
          const body = doc.bodyText || '';
          // Find first occurrence of query term
          const lowerBody = body.toLowerCase();
          let matchIdx = -1;
          for (const v of variations) {
            const idx = lowerBody.indexOf(v);
            if (idx !== -1) {
              matchIdx = idx;
              break;
            }
          }
          if (matchIdx !== -1) {
            const start = Math.max(0, matchIdx - 60);
            const end = Math.min(body.length, matchIdx + 160);
            snippet = (start > 0 ? '...' : '') + body.substring(start, end).trim() + (end < body.length ? '...' : '');
          } else {
            snippet = body.substring(0, 180).trim() + '...';
          }
        }

        return {
          id: doc._id.toString(),
          url: doc.url,
          domain: doc.domain || (doc.url ? new URL(doc.url).hostname : ''),
          title: doc.title || 'Untitled Document',
          metaDescription: snippet || 'No description available.',
          siteId: doc.siteId,
          siteName: doc.siteName,
          totalScore: scores.totalScore,
          breakdown: {
            titleScore: scores.titleScore,
            descriptionScore: scores.descriptionScore,
            headingScore: scores.headingScore,
            frequencyScore: scores.frequencyScore,
            pageRankScore: scores.pageRankScore
          },
          matchedVariations: scores.matchedVariations,
          pageRank: doc.pageRank || 0,
          inDegree: doc.inDegree || 0,
          outDegree: doc.outDegree || 0
        };
      })
      .filter(Boolean);

    // Sort by totalScore descending
    scoredResults.sort((a, b) => b.totalScore - a.totalScore);

    const timeTakenMs = Date.now() - startTime;

    return res.json({
      results: scoredResults,
      query,
      variations,
      totalFound: scoredResults.length,
      timeTakenMs
    });
  } catch (err) {
    console.error('Search API error:', err);
    return res.status(500).json({ error: 'Search failed', details: err.message });
  }
}
