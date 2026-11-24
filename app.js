var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var env = require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
// new line for the exam
var examRouter = require('./routes/exam');  // exam.js
var app = express();

var session = require('express-session'); // to use session

// shared database connection (see db.js)
const client = require('./db');

var bcrypt = require('bcryptjs');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy({
  usernameField: 'username', 
  passwordField: 'password'
  },
  function(username, password, done) {
    client.query('SELECT * FROM examusers WHERE username = $1', [username], function(err, result) {
    if (err) {
      console.log("SQL error"); //next(err);
      return done(null,false, {message: 'sql error'});
    }
    if (result.rows.length > 0) {
      let matched = bcrypt.compareSync(password, result.rows[0].password);
       if (matched) {
        console.log("Successful login, ", result.rows[0]);
        return done(null, result.rows[0]);
      }
    }
    console.log("Bad username or password");
    return done(null, false, {message: 'Bad username or password'});
  });
})
);

// Store user information into session
passport.serializeUser(function(user, done) {
  //return done(null, user.id);
  return done(null, user);
});

// Get user information out of session
passport.deserializeUser(function(id, done) {
  return done(null, id);
});


app.use(session({
  secret: process.env.SESSION_SECRET || 'WebDev',
  resave:false,
  saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/exam', examRouter); // new for the exam

module.exports = app;
