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

const getProductDetail = async (res, req, next) => {
  try {
    const { id } = req.params.id;
    // lấy sp trong csdl
    const product = await Product.findById(id);
    // check request 5 lần trong 2p
    client.get(id, (err, data) => {
      // nếu request đến id là lần đầu tiên
      if (data === null) {
        // set giá trị tạm thời cho id vào redis trong 120s
        client.setex(id, 120, 'underfined');
        const time = Date.now();
        // set time đầu tiên request với id trong 120s
        client.setex(`${id}:time`, 120, time);
        // set request là 1 lần trong 120s
        client.setex(`${id}:count`, 120, 1);
      }
      // nếu req đến id ko phải lần đầu
      else if (data === 'underfined') {
        // lấy giá trị count
        client.get(`${id}:count`, (err, data) => {
          // nếu request đến id là lần thứ 5 thì lưu product vào redis trong 60p
          if (data === '5') {
            client.setex(id, 3600, JSON.stringify(product));
          }
          // nếu request đến id khác lần thứ 5
          else {
            // lấy giá trị thời gian
            client.get(`${id}:time`, (err, data) => {
              const time = Date.now();
              // set số request + 1
              // tính thời gian hết hạn trong redis = 120s - (time hiện tại - time lần đầu request)
              client.setex(`${id}:count`, 120 - (time - data), data * 1 + 1);
            });
          }
        });
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

// cache redis middleware
const cache = (req, res, next) => {
  const { id } = req.params;

  client.get(id, (err, data) => {
    if (data !== null && data !== 'underfined') {
      // gửi response tới client
      res.status(200).json({
        status: 'success',
        data,
      });
    } else {
      next();
    }
  });
};

// api lấy thông tin sp
app.get('/api/:id', cache, getProductDetail);

app.listen(5000, () => {
  console.log(`App listening in port ${PORT}`);
});
