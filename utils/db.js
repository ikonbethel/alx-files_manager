/* eslint-disable class-methods-use-this */
// const { MongoClient, ObjectId } = require('mongodb');
import { MongoClient, ObjectId } from 'mongodb';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 27017;
const DB_DATABASE = process.env.DB_DATABASE || 'files_manager';

/**
 * A class representing a MongoDB client for the Files Manager application.
 */
class DBClient {
  /**
   * Creates a new DBClient instance.
   */
  constructor() {
    this.url = `mongodb://${DB_HOST}:${DB_PORT}/${DB_DATABASE}`;
    this.client = new MongoClient(this.url, { useUnifiedTopology: true });
    this.db = null;
    this.connected = false;

    this.connect();
  }

  /**
   * Connects to the MongoDB server.
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      await this.client.connect();
      this.db = this.client.db(DB_DATABASE);
      this.connected = true;
      // console.log('Connected successfully to MongoDB');
    } catch (err) {
      // console.error('Failed to connect to MongoDB', err);
      this.connected = false;
    }
  }

  /**
   * Checks if the client is connected to the MongoDB server.
   * @returns {boolean} True if connected, false otherwise.
   */
  isAlive() {
    return this.connected;
  }

  /**
   * Counts the number of users in the 'users' collection.
   * @returns {Promise<number>} The number of users.
   */
  async nbUsers() {
    if (!this.db) return 0;
    return this.db.collection('users').countDocuments();
  }

  /**
   * Counts the number of files in the 'files' collection.
   * @returns {Promise<number>} The number of files.
   */
  async nbFiles() {
    if (!this.db) return 0;
    const total = await this.db.collection('files').countDocuments();
    return total;
  }

  getObjectId(id) {
    return new ObjectId(id);
  }
}

const dbClient = new DBClient();
export default dbClient;
