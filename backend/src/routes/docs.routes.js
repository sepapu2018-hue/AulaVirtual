const express = require('express');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const swaggerUi = require('swagger-ui-express');

const especificacion = yaml.load(
  fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'openapi.yaml'), 'utf8')
);

const router = express.Router();

router.use('/', swaggerUi.serve, swaggerUi.setup(especificacion));

module.exports = router;
