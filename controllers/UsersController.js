import sha1 from 'sha1';
import Queue from 'bull';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    const user = await dbClient.db.collection('users').findOne({ email });

    if (user) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashedPassword = sha1(password);
    const result = await dbClient.db.collection('users').insertOne({ email, password: hashedPassword });
    const theOne = await dbClient.db.collection('users').findOne({ email });
    if (result) {
      const userQueue = new Queue('userQueue');
      await userQueue.add('userQueue', { userId: theOne._id });
      return res.status(201).json({ id: theOne._id, email });
    }
    return res.status(500).send('Internal server error');
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // console.log(userId);
    // const ObjId = new ObjectId(userId);
    const user = await dbClient.db.collection('users').findOne({ _id: dbClient.getObjectId(userId) });
    // console.log(user);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ email: user.email, id: user._id });
  }
}

module.exports = UsersController;
