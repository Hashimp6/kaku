const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const routes = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors()); // tighten origins before production
app.use(express.json({ limit: '10kb' }));

// Express 5 leaves req.body undefined when no body is sent
app.use((req, res, next) => {
  if (req.body === undefined) req.body = {};
  next();
});

if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
