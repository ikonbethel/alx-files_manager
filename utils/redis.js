// RedisClient
const redis = require('redis');
const { promisify } = require('util');

/**
 * A class representing a Redis client.
 */
class RedisClient {
  /**
   * Constructs a new RedisClient instance.
   */
  constructor() {
    this.isConnected = true;
    this.client = redis.createClient();

    /**
     * Event handler for 'connect' event.
     * Sets isConnected to true when the client connects to the Redis server.
     */
    this.client.on('connect', () => {
      this.isConnected = true;
    });

    /**
     * Event handler for 'error' event.
     * Logs the error message and sets isConnected to false when the client
     * fails to connect to the Redis server.
     * @param {Error} err - The error object.
     */
    this.client.on('error', (err) => {
      console.error('Redis client failed to connect:', err.message || err.toString());
      this.isConnected = false;
    });

    /**
     * Asynchronously gets the value of a key.
     * @type {Function}
     */
    this.getAsync = promisify(this.client.get).bind(this.client);

    /**
     * Asynchronously sets the value of a key.
     * @type {Function}
     */
    this.setAsync = promisify(this.client.set).bind(this.client);

    /**
     * Asynchronously deletes a key.
     * @type {Function}
     */
    this.delAsync = promisify(this.client.del).bind(this.client);

    /**
     * Asynchronously sets an expiration time for a key.
     * @type {Function}
     */
    this.expireAsync = promisify(this.client.expire).bind(this.client);
  }

  /**
   * Checks if the client is connected to the Redis server.
   * @returns {boolean} - True if connected, false otherwise.
   */
  isAlive() {
    return this.isConnected;
  }

  /**
   * Asynchronously gets the value of a key.
   * @param {string} key - The key to get the value of.
   * @returns {Promise<string|null>} - The value of the key or null if an error occurred.
   */
  async get(key) {
    try {
      const value = await this.getAsync(key);
      return value;
    } catch (err) {
      return null;
    }
  }

  /**
   * Asynchronously sets the value of a key with an expiration time.
   * @param {string} key - The key to set the value of.
   * @param {string} value - The value to set.
   * @param {number} duration - The expiration time in seconds.
   * @returns {Promise<string|null>} - The error message if an error occurred, otherwise null.
   */
  async set(key, value, duration) {
    try {
      await this.setAsync(key, value);
      return await this.expireAsync(key, duration);
    } catch (err) {
      return err.toString();
    }
  }

  /**
   * Asynchronously deletes a key.
   * @param {string} key - The key to delete.
   * @returns {Promise<string|null>} - The error message if an error occurred, otherwise null.
   */
  async del(key) {
    try {
      return await this.delAsync(key);
    } catch (err) {
      return err.toString();
    }
  }
}

const redisClient = new RedisClient();

module.exports = redisClient;
