var express = require('express');
var app = express();

// Setup ejs
var ejs = require('ejs');
app.set('view engine', 'ejs');

// Setup for getting post value
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// Bind URLs to files
var input = require('./routes/input');
app.use('/input', input);
var getdata = require('./routes/getdata');
app.use('/getdata', getdata); 


app.listen(3000, function () {
    console.log('server start:3000'); 
});
