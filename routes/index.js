var express = require('express');
var router = express.Router();

// The base URL goes straight to the login page
router.get('/', function (req, res) {
  res.redirect('/exam');
});

module.exports = router;
