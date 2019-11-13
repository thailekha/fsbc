const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const fileUpload = require('express-fileupload');

require('dotenv').config();
// const env = require('dotenv').config();
// if (env.error) {
//   throw env.error;
// }

const jwtAuthenticate = require('./middlewares/jwt-authenticate');
const userRouter = require('./core/user');
const fsRouter = require('./core/filesystem');
const collectorRouter = require('./core/collector');
const errorHandler = require('./middlewares/error-handler');

var app = express();

app.use(logger('dev'));
app.use(cors());
app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/ping', (req, res) => res.send('Pong'));
app.use('/v1/user', userRouter);
app.use('/v1/collector', collectorRouter);
app.use(jwtAuthenticate({ secret: 'secret' }));
app.use('/v1/fs', fsRouter);
app.use(errorHandler);

module.exports = app;