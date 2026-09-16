import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';
import { getDatabase } from '../../../lib/db';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { damping = 0.85, iterations = 100 } = req.body || {};

  try {
    const scriptPath = path.join(process.cwd(), 'crawler', 'pagerank.py');
    const cmd = `python3 ${scriptPath} --damping ${damping} --iterations ${iterations}`;

    console.log(`[PageRank API] Executing: ${cmd}`);
    const { stdout, stderr } = await execAsync(cmd);
    console.log('[PageRank API stdout]', stdout);
    if (stderr) console.error('[PageRank API stderr]', stderr);

    const db = await getDatabase();
    const metadata = await db.pagerank_metadata.findOne({ type: 'latest' });
    const topPages = await db.pages.find({}).sort({ pageRank: -1 }).limit(10).toArray();

    return res.json({
      success: true,
      metadata,
      topPages: topPages.map(p => ({
        url: p.url,
        title: p.title,
        domain: p.domain,
        pageRank: p.pageRank,
        pageRankNormalized: p.pageRankNormalized,
        inDegree: p.inDegree,
        outDegree: p.outDegree
      }))
    });
  } catch (err) {
    console.error('PageRank calculation failed:', err);
    return res.status(500).json({ error: 'Calculation failed', details: err.message });
  }
}
