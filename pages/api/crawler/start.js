import { spawn } from 'child_process';
import path from 'path';

// Global reference to active crawler process
let activeCrawler = null;

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { site = 'all', pages, minDelay = 1.0, maxDelay = 1.8 } = req.body || {};

  if (activeCrawler && !activeCrawler.killed && activeCrawler.exitCode === null) {
    return res.status(409).json({
      error: 'A crawler process is already running.',
      pid: activeCrawler.pid
    });
  }

  const scriptPath = path.join(process.cwd(), 'crawler', 'crawler.py');
  const pagerankScript = path.join(process.cwd(), 'crawler', 'pagerank.py');

  const args = ['--site', site, '--min-delay', String(minDelay), '--max-delay', String(maxDelay)];
  if (pages) {
    args.push('--pages', String(pages));
  }

  console.log(`[Crawler API] Spawning python crawler: python3 ${scriptPath} ${args.join(' ')}`);

  const proc = spawn('python3', [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore'
  });

  proc.unref();
  activeCrawler = proc;

  // After crawler finishes, run PageRank in background
  proc.on('close', (code) => {
    console.log(`[Crawler API] Crawler process exited with code ${code}. Running PageRank...`);
    activeCrawler = null;
    const prProc = spawn('python3', [pagerankScript], { detached: true, stdio: 'ignore' });
    prProc.unref();
  });

  return res.json({
    message: `Crawler started in background for site: ${site}`,
    pid: proc.pid,
    params: { site, pages, minDelay, maxDelay }
  });
}
