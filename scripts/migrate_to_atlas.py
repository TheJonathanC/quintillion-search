#!/usr/bin/env python3
"""
Quintillion Search Engine - Migrate local MongoDB database to MongoDB Atlas
Usage:
  python3 scripts/migrate_to_atlas.py "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority"
Or put MONGODB_URI in .env.local and run:
  python3 scripts/migrate_to_atlas.py
"""

import sys
import os
from pymongo import MongoClient, ASCENDING

def get_target_uri():
    if len(sys.argv) > 1:
        return sys.argv[1]
    
    uri = os.environ.get("MONGODB_URI")
    if uri and "127.0.0.1" not in uri and "localhost" not in uri:
        return uri
        
    for env_file in ('.env.local', '.env'):
        env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), env_file)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('MONGODB_URI='):
                        val = line.split('=', 1)[1].strip().strip('\'"')
                        if val and "127.0.0.1" not in val and "localhost" not in val:
                            return val
    return None

def main():
    target_uri = get_target_uri()
    if not target_uri:
        print("❌ Error: No MongoDB Atlas URI provided.")
        print("\nUsage:")
        print("  python3 scripts/migrate_to_atlas.py \"mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority\"")
        print("or create .env.local with:")
        print("  MONGODB_URI=\"mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority\"")
        sys.exit(1)

    source_uri = "mongodb://127.0.0.1:27017/"
    db_name = "quintillion"

    print(f"🔄 Connecting to local source: {source_uri}...")
    try:
        source_client = MongoClient(source_uri, serverSelectionTimeoutMS=4000)
        source_db = source_client[db_name]
        source_client.admin.command('ping')
    except Exception as e:
        print(f"❌ Failed to connect to local MongoDB: {e}")
        print("Make sure local MongoDB is running: ./scripts/start_mongo.sh")
        sys.exit(1)

    masked_target = target_uri
    if "@" in target_uri:
        proto, rest = target_uri.split("://", 1)
        creds, host = rest.split("@", 1)
        masked_target = f"{proto}://***@{host}"

    print(f"☁️ Connecting to MongoDB Atlas: {masked_target}...")
    try:
        target_client = MongoClient(target_uri, serverSelectionTimeoutMS=10000)
        target_db = target_client[db_name]
        target_client.admin.command('ping')
        print("✅ Successfully connected to MongoDB Atlas!")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB Atlas: {e}")
        sys.exit(1)

    collections = ['pages', 'links', 'crawler_status', 'crawler_logs', 'pagerank_metadata']

    for col_name in collections:
        source_col = source_db[col_name]
        target_col = target_db[col_name]
        
        count = source_col.count_documents({})
        print(f"\n📦 Migrating collection '{col_name}' ({count} documents)...")
        
        if count == 0:
            print(f"  Empty collection, skipping data copy.")
            continue

        docs = list(source_col.find({}))
        # Upsert documents into target
        target_col.delete_many({})
        target_col.insert_many(docs)
        print(f"  ✅ Inserted {len(docs)} documents into Atlas '{col_name}'.")

    # Recreate essential indexes on Atlas
    print("\n⚡ Creating indexes on MongoDB Atlas...")
    target_db.pages.create_index([("url", ASCENDING)], unique=True)
    target_db.pages.create_index([("domain", ASCENDING)])
    target_db.pages.create_index([("siteId", ASCENDING)])
    target_db.links.create_index([("sourceUrl", ASCENDING), ("targetUrl", ASCENDING)], unique=True)
    target_db.links.create_index([("sourceUrl", ASCENDING)])
    target_db.links.create_index([("targetUrl", ASCENDING)])
    target_db.crawler_status.create_index([("siteId", ASCENDING)], unique=True)
    target_db.crawler_logs.create_index([("timestamp", ASCENDING)])
    print("✅ Indexes created successfully.")

    # Save to .env.local if not already present
    env_local_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
    if not os.path.exists(env_local_path):
        with open(env_local_path, 'w') as f:
            f.write(f'MONGODB_URI="{target_uri}"\n')
        print(f"📄 Saved Atlas URI to .env.local")

    print("\n🎉 Migration complete! Next.js and the Python crawler are now configured to use MongoDB Atlas.")

if __name__ == "__main__":
    main()
