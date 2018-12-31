const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const jwtAuthenticate = require('./middlewares/jwt-authenticate');
const userRouter = require('./core/user');
const fsRouter = require('./core/filesystem');

var app = express();

app.use(logger('dev'));
app.use(cors());
app.use(fileUpload());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/v1/user', userRouter);
app.use(jwtAuthenticate({ secret: 'secret' }));
app.use('/v1/fs', fsRouter);

module.exports = app;