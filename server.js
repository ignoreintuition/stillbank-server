const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const MongoClient = require('mongodb').MongoClient
const ObjectID = require('mongodb').ObjectID;
const Passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

var db;
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(Passport.initialize());
app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "POST, GET, DELETE, PUT");
  next();
});

// connect DB
MongoClient.connect(process.env.MONGO_STILLBANK_URI || 'mongodb://localhost', {
  uri_decode_auth: true,
  native_parser: true
}, (err, newDB) => {
  if (err) console.log(err);
  db = newDB.db(process.env.DB_NAME || 'stillbank')
  app.listen(process.env.PORT || 3000, function() {
    console.log("listening");
  });
});

// Serialize User
Passport.serializeUser(function(user, done) {
  done(null, user._id);
});

// Build passort strategy
Passport.use(new LocalStrategy(
  function(username, password, done) {
    db.collection('sb_accounts').findOne({"login": username.toLowerCase()}, function(err, user, info) {
      if (err) {
        return done(err);
      }
      if (user && user.password == password){
        delete user.password;
        return done(null, user);
      }
      else {
        return done(null, false, { message: 'failed' })
      }
    })
  }
));

// get transactions
app.get('/getTrans/:id', (req, res) => {
  db.collection('sb_transactions').find({
    "accountID": req.params.id
  }).toArray(function(err, results) {
    results.sort(function (a, b) {
       return new Date(b.date) - new Date(a.date);
    });
    res.send(results);
  });
});

// get account info
app.get('/acct/:id', (req, res) => {
  updateTotal(req.params.id);
  db.collection('sb_accounts').find({
    "accountID": req.params.id
  }).toArray(function(err, results) {
    res.send(results[0]);
  });
});

// get admin account info
app.get('/adminAcct/:id', (req, res) => {
  db.collection('sb_accounts').find({
    "masterAccountID": req.params.id
  }).toArray(function(err, results) {
    results.forEach(function(d) {
      updateTotal(d.accountID);
    });
  });
  db.collection('sb_accounts').find({
    "masterAccountID": req.params.id
  }).toArray(function(err, results) {
    res.send(results);
  });
});

// Add new transaction
app.post('/', (req, res) => {
  db.collection('sb_transactions').insertOne(req.body, function(err, resp) {
    if (err) {
      console.log('Error occurred while inserting');
    } else {
      res.send('Transaction inserted!');
    }
  })
});

// Add new account
app.post('/addAcct/', (req, res) => {
  db.collection('sb_accounts').insertOne(req.body, function(err, document) {
    if (err) {
      console.log('Error occurred while inserting');
    } else {
      db.collection('sb_accounts').update(
        {"_id": document.ops[0]._id},
        {'$set': {'accountID': document.ops[0]._id.toString()}})
      res.send(document.ops[0]._id);
    }
  })
});

// Delete account
app.delete('/deleteAcct/:id', (req, res) => {
  const id = req.params.id;
  const details = { '_id': new ObjectID(id) };
  db.collection('sb_accounts').remove(details, (err, item) => {
     if (err) {
       res.send({'error':'An error has occurred'});
     } else {
       res.send('Account ' + id + ' deleted!');
     }
   });
});

// Delete transactions
app.delete('/deleteTrans/:id', (req, res) => {
  const id = req.params.id;
  const details = { '_id': new ObjectID(id) };
  db.collection('sb_transactions').remove(details, (err, item) => {
     if (err) {
       res.send({'error':'An error has occurred'});
     } else {
       res.send('Transaction ' + id + ' deleted!');
     }
   });
});

// Update transactions
app.post('/updateTrans/:id', (req, res) => {
  const details = { '_id': new ObjectID(req.params.id) };
  db.collection('sb_transactions').update(details, {
    date:req.body.date,
    type:req.body.type,
    amount: req.body.amount,
    accountID: req.body.accountID,
    category: req.body.category,
    comment: req.body.comment
  });
});

// Login
// app.post('/login',
//   Passport.authenticate('local', { session: false }),
//   function(req, res) {
//     res.json(req.user);
//   });

app.post('/login', function(req, res, next) {
  Passport.authenticate('local', {session: false}, function(err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.json(info);
    }
    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }
      return res.json(user);
    });
  })(req, res, next);
});

// Helper functions
function updateTotal(accountID){
  db.collection('sb_accounts').findOne({
    "accountID": accountID
  }, (err, item) => {
    db.collection('sb_transactions').find({
      "accountID": accountID
    }).toArray(function(err, results){
      var v = results.reduce(function(a, b){
        var c = (b.type == "credit") ? -1 * b.amount : 1 * b.amount;
        return a + c;
      }, 0 )
      db.collection('sb_accounts').update({
        "accountID": accountID
      }, {'$set': {'total': v + item.startBal}});
    });
  });
}
