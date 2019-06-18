const express = require('express');

module.exports = function(app){
  const router = express.Router();
  router.use(express.static(process.cwd() + '/public'));
  app.use(router);
}
