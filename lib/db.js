import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const options = {};

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

export async function getDatabase(dbName = 'quintillion') {
  const clientInstance = await clientPromise;
  const db = clientInstance.db(dbName);
  return {
    raw: db,
    collection: (name) => db.collection(name),
    pages: db.collection('pages'),
    links: db.collection('links'),
    crawler_status: db.collection('crawler_status'),
    crawler_logs: db.collection('crawler_logs'),
    pagerank_metadata: db.collection('pagerank_metadata')
  };
}
