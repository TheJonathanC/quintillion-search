import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function Home() {
  // Views and search state
  const [isHomeView, setIsHomeView] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searchTime, setSearchTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Theme & UI state
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalLogs, setTerminalLogs] = useState([]);
  const [terminalWidth, setTerminalWidth] = useState(420);
  const [crawlerBadge, setCrawlerBadge] = useState({ active: false, label: 'Crawler' });

  // Refs
  const searchInputRef = useRef(null);
  const searchInputSmallRef = useRef(null);
  const terminalOutputRef = useRef(null);
  const isResizingRef = useRef(false);

  // Initialize theme and terminal logs
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const dark = savedTheme === 'dark';
    setIsDarkMode(dark);
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }

    addLog('Quintillion Search Engine v2 initialized', 'info');
    addLog('Hybrid SEO + PageRank graph model loaded', 'info');

    // Fetch crawler status for header badge
    fetchCrawlerStatus();
    const interval = setInterval(fetchCrawlerStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Focus input on load
  useEffect(() => {
    if (isHomeView && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isHomeView]);

  // Scroll terminal to bottom
  useEffect(() => {
    if (terminalOutputRef.current) {
      terminalOutputRef.current.scrollTop = terminalOutputRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const fetchCrawlerStatus = async () => {
    try {
      const res = await fetch('/api/crawler/status');
      if (res.ok) {
        const data = await res.json();
        const done = data.overview?.completedCount || 0;
        const total = data.overview?.totalSites || 7;
        const isCrawling = data.overview?.isCrawling;
        setCrawlerBadge({
          active: isCrawling,
          label: isCrawling ? `Crawling (${done}/${total})` : `Crawler (${done}/${total} done)`
        });
      }
    } catch (e) {
      // ignore
    }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalLogs(prev => [...prev, { timestamp, message, type }]);
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
    addLog(`Theme switched to ${nextDark ? 'dark' : 'light'} mode`, 'info');
  };

  const toggleTerminal = () => {
    setIsTerminalOpen(prev => !prev);
    addLog(isTerminalOpen ? 'Debug terminal closed' : 'Debug terminal opened', 'info');
  };

  const performSearch = async (overrideQuery) => {
    const q = (overrideQuery !== undefined ? overrideQuery : query).trim();
    if (!q) {
      addLog('Empty search query ignored', 'warning');
      return;
    }

    setIsHomeView(false);
    setIsLoading(true);
    setHasSearched(true);

    addLog(`🔍 Query received: "${q}"`, 'debug');
    addLog('Executing hybrid search across MongoDB corpus...', 'info');

    const start = Date.now();
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const elapsed = Date.now() - start;
      setSearchTime(elapsed / 1000);

      if (res.ok) {
        setResults(data.results || []);
        addLog(`Search completed in ${elapsed}ms`, 'info');
        addLog(`Stemming variations: [${(data.variations || []).join(', ')}]`, 'debug');
        addLog(`Found ${data.results ? data.results.length : 0} matching documents`, 'success');
        
        if (data.results && data.results.length > 0) {
          data.results.slice(0, 3).forEach((r, idx) => {
            addLog(
              `Rank #${idx + 1}: ${r.title.substring(0, 30)}... [Score: ${r.totalScore} | Title: +${r.breakdown.titleScore} | Content: +${r.breakdown.frequencyScore} | PageRank: +${r.breakdown.pageRankScore}]`,
              'debug'
            );
          });
        }
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
      addLog(`Search error: ${err.message}`, 'error');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      performSearch();
    }
  };

  const goHome = () => {
    setIsHomeView(true);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    addLog('Returned to home view', 'info');
  };

  // Resize handler for terminal
  const startResize = (e) => {
    isResizingRef.current = true;
    const onMouseMove = (moveEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      if (newWidth >= 300 && newWidth <= window.innerWidth * 0.65) {
        setTerminalWidth(newWidth);
      }
    };
    const onMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    e.preventDefault();
  };

  return (
    <>
      {/* Home Page View */}
      {isHomeView && (
        <div id="home-view" className="home-view">
          <div className="home-header">
            <div className="home-header-right">
              {/* Navigation links */}
              <Link href="/crawler" className="nav-link-btn" title="Inspect Web Crawler Pipeline">
                {crawlerBadge.active && <span className="pulse-badge"></span>}
                <span>{crawlerBadge.label}</span>
              </Link>
              <Link href="/pagerank" className="nav-link-btn" title="View PageRank Graph Visualizer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z"/>
                </svg>
                <span>PageRank Graph</span>
              </Link>

              {/* Dark mode toggle */}
              <button
                id="dark-mode-toggle-home"
                className="dark-mode-toggle"
                onClick={toggleDarkMode}
                title="Toggle theme"
              >
                {isDarkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 16,12A4,4 0 0,0 12,8M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31L23.31,12L20,8.69Z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.4 6.35,17.41C9.37,20.43 14,20.54 17.33,17.97Z"/>
                  </svg>
                )}
              </button>

              {/* Debug terminal toggle */}
              <button
                id="home-terminal-toggle"
                className="home-debug-btn"
                onClick={toggleTerminal}
                title="Toggle debug console"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z"/>
                </svg>
              </button>
            </div>
          </div>

          <div className="home-content">
            <div className="logo">Quintillion</div>
            <div className="search-section">
              <div className="search-container">
                <div className="search-box">
                  <input
                    type="text"
                    id="search-input"
                    ref={searchInputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder=""
                    autoComplete="off"
                  />
                  <button id="search-button" className="search-btn" onClick={() => performSearch()}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="info-pill">
                1/10 of a googol is 100 quintillion.
              </div>
            </div>
          </div>

          <div className="home-footer">
            <div className="footer-credit">
              Made by <a href="https://github.com/TheJonathanC" target="_blank" rel="noopener noreferrer">Jonathan Correa</a>
            </div>
          </div>
        </div>
      )}

      {/* Results Page View */}
      {!isHomeView && (
        <div id="results-view" className="results-view">
          <header className="results-header">
            <div className="header-left">
              <div className="logo-small" onClick={goHome}>
                Quintillion
              </div>
              <div className="search-container-small">
                <div className="search-box-small">
                  <input
                    type="text"
                    id="search-input-small"
                    ref={searchInputSmallRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder=""
                    autoComplete="off"
                  />
                  <button id="search-button-small" className="search-btn-small" onClick={() => performSearch()}>
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="header-right">
              <Link href="/crawler" className="nav-link-btn" title="Crawler Pipeline">
                {crawlerBadge.active && <span className="pulse-badge"></span>}
                <span>{crawlerBadge.label}</span>
              </Link>
              <Link href="/pagerank" className="nav-link-btn" title="PageRank Visualizer">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.4z"/>
                </svg>
                <span>PageRank</span>
              </Link>

              <button
                id="dark-mode-toggle-results"
                className="dark-mode-toggle"
                onClick={toggleDarkMode}
                title="Toggle theme"
              >
                {isDarkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M12,8A4,4 0 0,0 8,12A4,4 0 0,0 12,16A4,4 0 0,0 12,8M12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6A6,6 0 0,1 18,12A6,6 0 0,1 12,18M20,8.69V4H15.31L12,0.69L8.69,4H4V8.69L0.69,12L4,15.31V20H8.69L12,23.31L15.31,20H20V15.31L23.31,12L20,8.69Z"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.4 6.35,17.41C9.37,20.43 14,20.54 17.33,17.97Z"/>
                  </svg>
                )}
              </button>

              <button
                id="terminal-toggle"
                className="terminal-toggle"
                onClick={toggleTerminal}
                title="Toggle debug console"
              >
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path d="M20,19V7H4V19H20M20,3A2,2 0 0,1 22,5V19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H20M13,17V15H18V17H13M9.58,13L5.57,9H8.4L11.7,12.3C12.09,12.69 12.09,13.33 11.7,13.72L8.42,17H5.59L9.58,13Z"/>
                </svg>
              </button>
            </div>
          </header>

          <main className={`results-main ${isTerminalOpen ? 'terminal-open' : ''}`}>
            <div
              className="content-area"
              style={{ marginRight: isTerminalOpen ? `${terminalWidth}px` : '0px' }}
            >
              {isLoading && (
                <div className="loading">
                  <p>Searching index across crawled documentation...</p>
                </div>
              )}

              {!isLoading && (
                <>
                  <div className="results-info">
                    About {results.length} results ({searchTime.toFixed(2)} seconds)
                  </div>

                  <div id="results-container">
                    {results.length === 0 && hasSearched && (
                      <div className="no-results">
                        <h3>No results found</h3>
                        <p>Your search - <strong>{query}</strong> - did not match any indexed documents.</p>
                        <p style={{ marginTop: '8px' }}>
                          Try searching for <strong>python</strong>, <strong>manipal</strong>, <strong>react</strong>, <strong>fastapi</strong>, or run the web crawler in the top bar.
                        </p>
                      </div>
                    )}

                    {results.map((result, idx) => (
                      <div key={result.id || idx} className="result-item">
                        {result.siteName && (
                          <div className="result-domain-badge">{result.siteName}</div>
                        )}
                        <h3
                          className="result-title"
                          onClick={() => {
                            window.open(result.url, '_blank');
                            addLog(`Opened result: ${result.url}`, 'info');
                          }}
                        >
                          {result.title}
                        </h3>
                        <div
                          className="result-url"
                          onClick={() => window.open(result.url, '_blank')}
                        >
                          {result.url}
                        </div>
                        <p className="result-description">{result.metaDescription}</p>

                        <div className="result-score">
                          <span className="score-main">Total Score: {result.totalScore}</span>
                          <div className="score-breakdown">
                            <span className="score-item">Title: +{result.breakdown.titleScore}</span>
                            <span className="score-item">Description: +{result.breakdown.descriptionScore}</span>
                            <span className="score-item">Headings: +{result.breakdown.headingScore || 0}</span>
                            <span className="score-item">Content: +{result.breakdown.frequencyScore}</span>
                            <span className="score-item score-item-pr" title="Real PageRank graph authority score">
                              PageRank Authority: +{result.breakdown.pageRankScore}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      )}

      {/* Slide-out Terminal Panel - Exact match to original */}
      <div
        id="terminal-panel"
        className={`terminal-panel ${isTerminalOpen ? 'visible' : ''}`}
        style={{ width: `${terminalWidth}px` }}
      >
        <div className="resize-handle" onMouseDown={startResize}></div>
        <div className="terminal-header">
          <span>Search Engine Debug Console (v2 Hybrid)</span>
          <button id="terminal-close" onClick={() => setIsTerminalOpen(false)}>
            ×
          </button>
        </div>
        <div className="terminal-content" ref={terminalOutputRef}>
          <div id="terminal-output">
            {terminalLogs.map((log, index) => (
              <div key={index} className="terminal-line">
                <span className="terminal-timestamp">[{log.timestamp}]</span>{' '}
                <span className={`terminal-${log.type}`}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
