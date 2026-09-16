#!/usr/bin/env python3
"""
Quintillion Search Engine - Web Crawler v2
Crawls documentation websites up to 3 layers deep with polite request intervals (1-2s).
Stores page contents, metadata, and link graph in MongoDB.
"""

import sys
import os
import time
import random
import re
import urllib.parse
from datetime import datetime, timezone
import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient, ASCENDING, UpdateOne

# Target documentation sites configuration: Python docs, Manipal.edu, + 5 best doc sites
TARGET_SITES = [
    {
        "id": "python_docs",
        "name": "Python 3 Documentation",
        "seed_url": "https://docs.python.org/3/",
        "allowed_domains": ["docs.python.org"],
        "path_prefix": "",
        "max_pages": 30,
        "max_depth": 3,
        "description": "Official Python 3 reference manuals, tutorials, and standard library documentation."
    },
    {
        "id": "manipal_edu",
        "name": "Manipal Academy of Higher Education",
        "seed_url": "https://manipal.edu/",
        "allowed_domains": ["manipal.edu"],
        "path_prefix": "",
        "max_pages": 30,
        "max_depth": 3,
        "description": "Premier Indian university documentation, programs, admissions, and campus resources."
    },
    {
        "id": "react_docs",
        "name": "React Documentation",
        "seed_url": "https://react.dev/learn",
        "allowed_domains": ["react.dev"],
        "path_prefix": "",
        "max_pages": 30,
        "max_depth": 3,
        "description": "Official React framework documentation, component models, hooks, and quick start."
    },
    {
        "id": "fastapi_docs",
        "name": "FastAPI Documentation",
        "seed_url": "https://fastapi.tiangolo.com/",
        "allowed_domains": ["fastapi.tiangolo.com"],
        "path_prefix": "",
        "max_pages": 30,
        "max_depth": 3,
        "description": "High-performance Python web framework documentation and tutorial guides."
    },
    {
        "id": "express_docs",
        "name": "Express.js Documentation",
        "seed_url": "https://expressjs.com/en/starter/installing.html",
        "allowed_domains": ["expressjs.com"],
        "path_prefix": "",
        "max_pages": 30,
        "max_depth": 3,
        "description": "Fast, unopinionated, minimalist web framework for Node.js documentation."
    },
    {
        "id": "mdn_js",
        "name": "MDN JavaScript Documentation",
        "seed_url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide",
        "allowed_domains": ["developer.mozilla.org"],
        "path_prefix": "/en-US/docs/Web/JavaScript",
        "max_pages": 30,
        "max_depth": 3,
        "description": "Mozilla Developer Network comprehensive JavaScript language reference and guides."
    },
    {
        "id": "go_docs",
        "name": "Go Language Documentation",
        "seed_url": "https://go.dev/doc/tutorial/getting-started",
        "allowed_domains": ["go.dev"],
        "path_prefix": "/doc",
        "max_pages": 30,
        "max_depth": 3,
        "description": "Official Golang documentation, tutorials, specifications, and packages."
    }
]

SKIPPED_EXTENSIONS = (
    '.pdf', '.zip', '.tar', '.gz', '.tgz', '.exe', '.dmg', '.pkg',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp',
    '.mp3', '.mp4', '.avi', '.mov', '.wav', '.ogg',
    '.css', '.js', '.json', '.xml', '.rss', '.woff', '.woff2', '.ttf', '.eot'
)

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

class PoliteWebCrawler:
    def __init__(self, mongo_uri=None, db_name="quintillion"):
        self.mongo_uri = mongo_uri or get_mongo_uri()
        self.db_name = db_name
        self.client = None
        self.db = None
        self.init_db()

        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 QuintillionBot/2.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
        })

    def init_db(self):
        try:
            self.client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=3000)
            self.db = self.client[self.db_name]
            self.client.admin.command('ping')
            print(f"[Crawler] Connected to MongoDB at {self.mongo_uri} (db: {self.db_name})")

            self.db.pages.create_index([("url", ASCENDING)], unique=True)
            self.db.pages.create_index([("domain", ASCENDING)])
            self.db.pages.create_index([("siteId", ASCENDING)])
            self.db.links.create_index([("sourceUrl", ASCENDING), ("targetUrl", ASCENDING)], unique=True)
            self.db.links.create_index([("sourceUrl", ASCENDING)])
            self.db.links.create_index([("targetUrl", ASCENDING)])
            self.db.crawler_status.create_index([("siteId", ASCENDING)], unique=True)
            self.db.crawler_logs.create_index([("timestamp", ASCENDING)])
        except Exception as e:
            print(f"[Crawler WARNING] Could not connect to MongoDB: {e}")
            self.client = None
            self.db = None

    def log_event(self, site_id, level, message):
        timestamp = datetime.now(timezone.utc)
        print(f"[{timestamp.strftime('%H:%M:%S')}] [{site_id}] [{level.upper()}] {message}")
        if self.db is not None:
            try:
                self.db.crawler_logs.insert_one({
                    "siteId": site_id,
                    "level": level,
                    "message": message,
                    "timestamp": timestamp
                })
            except Exception as e:
                print(f"Failed to write log to DB: {e}")

    def update_site_status(self, site_id, update_fields):
        if self.db is not None:
            try:
                update_fields["lastUpdated"] = datetime.now(timezone.utc)
                self.db.crawler_status.update_one(
                    {"siteId": site_id},
                    {"$set": update_fields},
                    upsert=True
                )
            except Exception as e:
                print(f"Failed to update status in DB: {e}")

    def normalize_url(self, url):
        parsed = urllib.parse.urlparse(url)
        scheme = parsed.scheme.lower()
        if scheme not in ('http', 'https'):
            return None

        netloc = parsed.netloc.lower()
        path = parsed.path or '/'
        if len(path) > 1 and path.endswith('/'):
            path = path[:-1]

        return urllib.parse.urlunparse((scheme, netloc, path, parsed.params, parsed.query, ''))

    def is_valid_url(self, url, site_config):
        if not url:
            return False
        parsed = urllib.parse.urlparse(url)
        
        domain_ok = any(parsed.netloc == domain or parsed.netloc.endswith('.' + domain) for domain in site_config["allowed_domains"])
        if not domain_ok:
            return False

        prefix = site_config.get("path_prefix", "")
        if prefix and not parsed.path.startswith(prefix):
            return False

        path_lower = parsed.path.lower()
        if any(path_lower.endswith(ext) for ext in SKIPPED_EXTENSIONS):
            return False

        return True

    def extract_page_data(self, html, url):
        soup = BeautifulSoup(html, 'html.parser')

        for element in soup(['script', 'style', 'nav', 'footer', 'noscript', 'svg', 'iframe']):
            element.decompose()

        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()
        elif soup.find('h1'):
            title = soup.find('h1').get_text().strip()

        meta_desc = ""
        meta_tag = soup.find('meta', attrs={'name': lambda x: x and x.lower() == 'description'})
        if not meta_tag:
            meta_tag = soup.find('meta', attrs={'property': 'og:description'})
        if meta_tag and meta_tag.get('content'):
            meta_desc = meta_tag['content'].strip()

        headings = []
        for h in soup.find_all(['h1', 'h2', 'h3'])[:15]:
            h_text = h.get_text().strip()
            if h_text and len(h_text) < 200:
                headings.append(h_text)

        body = soup.find('body')
        if body:
            raw_text = body.get_text(separator=' ', strip=True)
            body_text = re.sub(r'\s+', ' ', raw_text).strip()
        else:
            body_text = ""

        extracted_links = set()
        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href'].strip()
            if href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                continue
            resolved = urllib.parse.urljoin(url, href)
            norm_link = self.normalize_url(resolved)
            if norm_link:
                extracted_links.add(norm_link)

        return {
            "title": title or "Untitled Document",
            "metaDescription": meta_desc,
            "headings": headings,
            "bodyText": body_text[:50000],
            "wordCount": len(body_text.split()),
            "outLinks": list(extracted_links)
        }

    def crawl_site(self, site_config, min_delay=1.0, max_delay=2.0):
        site_id = site_config["id"]
        site_name = site_config["name"]
        seed_url = self.normalize_url(site_config["seed_url"])
        max_pages = site_config.get("max_pages", 30)
        max_depth = site_config.get("max_depth", 3)

        self.log_event(site_id, "info", f"Starting polite crawl for '{site_name}' ({seed_url}). Max depth: {max_depth}, Max pages: {max_pages}")
        
        self.update_site_status(site_id, {
            "siteId": site_id,
            "name": site_name,
            "seedUrl": seed_url,
            "allowedDomains": site_config["allowed_domains"],
            "status": "crawling",
            "startedAt": datetime.now(timezone.utc),
            "pagesCrawled": 0,
            "maxPages": max_pages,
            "maxDepth": max_depth,
            "currentDepth": 0,
            "lastError": None
        })

        queue = [(seed_url, 0)]
        visited = set()
        crawled_count = 0

        while queue and crawled_count < max_pages:
            current_url, depth = queue.pop(0)

            if current_url in visited:
                continue

            visited.add(current_url)

            # Polite delay between 1.0 and 2.0s
            delay = random.uniform(min_delay, max_delay)
            time.sleep(delay)

            try:
                self.log_event(site_id, "info", f"[Depth {depth}] Fetching: {current_url} ({crawled_count + 1}/{max_pages})")
                response = self.session.get(current_url, timeout=10, allow_redirects=True)
                
                content_type = response.headers.get('Content-Type', '').lower()
                if 'text/html' not in content_type and 'application/xhtml' not in content_type:
                    self.log_event(site_id, "warning", f"Skipped non-HTML ({content_type}) on {current_url}")
                    continue

                if response.status_code != 200:
                    self.log_event(site_id, "warning", f"HTTP {response.status_code} for {current_url}")
                    continue

                final_url = self.normalize_url(response.url) or current_url
                page_data = self.extract_page_data(response.text, final_url)
                crawled_count += 1

                parsed_url = urllib.parse.urlparse(final_url)
                doc = {
                    "url": final_url,
                    "domain": parsed_url.netloc,
                    "siteId": site_id,
                    "siteName": site_name,
                    "depth": depth,
                    "title": page_data["title"],
                    "metaDescription": page_data["metaDescription"],
                    "headings": page_data["headings"],
                    "bodyText": page_data["bodyText"],
                    "wordCount": page_data["wordCount"],
                    "outLinks": page_data["outLinks"],
                    "crawledAt": datetime.now(timezone.utc),
                    "statusCode": response.status_code,
                    "pageRank": 0.0
                }

                if self.db is not None:
                    self.db.pages.update_one(
                        {"url": final_url},
                        {"$set": doc},
                        upsert=True
                    )

                    link_ops = []
                    for out_url in page_data["outLinks"]:
                        out_domain = urllib.parse.urlparse(out_url).netloc
                        link_ops.append(UpdateOne(
                            {"sourceUrl": final_url, "targetUrl": out_url},
                            {"$set": {
                                "sourceUrl": final_url,
                                "targetUrl": out_url,
                                "sourceDomain": parsed_url.netloc,
                                "targetDomain": out_domain,
                                "siteId": site_id,
                                "discoveredAt": datetime.now(timezone.utc)
                            }},
                            upsert=True
                        ))
                    if link_ops:
                        self.db.links.bulk_write(link_ops, ordered=False)

                if depth < max_depth:
                    for link in page_data["outLinks"]:
                        if link not in visited and self.is_valid_url(link, site_config):
                            if not any(q_url == link for q_url, _ in queue):
                                queue.append((link, depth + 1))

                self.update_site_status(site_id, {
                    "pagesCrawled": crawled_count,
                    "queueSize": len(queue),
                    "currentDepth": depth,
                    "lastCrawledUrl": final_url,
                    "lastCrawledTitle": page_data["title"]
                })

            except requests.RequestException as req_err:
                self.log_event(site_id, "error", f"Request error for {current_url}: {req_err}")
            except Exception as e:
                self.log_event(site_id, "error", f"Error on {current_url}: {e}")

        finished_at = datetime.now(timezone.utc)
        self.log_event(site_id, "success", f"Completed crawl for '{site_name}'. Total pages indexed: {crawled_count}")
        self.update_site_status(site_id, {
            "status": "completed",
            "finishedAt": finished_at,
            "pagesCrawled": crawled_count,
            "queueSize": 0
        })

    def crawl_all(self, min_delay=1.0, max_delay=2.0):
        for site in TARGET_SITES:
            if self.db is not None:
                existing = self.db.crawler_status.find_one({"siteId": site["id"]})
                if not existing:
                    self.db.crawler_status.insert_one({
                        "siteId": site["id"],
                        "name": site["name"],
                        "seedUrl": site["seed_url"],
                        "allowedDomains": site["allowed_domains"],
                        "status": "pending",
                        "pagesCrawled": 0,
                        "maxPages": site.get("max_pages", 30),
                        "maxDepth": site.get("max_depth", 3),
                        "queueSize": 0,
                        "description": site.get("description", "")
                    })

        for site in TARGET_SITES:
            self.crawl_site(site, min_delay=min_delay, max_delay=max_delay)

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Quintillion Web Crawler v2")
    parser.add_argument("--site", choices=[s["id"] for s in TARGET_SITES] + ["all"], default="all", help="Site ID to crawl")
    parser.add_argument("--min-delay", type=float, default=1.0, help="Minimum delay between requests (seconds)")
    parser.add_argument("--max-delay", type=float, default=2.0, help="Maximum delay between requests (seconds)")
    parser.add_argument("--pages", type=int, default=None, help="Override max pages limit")
    args = parser.parse_args()

    crawler = PoliteWebCrawler()

    if args.site == "all":
        if args.pages:
            for s in TARGET_SITES:
                s["max_pages"] = args.pages
        crawler.crawl_all(min_delay=args.min_delay, max_delay=args.max_delay)
    else:
        site_cfg = next(s for s in TARGET_SITES if s["id"] == args.site)
        if args.pages:
            site_cfg["max_pages"] = args.pages
        crawler.crawl_site(site_cfg, min_delay=args.min_delay, max_delay=args.max_delay)

if __name__ == "__main__":
    main()
