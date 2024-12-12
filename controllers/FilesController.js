/* eslint-disable class-methods-use-this */
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import {
  errorJson, filehandler, getUserId,
  validateUser, readFile, readByte, validateUserWithoutToken,
} from '../utils/helpers';

/**
 * Class representing a controller for handling file uploads.
 * @class FilesController
 */
export default class FilesController {
  /**
 * Handles POST requests for file uploads.
 *
 * @param {Object} req - The request object containing the file data and metadata.
 * @param {Object} res - The response object to send.
 *
 * @returns {void}
 */
  static async postUpload(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user ID from Redis using the provided token
    const userId = await getUserId(token);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, data, isPublic,
    } = req.body;

    // eslint-disable-next-line prefer-destructuring
    let parentId = req.body.parentId;
    const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';

    // Validate request parameters
    if (!name) {
      return errorJson(res, 'Missing name');
    }

    const validType = ['file', 'image', 'folder'];
    if (!type || !validType.includes(type)) {
      return errorJson(res, 'Missing type');
    }

    if (!data && type !== 'folder') {
      return errorJson(res, 'Missing data');
    }

    let objparentId;
    if (parentId) {
      console.log(parentId);
      objparentId = dbClient.getObjectId(parentId);
      console.log(objparentId);
      // Check if parent exists and is a folder
      const file = await dbClient.db.collection('files').findOne({ _id: objparentId });
      if (!file) {
        return errorJson(res, 'Parent not found');
      }
      if (file.type !== 'folder') {
        return errorJson(res, 'Parent is not a folder');
      }
    } else {
      parentId = 0;
    }

    // Create a new file object
    const newFile = {
      userId: dbClient.getObjectId(userId),
      name,
      type,
      isPublic: isPublic || false,
      parentId: objparentId || parentId,
    };

    const notFolder = type === 'file' || type === 'image';
    let localPath;
    if (notFolder) {
      // Decrypt file data
      const decrypedData = Buffer.from(data, 'base64');
      try {
      // Save file data to disk and get the local path
        localPath = await filehandler(type === 'image' ? decrypedData : decrypedData.toString('ascii'), filePath);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
      newFile.localPath = localPath;
    }
    // console.log(newFile);

    // Insert the new file into the database
    const newDbFile = await dbClient.db.collection('files').insertOne(newFile);
    if (newDbFile) {
      newFile.id = newDbFile.insertedId;
      const returnFile = { ...newFile };
      // console.log(returnFile);
      delete returnFile._id;
      const fileQueue = new Queue('fileQueue');
      if (returnFile.type === 'image') {
        await fileQueue.add('fileQueue', { userId: returnFile.userId.toString(), fileId: returnFile.id.toString() });
      }
      return res.status(201).json(returnFile);
    }

    // Handle server errors
    return res.status(500).send('Internal server error');
  }

  static async getShow(req, res) {
    try {
      const fileId = req.params.id;
      if (!fileId) {
        return errorJson(res, 'Missing id');
      }
      const token = req.headers['x-token'];
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const userId = await getUserId(token);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const file = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(fileId), userId });
      if (!file) return res.status(404).json({ error: 'Not found' });

      file.id = file._id;
      delete file._id;

      return res.json(file);
    } catch (err) {
      return res.status(500).json({ error: (err.message) });
    }
  }

  static async getIndex(req, res) {
    try {
      const token = req.headers['x-token'];
      if (!token) return res.status(401).json({ error: 'Unauthorized' });

      const userId = await getUserId(token);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      let parentId = req.query.parentId || '0';
      const page = parseInt(req.query.page, 10) || 0;
      const pageSize = 20;
      const skip = page * pageSize;
      const limit = pageSize;

      parentId = parentId === '0' ? 0 : dbClient.getObjectId(parentId);

      const files = await dbClient.db.collection('files').aggregate(
        [
          { $match: { userId, parentId } },
          { $sort: { name: 1 } },
          { $skip: skip },
          { $limit: limit },
        ],
      ).toArray();

      const newArray = [];

      files.forEach((arr) => {
        const newArr = arr;
        newArr.id = arr._id;
        delete newArr._id;
        newArray.push(newArr);
      });

      if (files) return res.status(201).json(newArray);
    } catch (error) {
      return res.status(500).json({ error });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }

  static async modifyDocument(req, res, propVal) {
    try {
      const userId = await validateUser(req, res);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = req.params;

      if (!id) return res.status(404).json({ error: 'Not found' });
      const file = await dbClient.db.collection('files')
        .updateOne(
          { _id: dbClient.getObjectId(id), userId },
          { $set: propVal },
        );
      if (!file) return res.status(404).json({ error: 'Not found' });
      const returnFile = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(id), userId });
      return res.status(200).json(returnFile);
    } catch (error) {
      return res.status(500).json({ error });
    }
  }

  static async putUnpublish(req, res) {
    const propVal = { isPublic: false };
    await FilesController.modifyDocument(req, res, propVal);
  }

  static async putPublish(req, res) {
    const propVal = { isPublic: true };
    await FilesController.modifyDocument(req, res, propVal);
  }

  static async getFile(req, res) {
    try {
      const userId = await validateUserWithoutToken(req, res);
      const { id } = req.params;
      const { size } = req.query;
      const sizes = ['500', '250', '100'];

      if (!id) return res.status(404).json({ error: 'Not found' });
      const file = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(id) });
      if (!file || (!file.isPublic && (!userId || file.userId.toString() !== userId))) {
        return res.status(404).json({ error: 'Not found' });
      }
      if (file.type === 'folder') return res.status(404).json({ error: 'A folder doesn\'t have content' });

      const isImage = file.type === 'image';
      const isValidSize = sizes.includes(size);
      let fileData;

      if (isImage) {
        if (isValidSize) {
          fileData = await readByte(`${file.localPath}_${size}`);
        } else {
          fileData = await readByte(file.localPath);
        }
      } else {
        fileData = await readFile(file.localPath);
      }
      const mimeType = mime.lookup(file.name);
      if (!mimeType) return res.status(500).json({ error: 'Unable to determine MIME type' });
      res.setHeader('Content-Type', mimeType);
      return res.send(fileData);
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
}
