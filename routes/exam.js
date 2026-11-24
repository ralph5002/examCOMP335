var express = require('express');
var router = express.Router();

var path = require('path');

// shared database connection (see db.js)
const client = require('../db');

var passport = require('passport');
var bcrypt = require('bcryptjs');

// ---------- helpers ----------
// Redirect back to a page with a message in the URL (the page shows it in <div id="message">)
function sendMessage(res, page, text) {
  res.redirect(page + '?message=' + encodeURIComponent(text));
}

// Only logged-in users may continue
function loggedIn(req, res, next) {
  if (req.user) return next();
  res.redirect('/exam');
}

// Only administrators may continue
function adminOnly(req, res, next) {
  if (!req.user) return res.redirect('/exam');
  if (req.user.isadmin !== 'admin') return res.redirect('/exam/notAdmin');
  next();
}

router.get('/logout', function(req, res, next){
  req.logout(function(err) {
    if (err) {
      console.log("unable to logout:", err);
      return next(err);
    }
    res.redirect('/exam'); // Successful. redirect to localhost:3000/exam
  });   //passport provide it
});

// localhost:3000/exam
router.get('/', function(req, res, next) {
  res.sendFile(path.join(__dirname,'..', 'public','exam.html'));
});

// localhost:3000/exam
router.post('/',
  // depends on the fields "isAdmin", redirect to the different path: admin or notAdmin
  passport.authenticate('local', {
    failureRedirect: 'exam?message=Incorrect+credentials'
  }),
  function(req, res, next) {
    if (req.user.isadmin === 'admin'){
      res.redirect('/exam/admin');
    }
    else {
      res.redirect('/exam/notAdmin');
    }
});

// localhost:3000/exam/admin
router.get('/admin', adminOnly, function(req, res){
  res.sendFile(path.join(__dirname,'..', 'public','admin.html'));
});

router.get('/notAdmin', loggedIn, function(req, res, next){
  res.sendFile(path.join(__dirname,'..', 'public','notAdmin.html'));
});

router.get('/notAdminOut', loggedIn, function(req, res, next){
  client.query('SELECT * FROM assignment WHERE username=$1',[req.user.username], function(err,result){
    if (err) {
      console.log("exam.js: sql error ");
      next(err); // throw error
    }
    else if (result.rows.length > 0) {
      console.log("There is at least one assignment ");
      res.json(result.rows);
    }
    else{
      console.log("This student does not have any assignment");
      let username=req.user.username;
      res.redirect('/exam/notAdmin?message='+username+" does not exist");
    }
  });
});

router.get('/whoami', loggedIn, function(req,res,next) {
  res.json({"user": req.user.username});
});

// ---------- Add an assignment (admin) + FEATURE 1: error checking ----------
router.get('/addAssignment', adminOnly, function(req, res, next) {
  res.sendFile(path.join(__dirname,'..', 'public','addAssignment.html'));
});

router.post('/addAssignment', adminOnly, function(req, res, next) {
  const { username, due, description } = req.body;

  if (!username || !due || !description) {
    return sendMessage(res, '/exam/addAssignment', 'Please fill in every field');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    return sendMessage(res, '/exam/addAssignment', 'Please type the due date like 2026-11-24');
  }

  client.query('SELECT * FROM examusers WHERE username = $1', [username], function(err, result) {
    if (err) {
      console.log("unable to query SELECT");
      return next(err);
    }
    if (result.rows.length > 0) {
        console.log("User exist. Let's add assignment");
        client.query('INSERT INTO assignment (username, description, due) VALUES($1, $2, $3)', [username, description, due], function(err, result) {
          if (err) {
            console.log("unable to query INSERT");
            // error codes starting with 22 = bad data (for example 2026-02-31 is not a real date)
            if (err.code && err.code.startsWith('22')) {
              return sendMessage(res, '/exam/addAssignment', 'Please type a real due date like 2026-11-24');
            }
            return next(err);
          }
          console.log("Assignment creation is successful");
          sendMessage(res, '/exam/addAssignment', 'Created assignment successfully');
        });
    }
    else {
      console.log("user doesn't exist");
      sendMessage(res, '/exam/addAssignment', 'User does not exist');
    }
  });
});

// ---------- FEATURE 2: change password (any logged-in user) ----------
router.get('/changePassword', loggedIn, function(req, res, next) {
  res.sendFile(path.join(__dirname,'..', 'public','changePassword.html'));
});

router.post('/changePassword', loggedIn, function(req, res, next) {
  const { current, newPassword, confirm } = req.body;

  if (!current || !newPassword || !confirm) {
    return sendMessage(res, '/exam/changePassword', 'Please fill in every field');
  }
  // 1. the two new passwords must be the same
  if (newPassword !== confirm) {
    return sendMessage(res, '/exam/changePassword',
      'The two passwords you entered are not the same\nPlease re-enter both now');
  }

  // 2. the current password must be right (read the saved password from the database,
  //    not from the session, so a second change in the same login still works)
  client.query('SELECT password FROM examusers WHERE username = $1', [req.user.username], function(err, result) {
    if (err) {
      console.log("unable to query SELECT");
      return next(err);
    }
    if (result.rows.length === 0 || !bcrypt.compareSync(current, result.rows[0].password)) {
      return sendMessage(res, '/exam/changePassword', 'current password does not match');
    }

    // 3. save the new password (scrambled with bcrypt)
    var hash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
    client.query('UPDATE examusers set password = $1 where username=$2', [hash, req.user.username], function(err) {
      if (err) {
        console.log("unable to query UPDATE");
        return next(err);
      }
      sendMessage(res, '/exam/changePassword', 'You successfully changed password');
    });
  });
});

// ---------- FEATURE 3: add a user, student or admin (admin only) ----------
router.get('/addUser', adminOnly, function(req, res, next) {
  res.sendFile(path.join(__dirname,'..', 'public','addUser.html'));
});

router.post('/addUser', adminOnly, function(req, res, next) {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const role = (req.body.isAdmin === 'admin') ? 'admin' : 'student';

  if (!username || !password) {
    return sendMessage(res, '/exam/addUser', 'Please fill in the user name and password');
  }

  client.query('SELECT * FROM examusers WHERE username = $1', [username], function(err, result) {
    if (err) {
      console.log("unable to query SELECT");
      return next(err);
    }
    if (result.rows.length > 0) {
      console.log("user exists");
      return sendMessage(res, '/exam/addUser', 'User exists');
    }
    var hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10));
    client.query('INSERT INTO examusers (username, password, isAdmin) VALUES($1, $2, $3)', [username, hash, role], function(err) {
      if (err) {
        console.log("unable to query INSERT");
        return next(err);
      }
      console.log("User created successfully");
      sendMessage(res, '/exam/addUser', 'We created your account successfully!');
    });
  });
});

module.exports = router;
