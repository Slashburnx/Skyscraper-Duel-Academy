const mongoose = require('mongoose');

// The whole site's data lives as ONE JSON tree, exactly like Firebase Realtime
// Database did — { announcement, duelists: {...}, archetypes: {...}, ... }.
// This lets every existing page keep using "paths" like 'duelists/d5' or
// 'shop/budget' with almost no changes to the front-end code.
const storeSchema = new mongoose.Schema(
  {
    _id: { type: String, default: 'root' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { minimize: false }
);

module.exports = mongoose.model('Store', storeSchema);
