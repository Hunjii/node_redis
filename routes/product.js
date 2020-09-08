const express = require('express');
const redis = require('redis');
const router = express.Router();
const Product = require('../Models/Product');

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    res.status(200).json({
      status: 'success',
      data: product,
    });
  } catch (err) {
    res.status(400).json({
      err,
    });
  }
});

module.exports = router;
