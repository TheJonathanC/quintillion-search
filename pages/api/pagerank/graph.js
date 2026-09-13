import { getDatabase } from '../../../lib/db';

export default async function handler(req, res) {
  try {
    const db = await getDatabase();
    const limit = parseInt(req.query.limit, 10) || 80;

    // Fetch top pages sorted by PageRank or inDegree
    const pages = await db.pages
      .find({})
      .sort({ pageRank: -1, inDegree: -1 })
      .limit(limit)
      .toArray();

    if (pages.length === 0) {
      return res.json({ nodes: [], edges: [], metadata: null });
    }

    const urlSet = new Set(pages.map(p => p.url));
    const urlToIndex = new Map(pages.map((p, idx) => [p.url, idx]));

    // Domain color palette map
    const domainColors = {
      'docs.python.org': '#3776AB',
      'manipal.edu': '#E06D53',
      'www.manipal.edu': '#E06D53',
      'react.dev': '#61DAFB',
      'fastapi.tiangolo.com': '#009688',
      'expressjs.com': '#707070',
      'developer.mozilla.org': '#83B81A',
      'go.dev': '#00ADD8'
    };

    const nodes = pages.map((p, idx) => {
      const domain = p.domain || (p.url ? new URL(p.url).hostname : 'unknown');
      const color = domainColors[domain] || '#4285f4';
      return {
        id: idx,
        url: p.url,
        title: p.title || p.url,
        domain: domain,
        siteId: p.siteId || 'site',
        pageRank: p.pageRank || 0.001,
        pageRankNormalized: p.pageRankNormalized || 5.0,
        inDegree: p.inDegree || 0,
        outDegree: p.outDegree || 0,
        color: color
      };
    });

    // Fetch links where both source and target are in our top node set
    const candidateUrls = Array.from(urlSet);
    const links = await db.links
      .find({
        sourceUrl: { $in: candidateUrls },
        targetUrl: { $in: candidateUrls }
      })
      .limit(300)
      .toArray();

    const edges = [];
    links.forEach(l => {
      const sIdx = urlToIndex.get(l.sourceUrl);
      const tIdx = urlToIndex.get(l.targetUrl);
      if (sIdx !== undefined && tIdx !== undefined && sIdx !== tIdx) {
        edges.push({
          source: sIdx,
          target: tIdx,
          sourceUrl: l.sourceUrl,
          targetUrl: l.targetUrl
        });
      }
    });

    // Fetch latest metadata
    const metadata = await db.pagerank_metadata.findOne({ type: 'latest' });

    return res.json({
      nodes,
      edges,
      metadata: metadata || {
        totalNodes: pages.length,
        totalEdges: edges.length,
        dampingFactor: 0.85,
        iterations: 20,
        converged: true
      }
    });
  } catch (err) {
    console.error('PageRank graph API error:', err);
    return res.status(500).json({ error: 'Failed to fetch graph', details: err.message });
  }
}
