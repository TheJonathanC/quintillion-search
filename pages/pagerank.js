import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

export default function PageRankVisualizer() {
  const canvasRef = useRef(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [], metadata: null });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Simulation controls
  const [dampingFactor, setDampingFactor] = useState(0.85);
  const [currentIteration, setCurrentIteration] = useState(0);
  const [simScores, setSimScores] = useState({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [simDelta, setSimDelta] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Force simulation state
  const simNodesRef = useRef([]);
  const simEdgesRef = useRef([]);
  const animationFrameRef = useRef(null);
  const dragNodeRef = useRef(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const dark = savedTheme === 'dark';
    setIsDarkMode(dark);
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');

    fetchGraph();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const fetchGraph = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/pagerank/graph?limit=90');
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
        initSimulation(data.nodes, data.edges);

        // Initialize simulation scores from loaded data
        const initial = {};
        data.nodes.forEach(n => {
          initial[n.id] = n.pageRank;
        });
        setSimScores(initial);
        if (data.metadata?.iterations) {
          setCurrentIteration(data.metadata.iterations);
          setSimDelta(data.metadata.finalDelta || 0.000001);
        }
      }
    } catch (err) {
      console.error('Failed to load graph data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const initSimulation = (nodes, edges) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 520;

    canvas.width = width;
    canvas.height = height;

    // Arrange nodes in circle/clusters initially
    const maxPR = Math.max(...nodes.map(n => n.pageRank || 0.001), 0.001);

    simNodesRef.current = nodes.map((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = 180 + (i % 3) * 40;
      return {
        ...node,
        x: width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        radius: Math.max(5, Math.min(22, 6 + Math.sqrt((node.pageRank || 0.001) / maxPR) * 16))
      };
    });

    simEdgesRef.current = edges;

    // Start physics loop
    startPhysicsLoop();
  };

  const startPhysicsLoop = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const tick = () => {
      const width = canvas.width;
      const height = canvas.height;
      const nodes = simNodesRef.current;
      const edges = simEdgesRef.current;

      // Apply physics forces:
      // 1. Repulsion between nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 1;
          const dist = Math.sqrt(distSq);

          if (dist < 180) {
            const force = 180 / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            n1.vx -= fx;
            n1.vy -= fy;
            n2.vx += fx;
            n2.vy += fy;
          }
        }
      }

      // 2. Attraction along edges
      edges.forEach(e => {
        const src = nodes[e.source];
        const tgt = nodes[e.target];
        if (src && tgt) {
          const dx = tgt.x - src.x;
          const dy = tgt.y - src.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 80) * 0.004;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          src.vx += fx;
          src.vy += fy;
          tgt.vx -= fx;
          tgt.vy -= fy;
        }
      });

      // 3. Centering force + velocity decay + bounding
      nodes.forEach(n => {
        if (dragNodeRef.current && dragNodeRef.current.id === n.id) {
          n.vx = 0;
          n.vy = 0;
          return;
        }
        n.vx += (width / 2 - n.x) * 0.001;
        n.vy += (height / 2 - n.y) * 0.001;
        n.vx *= 0.88;
        n.vy *= 0.88;
        n.x += n.vx;
        n.y += n.vy;

        // Bounds
        n.x = Math.max(n.radius + 10, Math.min(width - n.radius - 10, n.x));
        n.y = Math.max(n.radius + 10, Math.min(height - n.radius - 10, n.y));
      });

      // Draw frame
      ctx.clearRect(0, 0, width, height);

      // Draw edges
      edges.forEach(e => {
        const src = nodes[e.source];
        const tgt = nodes[e.target];
        if (!src || !tgt) return;

        const isHighlighted =
          hoveredNode && (hoveredNode.id === src.id || hoveredNode.id === tgt.id);

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.strokeStyle = isHighlighted ? '#8ab4f8' : 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = isHighlighted ? 1.8 : 0.8;
        ctx.stroke();

        // Draw arrow head on target
        if (isHighlighted || edges.length < 120) {
          const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
          const arrowX = tgt.x - Math.cos(angle) * (tgt.radius + 3);
          const arrowY = tgt.y - Math.sin(angle) * (tgt.radius + 3);
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(
            arrowX - 6 * Math.cos(angle - Math.PI / 6),
            arrowY - 6 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            arrowX - 6 * Math.cos(angle + Math.PI / 6),
            arrowY - 6 * Math.sin(angle + Math.PI / 6)
          );
          ctx.fillStyle = isHighlighted ? '#8ab4f8' : 'rgba(255, 255, 255, 0.2)';
          ctx.fill();
        }
      });

      // Draw nodes
      nodes.forEach(n => {
        const isHovered = hoveredNode && hoveredNode.id === n.id;
        const isSelected = selectedNode && selectedNode.id === n.id;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + (isHovered ? 4 : 0), 0, 2 * Math.PI);
        ctx.fillStyle = n.color || '#4285f4';
        ctx.fill();

        if (isSelected || isHovered) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.stroke();
        }

        // Draw node title if high PR or hovered
        if (n.radius > 14 || isHovered || isSelected) {
          ctx.fillStyle = '#ffffff';
          ctx.font = isHovered ? 'bold 11px sans-serif' : '10px sans-serif';
          ctx.textAlign = 'center';
          const label = n.title.length > 18 ? n.title.substring(0, 16) + '...' : n.title;
          ctx.fillText(label, n.x, n.y + n.radius + 12);
        }
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  // Mouse interaction on canvas
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const hit = simNodesRef.current.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6);
    });

    if (hit) {
      dragNodeRef.current = hit;
      setSelectedNode(hit);
    }
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (dragNodeRef.current) {
      dragNodeRef.current.x = x;
      dragNodeRef.current.y = y;
      return;
    }

    const hit = simNodesRef.current.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return dx * dx + dy * dy <= (n.radius + 6) * (n.radius + 6);
    });

    setHoveredNode(hit || null);
    canvas.style.cursor = hit ? 'pointer' : 'default';
  };

  const handleMouseUp = () => {
    dragNodeRef.current = null;
  };

  // Step next power iteration
  const stepIteration = () => {
    const nodes = graphData.nodes;
    const edges = graphData.edges;
    const N = nodes.length;
    if (N === 0) return;

    const d = dampingFactor;
    const currentPR = { ...simScores };
    const nextPR = {};

    // Build out_degree & in_links map
    const outDegree = {};
    const inLinks = {};
    nodes.forEach(n => {
      outDegree[n.id] = 0;
      inLinks[n.id] = [];
    });

    edges.forEach(e => {
      outDegree[e.source] = (outDegree[e.source] || 0) + 1;
      inLinks[e.target].push(e.source);
    });

    // Dangling nodes contribution
    let danglingMass = 0;
    nodes.forEach(n => {
      if (outDegree[n.id] === 0) {
        danglingMass += currentPR[n.id] || 1 / N;
      }
    });

    const baseScore = (1 - d) / N + (d * danglingMass) / N;
    let delta = 0;

    nodes.forEach(n => {
      let incomingSum = 0;
      inLinks[n.id].forEach(srcId => {
        if (outDegree[srcId] > 0) {
          incomingSum += (currentPR[srcId] || 1 / N) / outDegree[srcId];
        }
      });
      const newScore = baseScore + d * incomingSum;
      nextPR[n.id] = newScore;
      delta += Math.abs(newScore - (currentPR[n.id] || 0));
    });

    // Normalize
    const totalMass = Object.values(nextPR).reduce((a, b) => a + b, 0);
    if (totalMass > 0) {
      nodes.forEach(n => {
        nextPR[n.id] /= totalMass;
      });
    }

    setSimScores(nextPR);
    setCurrentIteration(prev => prev + 1);
    setSimDelta(delta);

    // Update node radii in physics
    const maxPR = Math.max(...Object.values(nextPR), 0.001);
    simNodesRef.current.forEach(n => {
      const score = nextPR[n.id] || 0.001;
      n.radius = Math.max(5, Math.min(24, 6 + Math.sqrt(score / maxPR) * 18));
      n.pageRank = score;
    });
  };

  const resetSimulation = () => {
    const N = graphData.nodes.length;
    if (N === 0) return;
    const uniform = {};
    graphData.nodes.forEach(n => {
      uniform[n.id] = 1 / N;
    });
    setSimScores(uniform);
    setCurrentIteration(0);
    setSimDelta(1.0);

    simNodesRef.current.forEach(n => {
      n.radius = 8;
      n.pageRank = 1 / N;
    });
  };

  const runToConvergence = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch('/api/pagerank/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ damping: dampingFactor, iterations: 100 })
      });
      if (res.ok) {
        const json = await res.json();
        await fetchGraph();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSimulating(false);
    }
  };

  // Sort nodes for leaderboard
  const sortedLeaderboard = [...graphData.nodes].sort((a, b) => {
    const sA = simScores[a.id] !== undefined ? simScores[a.id] : a.pageRank;
    const sB = simScores[b.id] !== undefined ? simScores[b.id] : b.pageRank;
    return sB - sA;
  });

  return (
    <div className="pagerank-page-container">
      {/* Top Header Bar */}
      <header className="crawler-header-bar">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px' }}>
            <Link href="/" className="logo-small" style={{ fontSize: '24px' }}>
              Quintillion
            </Link>
            <span style={{ color: 'var(--text-secondary)' }}>/</span>
            <h1>PageRank Graph Simulation & Visualizer</h1>
          </div>
          <p className="page-subtitle">
            Simulating Google's PageRank algorithm over directed web hyper-links crawled from documentation sites.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/" className="nav-link-btn">
            🔍 Search Engine
          </Link>
          <Link href="/crawler" className="nav-link-btn">
            📊 Crawler Pipeline
          </Link>
          <button
            className="dark-mode-toggle"
            onClick={() => {
              const nextDark = !isDarkMode;
              setIsDarkMode(nextDark);
              localStorage.setItem('theme', nextDark ? 'dark' : 'light');
              if (nextDark) document.documentElement.setAttribute('data-theme', 'dark');
              else document.documentElement.removeAttribute('data-theme');
            }}
            title="Toggle theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Main Graph & Sidebar Layout */}
      <div className="pagerank-layout">
        {/* Left: Force Directed Canvas */}
        <div className="graph-canvas-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span style={{ fontWeight: '600', fontSize: '15px' }}>Directed Intra-Web Link Graph</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '10px' }}>
                ({graphData.nodes.length} nodes, {graphData.edges.length} directed links)
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Click or drag nodes • Hover to inspect link flows
            </div>
          </div>

          <div className="canvas-wrapper">
            <canvas
              ref={canvasRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />

            {/* Legend */}
            <div className="graph-legend">
              <div style={{ fontWeight: '600', marginBottom: '2px' }}>Documentation Domains</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#3776AB' }}></span> docs.python.org</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#E06D53' }}></span> manipal.edu</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#61DAFB' }}></span> react.dev</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#009688' }}></span> fastapi.tiangolo.com</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#707070' }}></span> expressjs.com</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#83B81A' }}></span> developer.mozilla.org</div>
              <div className="legend-item"><span className="legend-dot" style={{ background: '#00ADD8' }}></span> go.dev</div>
            </div>
          </div>
        </div>

        {/* Right: Simulation Controls & Inspector */}
        <div className="sim-sidebar">
          {/* Controls Card */}
          <div className="control-card">
            <h3>Simulation & Convergence</h3>

            <div className="control-group">
              <div className="control-label">
                <span>Damping Factor (d):</span>
                <strong>{dampingFactor}</strong>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.95"
                step="0.01"
                value={dampingFactor}
                onChange={(e) => setDampingFactor(parseFloat(e.target.value))}
                className="slider-input"
              />
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                Teleport Probability: {(1 - dampingFactor).toFixed(2)} (15% random jump)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <div style={{ background: 'var(--hover-bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Iteration</div>
                <div style={{ fontSize: '20px', fontWeight: '700' }}>#{currentIteration}</div>
              </div>
              <div style={{ background: 'var(--hover-bg)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Convergence Δ</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: simDelta < 1e-5 ? 'var(--accent-green)' : 'var(--text-color)' }}>
                  {simDelta.toExponential(2)}
                </div>
              </div>
            </div>

            <div className="button-row" style={{ flexDirection: 'column' }}>
              <button className="btn-primary" onClick={stepIteration}>
                ▶️ Step Next Iteration
              </button>
              <button
                className="btn-secondary"
                disabled={isSimulating}
                onClick={runToConvergence}
              >
                {isSimulating ? 'Computing...' : '⚡ Run to Convergence (<10⁻⁶)'}
              </button>
              <button className="btn-secondary" onClick={resetSimulation}>
                🔄 Reset to Uniform (1/N)
              </button>
            </div>

            <div className="math-explainer">
              <strong>PageRank Power Iteration:</strong>
              <div style={{ fontFamily: 'monospace', margin: '4px 0' }}>
                PR(p) = (1-d)/N + d • ∑ [ PR(q) / L(q) ]
              </div>
              Where <em>L(q)</em> is out-degree of page <em>q</em>, and <em>d</em> is probability of following hyperlinks.
            </div>
          </div>

          {/* Node Inspector Card */}
          <div className="control-card">
            <h3>Page Inspector</h3>
            {hoveredNode || selectedNode ? (
              (() => {
                const n = hoveredNode || selectedNode;
                const score = simScores[n.id] !== undefined ? simScores[n.id] : n.pageRank;
                return (
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', color: 'var(--accent-blue)' }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all', marginBottom: '12px' }}>
                      <a href={n.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>
                        {n.url}
                      </a>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px' }}>
                      <div><strong>PageRank:</strong> {score?.toFixed(6)}</div>
                      <div><strong>Domain:</strong> {n.domain}</div>
                      <div><strong>In-Degree:</strong> {n.inDegree} in-links</div>
                      <div><strong>Out-Degree:</strong> {n.outDegree} out-links</div>
                      <div><strong>Authority Pts:</strong> +{n.pageRankNormalized || 5} pts</div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Hover or click any node in the graph above to inspect its link topology and PageRank score.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Authority Leaderboard Section */}
      <section className="sites-section">
        <div className="section-header-flex">
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Page Authority Leaderboard (Top Ranked Web Pages)</h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Pages sorted by PageRank probability mass. These scores feed directly into the hybrid search ranking model.
            </p>
          </div>
        </div>

        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Page Title & URL</th>
              <th>Domain</th>
              <th>In-Links</th>
              <th>Out-Links</th>
              <th>PageRank Score</th>
              <th>Hybrid Authority</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeaderboard.slice(0, 15).map((page, idx) => {
              const score = simScores[page.id] !== undefined ? simScores[page.id] : page.pageRank;
              return (
                <tr key={page.id}>
                  <td style={{ fontWeight: '700', color: idx < 3 ? 'var(--accent-blue)' : 'var(--text-color)' }}>
                    #{idx + 1}
                  </td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{page.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                      {page.url}
                    </div>
                  </td>
                  <td>
                    <span className="result-domain-badge">{page.domain}</span>
                  </td>
                  <td>{page.inDegree}</td>
                  <td>{page.outDegree}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                    {score ? score.toFixed(6) : '0.000000'}
                  </td>
                  <td>
                    <span className="score-item score-item-pr">
                      +{page.pageRankNormalized || (1 + Math.round((score || 0) * 100))} pts
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
