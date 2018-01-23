const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const MongoClient = require('mongodb').MongoClient
const ObjectID = require('mongodb').ObjectID;

var db;

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "POST, GET, DELETE, PUT");
  next();
});

// connect DB
MongoClient.connect('mongodb://localhost', {
  uri_decode_auth: true,
  native_parser: true
}, (err, newDB) => {
  if (err) console.log(err);
  db = newDB.db('stilbank')
  app.listen(3000, function() {
    console.log("listening on 3000");
  });
});

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
  db.collection('sb_accounts').find({
    "accountID": req.params.id
  }).toArray(function(err, results) {
    res.send(results[0]);
  });
});

//Add new transaction
app.post('/', (req, res) => {
  db.collection('sb_transactions').insertOne(req.body, function(err, resp) {
    if (err) {
      console.log('Error occurred while inserting');
    } else {
      console.log('inserted record', resp.ops[0]);
    }
  })
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
    comment: req.body.comment
  });
});
