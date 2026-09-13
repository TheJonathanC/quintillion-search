# Quintillion Search Engine v2

> A full-stack search engine showcasing a **Hybrid SEO & PageRank Graph Ranking Model** with an autonomous polite Python web crawler, MongoDB document & link storage, real-time crawler pipeline monitor, interactive force-directed PageRank visualizer, and Next.js frontend preserving the original minimalist aesthetic.

---

## What's New in v2 (`v2` branch)

1. **Graph PageRank Algorithm**:
   - Computes PageRank across real directed hyperlinks using power iteration with damping factor $d = 0.85$.
   - Accurately handles dangling nodes (pages with no out-links) and iteratively transfers probability mass until numerical convergence ($\Delta < 10^{-6}$).
   - Generates normalized authority scores ($+1.0$ to $+25.0$ pts) integrated into the search ranking model.

2. **Hybrid Ranking Model**:
   $$\text{Final Score} = S_{\text{title}} + S_{\text{description}} + S_{\text{headings}} + S_{\text{frequency}} + S_{\text{PageRank}}$$
   - Transparent score breakdown for every result card and logged in real-time in the debug console.

3. **Autonomous Polite Python Web Crawler**:
   - Crawls up to 3 layers deep (`max_depth = 3`).
   - Respects servers with polite $1.0 - 2.0$ second randomized request intervals.
   - Extracts page titles, meta descriptions, headings, clean body text, and maps directed hyperlinks.
   - Automatically recomputes PageRank as each target documentation site finishes crawling!

4. **Target Sites**:
   - 🐍 **Python 3 Documentation** (`docs.python.org`)
   - 🎓 **Manipal Academy of Higher Education** (`manipal.edu`)
   - ⚛️ **React Documentation** (`react.dev`)
   - ⚡ **FastAPI Documentation** (`fastapi.tiangolo.com`)
   - 🚂 **Express.js Documentation** (`expressjs.com`)
   - 🌐 **MDN JavaScript Guide** (`developer.mozilla.org`)
   - 🐹 **Go Language Documentation** (`go.dev`)

5. **Crawler Pipeline & Status Page (`/crawler`)**:
   - Real-time dashboard showing which sites are **COMPLETED**, which is **CRAWLING**, and which are **PENDING / REMAINING**.
   - Live document count, link count, current crawl depth, and queue size.
   - Streaming event feed directly from MongoDB `crawler_logs`.

6. **Interactive PageRank Visualizer & Simulator (`/pagerank`)**:
   - Interactive force-directed canvas displaying nodes, directed hyper-link arrows, domain clusters, and node sizes proportional to PageRank authority.
   - Power iteration controls: step forward, run to convergence, adjust damping factor slider ($d$).
   - Live Page Authority Leaderboard ranking top pages.

7. **Next.js Frontend Rewrite**:
   - Full rewrite using Next.js while **strictly preserving the original look & feel**:
     - Minimalist Google-like home search screen.
     - "1/10 of a googol is 100 quintillion." pill.
     - Footer attribution to Jonathan Correa.
     - Light/Dark mode toggling.
     - Collapsible, resizable slide-out terminal debug console with live execution logs.

---

## Quick Start

### 1. Start MongoDB
```bash
./scripts/start_mongo.sh
```

### 2. Run Next.js App
```bash
npm run dev
# or for production:
npm run build && npm start
```
Open `http://localhost:3000` in your browser.

### 3. Run Web Crawler & PageRank
```bash
# Crawl all 7 documentation sites (polite delay 1-2s, 3 layers deep)
npm run crawler

# Recompute PageRank on MongoDB corpus
npm run pagerank
```

---

## Architecture

```
quintillion-search/
├── crawler/
│   ├── crawler.py          # Python BFS web crawler with politeness and link extraction
│   └── pagerank.py         # PageRank power iteration graph engine
├── data/
│   └── db/                 # Local MongoDB data directory
├── lib/
│   ├── db.js               # MongoDB connection client & collection helper
│   ├── stemmer.js          # Morphological stemming rules & tokenization
│   └── hybridRank.js       # Hybrid SEO + PageRank composite scoring
├── pages/
│   ├── _app.js             # Global App & Head metadata
│   ├── index.js            # Main Search Engine (Home View, Results View, Debug Terminal)
│   ├── crawler.js          # Live Crawler Pipeline & Corpus Monitor
│   ├── pagerank.js         # Interactive PageRank Graph Simulator & Visualizer
│   └── api/
│       ├── search.js       # Hybrid search query endpoint
│       ├── crawler/
│       │   ├── status.js   # Live crawl status & logs API
│       │   └── start.js    # Background crawler trigger API
│       └── pagerank/
│           ├── graph.js    # Graph nodes & edges API for visualizer
│           └── calculate.js# PageRank execution API
├── public/                 # Static assets & icons
├── scripts/
│   └── start_mongo.sh      # Local MongoDB startup utility
└── styles/
    └── globals.css         # Preserved original UI styles + dark mode + dashboard
```
