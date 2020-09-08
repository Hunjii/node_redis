const express = require('express');
const dotenv = require('dotenv');
const redis = require('redis');
const mongoose = require('mongoose');
const Product = require('./Models/Product');

dotenv.config({ path: './config.env' });

const DB = process.env.DATABASE.replace('<password>', process.env.DATABASE_PASS);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log('connect to database success!'));

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.PORT || 6379;

const client = redis.createClient(REDIS_PORT);

const app = express();

const getRes = async (res, req, next) => {
  try {
    const { id } = req.params.id;

    const product = await Product.findById(id);
    // check sp request 5 lần trong 2p
    client.get(id, (err, data) => {
      if (data === null) {
        client.setex(id, 120, '1');
      } else if (data === '5') {
        // set data tới redis
        client.setex(id, 3600, JSON.stringify(product));
      } else {
        client.setex(id, 120, data * 1 + 1);
      }
    });

    // gửi response tới client
    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (err) {
    res.status(500).json({
      err,
    });
  }
};

// cache redis
const cache = (req, res, next) => {
  const { id } = req.params;

  client.get(id, (err, data) => {
    if (data !== null) {
      if (isNaN(data * 1)) {
        // gửi response tới client
        res.status(200).json({
          status: 'success',
          data,
        });
      }
      next();
    } else {
      next();
    }
  });
};

app.get('/api/:id', cache, getRes);

app.listen(5000, () => {
  console.log(`App listening in port ${PORT}`);
});
