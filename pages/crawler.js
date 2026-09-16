import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function CrawlerStatusPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const logsRef = useRef(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const dark = savedTheme === 'dark';
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    fetchStatus();
    // Poll every 3 seconds for live crawl updates
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/crawler/status');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error('Failed to fetch crawler status:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const startCrawl = async (siteId = 'all') => {
    setIsTriggering(true);
    setTriggerMsg(`Triggering crawler for ${siteId}...`);
    try {
      const res = await fetch('/api/crawler/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: siteId, pages: 30, minDelay: 1.0, maxDelay: 1.8 })
      });
      const resData = await res.json();
      if (res.ok) {
        setTriggerMsg(`✅ Crawler started (PID ${resData.pid}). Crawling 3 layers deep with 1-2s delay.`);
      } else {
        setTriggerMsg(`⚠️ ${resData.error || 'Failed to start crawler'}`);
      }
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setTriggerMsg(`❌ Error starting crawler: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const triggerPageRank = async () => {
    setIsTriggering(true);
    setTriggerMsg('Running PageRank power iteration calculation...');
    try {
      const res = await fetch('/api/pagerank/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ damping: 0.85, iterations: 100 })
      });
      const resData = await res.json();
      if (res.ok) {
        setTriggerMsg(`✅ PageRank calculation complete! Top page: ${resData.topPages?.[0]?.title || 'Done'}`);
      } else {
        setTriggerMsg(`⚠️ ${resData.error || 'PageRank failed'}`);
      }
      setTimeout(fetchStatus, 1000);
    } catch (err) {
      setTriggerMsg(`❌ PageRank error: ${err.message}`);
    } finally {
      setIsTriggering(false);
    }
  };

  const toggleDarkMode = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    localStorage.setItem('theme', nextDark ? 'dark' : 'light');
    if (nextDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };

  const overview = data?.overview || {
    totalPages: 0,
    totalLinks: 0,
    completedCount: 0,
    crawlingCount: 0,
    pendingCount: 0,
    totalSites: 7,
    isCrawling: false
  };

  const sites = data?.sites || [];
  const logs = data?.logs || [];

  return (
    <div className="crawler-page-container">
      {/* Top Header */}
      <header className="crawler-header-bar">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
            <Link href="/" className="logo-small" style={{ fontSize: '24px' }}>
              Quintillion
            </Link>
            <span style={{ color: 'var(--text-secondary)' }}>/</span>
            <h1>Web Crawler Pipeline & Corpus Monitor</h1>
          </div>
          <p className="page-subtitle">
            Autonomous polite Python crawler indexing 7 documentation targets into MongoDB (3 layers deep, 1-2s delay).
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/" className="nav-link-btn">
            🔍 Search Engine
          </Link>
          <Link href="/pagerank" className="nav-link-btn">
            🕸️ PageRank Visualizer
          </Link>
          <button className="dark-mode-toggle" onClick={toggleDarkMode} title="Toggle theme">
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Trigger Notification Message */}
      {triggerMsg && (
        <div
          style={{
            padding: '12px 18px',
            marginBottom: '24px',
            borderRadius: '8px',
            background: 'var(--card-bg)',
            border: '1px solid var(--accent-blue)',
            color: 'var(--text-color)',
            fontSize: '13px'
          }}
        >
          {triggerMsg}
        </div>
      )}

      {/* Metrics Cards Grid */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Sites Completed</div>
          <div className="metric-value" style={{ color: 'var(--accent-green)' }}>
            {overview.completedCount} <span style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>/ {overview.totalSites}</span>
          </div>
          <div className="metric-sub">
            {overview.totalSites - overview.completedCount} site(s) remaining
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Documents Indexed</div>
          <div className="metric-value">{overview.totalPages}</div>
          <div className="metric-sub">Stored in MongoDB pages collection</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Directed Links Mapped</div>
          <div className="metric-value" style={{ color: 'var(--accent-blue)' }}>
            {overview.totalLinks}
          </div>
          <div className="metric-sub">Forming the intra-web graph for PageRank</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Crawler Status</div>
          <div className="metric-value" style={{ fontSize: '22px' }}>
            {overview.isCrawling ? (
              <span style={{ color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span className="pulse-badge"></span> CRAWLING
              </span>
            ) : overview.completedCount === overview.totalSites ? (
              <span style={{ color: 'var(--accent-green)' }}>✅ ALL DONE</span>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>IDLE / READY</span>
            )}
          </div>
          <div className="metric-sub">
            Depth limit: 3 layers | Sleep: 1-2 sec/req
          </div>
        </div>
      </div>

      {/* Sites Section */}
      <section className="sites-section">
        <div className="section-header-flex">
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Target Sites Pipeline Status</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Tracks crawl progress, depth, and indexed document counts for each site.
            </p>
          </div>

          <div className="button-row">
            <button
              className="btn-primary"
              disabled={isTriggering || overview.isCrawling}
              onClick={() => startCrawl('all')}
            >
              {overview.isCrawling ? 'Crawler In Progress...' : '🚀 Start Full Crawl (All 7 Sites)'}
            </button>
            <button
              className="btn-secondary"
              disabled={isTriggering}
              onClick={triggerPageRank}
            >
              ⚡ Recompute PageRank
            </button>
            <button className="btn-secondary" onClick={fetchStatus}>
              🔄 Refresh
            </button>
          </div>
        </div>

        <div style={{ marginTop: '20px' }}>
          {sites.map((site) => {
            const pct = site.maxPages > 0 ? Math.min(100, Math.round((site.pagesCrawled / site.maxPages) * 100)) : 0;
            const isDone = site.status === 'completed';
            const isCrawling = site.status === 'crawling';

            let badgeClass = 'badge-pending';
            if (isDone) badgeClass = 'badge-completed';
            else if (isCrawling) badgeClass = 'badge-crawling';
            else if (site.status === 'failed') badgeClass = 'badge-failed';

            return (
              <div key={site.id} className="site-card">
                <div className="site-card-top">
                  <div className="site-name-wrap">
                    <span className="site-title">{site.name}</span>
                    <a
                      href={site.seedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="site-seed"
                    >
                      {site.seedUrl}
                    </a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`badge-status ${badgeClass}`}>
                      {site.status}
                    </span>
                    {!isCrawling && !isDone && (
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                        onClick={() => startCrawl(site.id)}
                      >
                        Crawl Site
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="progress-bar-container">
                  <div
                    className={`progress-bar-fill ${isDone ? 'completed' : ''}`}
                    style={{ width: `${pct}%` }}
                  ></div>
                </div>

                <div className="site-details-row">
                  <div>
                    <strong>Progress:</strong> {site.pagesCrawled} / {site.maxPages} pages ({pct}%)
                  </div>
                  <div>
                    <strong>Max Depth:</strong> {site.maxDepth} (Current: Depth {site.currentDepth})
                  </div>
                  <div>
                    <strong>Queue Size:</strong> {site.queueSize} URLs
                  </div>
                  {site.lastCrawledTitle && (
                    <div style={{ maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong>Latest:</strong> {site.lastCrawledTitle}
                    </div>
                  )}
                  {site.finishedAt && (
                    <div>
                      <strong>Completed:</strong> {new Date(site.finishedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Real-time Crawler Logs Card */}
      <section className="crawler-logs-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: overview.isCrawling ? '#4285f4' : '#34a853', display: 'inline-block' }}></span>
            <span style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>
              Live Crawler Event Stream (MongoDB `crawler_logs`)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#888' }}>
            Auto-refreshing every 3s
          </span>
        </div>

        <div className="logs-scrollbox" ref={logsRef}>
          {logs.length === 0 ? (
            <div style={{ color: '#666', padding: '20px 0' }}>No logs recorded yet. Start a crawl to view streaming events.</div>
          ) : (
            logs.map((log) => {
              const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '';
              let levelColor = '#4ec9b0';
              if (log.level === 'error') levelColor = '#f44747';
              else if (log.level === 'warning') levelColor = '#ce9178';
              else if (log.level === 'debug') levelColor = '#dcdcaa';
              else if (log.level === 'success') levelColor = '#81c995';

              return (
                <div key={log.id} style={{ marginBottom: '4px' }}>
                  <span style={{ color: '#569cd6' }}>[{timeStr}]</span>{' '}
                  <span style={{ color: '#9cdcfe' }}>[{log.siteId}]</span>{' '}
                  <span style={{ color: levelColor }}>[{log.level.toUpperCase()}]</span>{' '}
                  <span style={{ color: '#d4d4d4' }}>{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
