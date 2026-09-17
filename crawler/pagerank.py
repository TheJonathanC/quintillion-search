#!/usr/bin/env python3
"""
Quintillion Search Engine - PageRank Engine
Calculates PageRank across crawled pages and link graph using power iteration.
Saves PageRank scores into MongoDB pages collection and graph metadata.
"""

import math
from datetime import datetime, timezone
import os
from pymongo import MongoClient, UpdateOne

def get_mongo_uri(default="mongodb://127.0.0.1:27017/"):
    uri = os.environ.get("MONGODB_URI")
    if uri:
        return uri
    for env_name in ('.env.local', '.env'):
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), env_name)
        if os.path.exists(env_path):
            try:
                with open(env_path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith('MONGODB_URI='):
                            val = line.split('=', 1)[1].strip().strip('\'"')
                            if val:
                                return val
            except Exception:
                pass
    return default

class PageRankEngine:
    def __init__(self, mongo_uri=None, db_name="quintillion"):
        self.mongo_uri = mongo_uri or get_mongo_uri()
        self.client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=5000)
        self.db = self.client[db_name]

    def compute_pagerank(self, damping_factor=0.85, max_iterations=100, tolerance=1e-6):
        """
        Runs PageRank power iteration on all pages currently stored in MongoDB.
        """
        print(f"[PageRank] Loading pages and links from MongoDB...")
        
        # Load all crawled page URLs
        pages_cursor = self.db.pages.find({}, {"url": 1, "title": 1, "domain": 1, "siteId": 1})
        pages = list(pages_cursor)
        urls = [p["url"] for p in pages]
        url_set = set(urls)
        N = len(urls)

        if N == 0:
            print("[PageRank] No pages found to compute PageRank.")
            return {"error": "No pages found", "totalNodes": 0}

        print(f"[PageRank] Graph contains {N} unique page nodes.")

        # Load internal edges where both source and target are indexed
        # Also include target URLs even if external to keep track of outDegree
        edges_cursor = self.db.links.find({})
        
        # Adjacency: out_links[u] = list of targets, in_links[v] = list of sources
        out_links = {u: set() for u in urls}
        in_links = {u: set() for u in urls}
        total_edges_loaded = 0

        for edge in edges_cursor:
            src = edge.get("sourceUrl")
            tgt = edge.get("targetUrl")
            total_edges_loaded += 1

            if src in url_set:
                # If target is in our indexed pages, add to in_links
                if tgt in url_set and src != tgt:
                    out_links[src].add(tgt)
                    in_links[tgt].add(src)

        active_edges_count = sum(len(tgts) for tgts in out_links.values())
        print(f"[PageRank] Active intra-graph edges: {active_edges_count} (out of {total_edges_loaded} raw links)")

        # Initial uniform distribution: PR_0(u) = 1 / N
        pr = {u: 1.0 / N for u in urls}
        iteration_history = []

        # Power iteration
        converged = False
        iteration = 0

        while iteration < max_iterations and not converged:
            iteration += 1
            new_pr = {}
            
            # Compute total probability mass from dangling nodes (pages with out-degree 0)
            dangling_sum = sum(pr[u] for u in urls if len(out_links[u]) == 0)
            dangling_contrib = (damping_factor * dangling_sum) / N
            base_score = ((1.0 - damping_factor) / N) + dangling_contrib

            delta = 0.0
            for v in urls:
                # Sum of PR(u) / L(u) for all u pointing to v
                incoming_sum = sum(pr[u] / len(out_links[u]) for u in in_links[v] if len(out_links[u]) > 0)
                new_score = base_score + (damping_factor * incoming_sum)
                new_pr[v] = new_score
                delta += abs(new_score - pr[v])

            # Normalize to ensure numerical sum = 1.0
            total_mass = sum(new_pr.values())
            if total_mass > 0:
                for v in urls:
                    new_pr[v] /= total_mass

            iteration_history.append({
                "iteration": iteration,
                "delta": delta,
                "topRanked": sorted([{"url": u, "pr": new_pr[u]} for u in urls[:5]], key=lambda x: x["pr"], reverse=True)
            })

            pr = new_pr

            if delta < tolerance:
                converged = True
                print(f"[PageRank] Converged at iteration {iteration} with delta {delta:.2e}")
                break

        if not converged:
            print(f"[PageRank] Stopped at max iterations ({max_iterations}) with delta {delta:.2e}")

        # Compute max and min for normalization
        max_pr = max(pr.values()) if pr else 1.0
        min_pr = min(pr.values()) if pr else 0.0
        
        # Scaling: create a 0-25 point authority score for hybrid search
        # Using log scaling or linear scaling with dampening
        bulk_updates = []
        ranked_pages = []

        for p in pages:
            u = p["url"]
            score = pr.get(u, 1.0 / N)
            in_deg = len(in_links.get(u, set()))
            out_deg = len(out_links.get(u, set()))
            
            # Normalized 0-25 points for search ranking:
            # Min is 1 point, max up to 25 points
            if max_pr > min_pr:
                # Logarithmic boost
                ratio = (score - min_pr) / (max_pr - min_pr)
                authority_points = round(1.0 + 24.0 * (ratio ** 0.5), 2)
            else:
                authority_points = 5.0

            bulk_updates.append(UpdateOne(
                {"url": u},
                {"$set": {
                    "pageRank": score,
                    "pageRankNormalized": authority_points,
                    "inDegree": in_deg,
                    "outDegree": out_deg,
                    "pageRankUpdated": datetime.now(timezone.utc)
                }}
            ))

            ranked_pages.append({
                "url": u,
                "title": p.get("title", ""),
                "domain": p.get("domain", ""),
                "siteId": p.get("siteId", ""),
                "pageRank": score,
                "authorityPoints": authority_points,
                "inDegree": in_deg,
                "outDegree": out_deg
            })

        if bulk_updates:
            self.db.pages.bulk_write(bulk_updates, ordered=False)

        ranked_pages.sort(key=lambda x: x["pageRank"], reverse=True)

        metadata = {
            "totalNodes": N,
            "totalEdges": active_edges_count,
            "iterations": iteration,
            "converged": converged,
            "dampingFactor": damping_factor,
            "tolerance": tolerance,
            "finalDelta": delta,
            "calculatedAt": datetime.now(timezone.utc),
            "topPages": ranked_pages[:20]
        }

        self.db.pagerank_metadata.update_one(
            {"type": "latest"},
            {"$set": metadata},
            upsert=True
        )

        print(f"[PageRank] Updated PageRank for {N} pages. Top page: {ranked_pages[0]['url']} (PR: {ranked_pages[0]['pageRank']:.6f}, Authority: {ranked_pages[0]['authorityPoints']} pts)")
        return metadata

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Quintillion PageRank Calculator")
    parser.add_argument("--damping", type=float, default=0.85, help="Damping factor (default 0.85)")
    parser.add_argument("--iterations", type=int, default=100, help="Max iterations")
    parser.add_argument("--tolerance", type=float, default=1e-6, help="Convergence tolerance")
    args = parser.parse_args()

    engine = PageRankEngine()
    engine.compute_pagerank(damping_factor=args.damping, max_iterations=args.iterations, tolerance=args.tolerance)

if __name__ == "__main__":
    main()
