const express = require("express");
const dotenv = require("dotenv");
const redis = require("redis");
const mongoose = require("mongoose");
const Product = require("./Models/Product");

dotenv.config({ path: "./config.env" });

const DB = process.env.DATABASE.replace("<password>", process.env.DATABASE_PASS);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log("connect to database success!"));

const PORT = process.env.PORT || 5000;
const REDIS_PORT = process.env.PORT || 6379;

const client = redis.createClient(REDIS_PORT);

const app = express();

const getProductDetail = async (res, req, next) => {
  try {
    const { id } = req.params.id;

    const product = await Product.findById(id);
    // check request 5 lần trong 2p
    client.get(id, (err, data) => {
      // nếu req đén id là lần đầu tiên
      if (data === null) {
        client.setex(id, 120, "underfined");
        const time = Date.now();
        client.setex(`${id}:time`, 120, time);
        client.setex(`${id}:count`, 120, 1);
      }
      // nếu req đến id ko phải lần đầu
      else if (data === "underfined") {
        client.get(`${id}:count`, (err, data_1) => {
          // nếu req đến id là lần thứ 5 thì lưu product vào redis
          if (data_1 === "5") {
            client.setex(id, 3600, JSON.stringify(product));
          } else {
            client.get(`${id}:time`, (err, data_2) => {
              const time = Date.now();
              const exprired = Math.round((time - data_2) / 1000);
              client.setex(`${id}:time`, exprired, time);
              client.setex(`${id}:count`, exprired, data_1 * 1 + 1);
            });
          }
        });
      }
    });

    // gửi response tới client
    res.status(200).json({
      status: "success",
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
    if (data !== null && data !== "underfined") {
      // gửi response tới client
      res.status(200).json({
        status: "success",
        data,
      });
    } else {
      next();
    }
  });
};

app.get("/api/:id", cache, getProductDetail);

app.listen(5000, () => {
  console.log(`App listening in port ${PORT}`);
});
