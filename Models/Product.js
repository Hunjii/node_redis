const mongoose = require('mongoose');

const ProductSchema = mongoose.Schema({
  id: {
    type: String,
    requires: true,
  },
  name: {
    type: String,
    requires: true,
  },
});

module.exports = mongoose.model('Products', ProductSchema);
