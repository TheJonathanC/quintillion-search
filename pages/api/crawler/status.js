import { getDatabase } from '../../../lib/db';

const TARGET_SITES_CONFIG = [
  { id: 'python_docs', name: 'Python 3 Documentation', seedUrl: 'https://docs.python.org/3/', domain: 'docs.python.org', maxPages: 30 },
  { id: 'manipal_edu', name: 'Manipal Academy of Higher Education', seedUrl: 'https://manipal.edu/', domain: 'manipal.edu', maxPages: 30 },
  { id: 'react_docs', name: 'React Documentation', seedUrl: 'https://react.dev/learn', domain: 'react.dev', maxPages: 30 },
  { id: 'fastapi_docs', name: 'FastAPI Documentation', seedUrl: 'https://fastapi.tiangolo.com/tutorial/', domain: 'fastapi.tiangolo.com', maxPages: 30 },
  { id: 'express_docs', name: 'Express.js Documentation', seedUrl: 'https://expressjs.com/en/starter/installing.html', domain: 'expressjs.com', maxPages: 30 },
  { id: 'mdn_js', name: 'MDN JavaScript Documentation', seedUrl: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', domain: 'developer.mozilla.org', maxPages: 30 },
  { id: 'go_docs', name: 'Go Language Documentation', seedUrl: 'https://go.dev/doc/tutorial/getting-started', domain: 'go.dev', maxPages: 30 }
];

export default async function handler(req, res) {
  try {
    const db = await getDatabase();

    // Fetch site statuses from DB
    const statuses = await db.crawler_status.find({}).toArray();
    const statusMap = new Map(statuses.map(s => [s.siteId, s]));

    // Merge with master target sites list
    const sites = TARGET_SITES_CONFIG.map(cfg => {
      const dbEntry = statusMap.get(cfg.id) || {};
      return {
        id: cfg.id,
        name: dbEntry.name || cfg.name,
        seedUrl: dbEntry.seedUrl || cfg.seedUrl,
        domain: cfg.domain,
        status: dbEntry.status || 'pending',
        pagesCrawled: dbEntry.pagesCrawled || 0,
        maxPages: dbEntry.maxPages || cfg.maxPages,
        maxDepth: dbEntry.maxDepth || 3,
        currentDepth: dbEntry.currentDepth || 0,
        queueSize: dbEntry.queueSize || 0,
        lastCrawledUrl: dbEntry.lastCrawledUrl || null,
        lastCrawledTitle: dbEntry.lastCrawledTitle || null,
        startedAt: dbEntry.startedAt || null,
        finishedAt: dbEntry.finishedAt || null,
        lastError: dbEntry.lastError || null
      };
    });

    const totalPages = await db.pages.countDocuments();
    const totalLinks = await db.links.countDocuments();
    const completedCount = sites.filter(s => s.status === 'completed').length;
    const crawlingCount = sites.filter(s => s.status === 'crawling').length;
    const pendingCount = sites.filter(s => s.status === 'pending').length;

    // Fetch latest 40 logs
    const logs = await db.crawler_logs.find({}).sort({ timestamp: -1 }).limit(40).toArray();

    return res.json({
      sites,
      overview: {
        totalPages,
        totalLinks,
        completedCount,
        crawlingCount,
        pendingCount,
        totalSites: TARGET_SITES_CONFIG.length,
        isCrawling: crawlingCount > 0
      },
      logs: logs.map(l => ({
        id: l._id.toString(),
        siteId: l.siteId,
        level: l.level,
        message: l.message,
        timestamp: l.timestamp
      }))
    });
  } catch (err) {
    console.error('Crawler status API error:', err);
    return res.status(500).json({ error: 'Failed to fetch status', details: err.message });
  }
}
