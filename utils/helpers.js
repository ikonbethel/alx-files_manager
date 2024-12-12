/* eslint-disable max-len */
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import redisClient from './redis';

/**
 * This function sends a JSON response with a 400 status code and an error message.
 *
 * @param {Object} res - The response object to send.
 * @param {string} message - The error message to include in the response.
 *
 * @returns {void}
 */
export function errorJson(res, message) {
  res.status(400).json({ error: message });
}

/**
   * This function retrieves the user ID associated with a given authentication token from Redis.
   *
   * @param {string} token - The authentication token to look up in Redis.
   *
   * @returns {Promise<string|null>} - A Promise that resolves to the user ID if found, or null if not found.
   *
   * @throws {Error} - If an error occurs while interacting with Redis.
   */
export async function getUserId(token) {
  const userId = await redisClient.get(`auth_${token}`);
  return userId;
}

/**
   * Asynchronously creates a directory at the specified file path, generates a unique file name using UUIDv4,
   * writes the provided data to a file at the generated full path, and returns the generated file name.
   *
   * @param {string | Buffer | URL} data - The data to be written to the file.
   * @param {string} filePath - The path where the file will be created.
   *
   * @returns {Promise<string>} - A Promise that resolves to the generated file name.
   *
   * @throws {Error} - If an error occurs during directory creation, file writing, or any other step.
   */
export async function filehandler(data, filePath) {
  return new Promise((resolve, reject) => {
    fs.mkdir(filePath, { recursive: true }, (err) => {
      if (err) reject(new Error(err.message));

      const fileName = uuidv4();
      const fullPath = path.join(filePath, fileName);
      fs.writeFile(fullPath, data, (err) => {
        if (err) reject(new Error(err.message));
        resolve(fullPath);
      });
    });
  });
}

/**
 * Validates the user by checking the authentication token and retrieving the user ID from Redis.
 *
 * @param {Object} req - The request object containing the authentication token.
 * @param {Object} res - The response object to send the response.
 *
 * @returns {Promise<string|Object>} - A Promise that resolves to the user ID if the token is valid and authorized,
 * or rejects with an error response if the token is invalid or not provided.
 *
 * @throws {Error} - If an error occurs while interacting with Redis.
 */
export async function validateUser(req, res) {
  try {
    const token = req.headers['x-token'];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await getUserId(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    return userId;
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function validateUserWithoutToken(req, res) {
  try {
    const token = req.headers['x-token'];
    if (!token) return null;

    const userId = await getUserId(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    return userId;
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function readFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(new Error(err.message));
      const decodedData = Buffer.from(data, 'base64').toString('ascii');
      resolve(decodedData);
    });
  });
}

export async function readByte(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) reject(new Error(err.message));
      const decodedData = Buffer.from(data, 'base64');
      resolve(decodedData);
    });
  });
}
