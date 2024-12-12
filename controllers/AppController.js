import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(req, res) {
    res.status(200).json({
      redis: redisClient.isAlive(),
      db: dbClient.isAlive(),
    });
  }

  static getStats(req, res) {
    Promise.all([dbClient.nbFiles(), dbClient.nbUsers()])
      .then(([files, users]) => {
        res.status(200).json({
          files,
          users,
        });
      });
  }
}

module.exports = AppController;
