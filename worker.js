import Queue from 'bull';
import fs from 'fs';
import imageThumbnail from 'image-thumbnail';
import dbClient from './utils/db';

const mime = require('mime-types');

const fileQueue = new Queue('fileQueue');

fileQueue.process('fileQueue', async (job, done) => {
  try {
    const { userId, fileId } = job.data;
    if (!fileId) throw new Error('Missing fileId');
    if (!userId) throw new Error('Missing userId');

    const file = await dbClient.db.collection('files').findOne({ _id: dbClient.getObjectId(fileId), userId });
    if (!file) throw new Error('File not found');

    const filePath = file.localPath;
    console.log(`File path is ${filePath}`);
    const sizes = [500, 250, 100];

    console.log(`File MIME type: ${mime.lookup(fs.readFileSync(filePath))}`);

    // Use Promise.all to wait for all thumbnails to be processed
    const thumbnailPromises = sizes.map((size) => imageThumbnail(filePath, { width: size })
      .then((thumbnail) => new Promise((resolve, reject) => {
        const thumbnailPath = `${filePath}_${size}`;
        fs.writeFile(thumbnailPath, thumbnail, (err) => {
          if (err) {
            console.error(`Failed to write thumbnail for size ${size}: ${err.message}`);
            reject(err);
          }
          console.log(`Writing to file: ${thumbnailPath}`);
          resolve();
        });
      })).catch((error) => {
        console.error(`Failed to generate thumbnail for size ${size}: ${error.message}`);
        throw error;
      }));

    // Wait for all thumbnail processing promises to complete
    await Promise.all(thumbnailPromises);
    console.log('All thumbnails created successfully');
    done();
  } catch (error) {
    done(error);
  }
});

fileQueue.on('failed', (job, err) => {
  console.error(`Job failed ${job.id} with error: ${err.message}`);
});

const userQueue = new Queue('userQueue');

userQueue.process('userQueue', async (job, done) => {
  try {
    const { userId } = job.data;
    if (!userId) throw new Error('Missing userId');
    const user = await dbClient.db.collection('users').findOne({ _id: dbClient.getObjectId(userId) });

    if (!user) throw new Error('User not found');
    console.log(`Welcome ${user.email}`);
    done();
  } catch (error) {
    done(error);
  }
});

userQueue.on('failed', (job, err) => {
  console.error(`Job failed ${job.id} with error: ${err.message}`);
});
