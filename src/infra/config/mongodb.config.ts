import { MongoClient } from 'mongodb';

import vars from './vars.config';

let mongodb: MongoClient | undefined;

export function getMongoClient(): MongoClient {
  mongodb ??= new MongoClient(vars.MONGODB_URL);
  return mongodb;
}

export async function closeMongoConnection(): Promise<void> {
  const client = mongodb;
  mongodb = undefined;
  await client?.close();
}
