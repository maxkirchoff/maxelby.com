const express = require("express");
const bodyParser = require("body-parser");
const http = require("request");
const utils = require("./utils.js");
const responses = require("./static_responses.js");
const mongodb = require("mongodb");
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const ObjectID = mongodb.ObjectID;

const RSVP_COLLECTION = "rsvp";
const SMS_SUB_COLLECTION = "sms_sub";

var app = express();
app.use(bodyParser.json());

// Create link to public directory
var distDir = __dirname + "/public/";
app.use(express.static(distDir));

// Create a database variable outside of the
// database connection callback to reuse the
// connection pool in your app.
var db;

// Connect to the database before starting
// the application server.
mongodb.MongoClient.connect(process.env.MONGODB_URI, function (err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback
  // for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function () {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

/*
Example of the Twilio req.query object
{
  ToCountry: [[two letter state code of "To" phone number]],
  ToState: [[two letter state code of "To" phone number]],
  SmsMessageSid: [[sms message sid]],
  NumMedia: [[number of media]],
  ToCity: [[city of "To" phone number]],
  FromZip: [[zipcode of the "From" phone number]],
  SmsSid: [[sms sid]],
  FromState: [[two letter state code of "From" phone number]],
  SmsStatus: [[status of SMS on Twilio]],
  FromCity: [[city of "From" phone number]],
  Body: [[body of SMS]],
  FromCountry: [[two letter state code of "From" phone number]],
  To: [[phone number of Twilio number]],
  ToZip: [[zipcode of the "From" phone number]],
  NumSegments: [[number of segments in message]],
  MessageSid: [[message sid]],
  AccountSid: [[account sid]],
  From: [[phone number of sender]],
  ApiVersion: [[Twilio API version]]
}
*/

// The order here REALLY matters
const SMS_COMMANDS = {
  UNSUBSCRIBE: ['unsub', 'unsubscribe', 'stop'],
  SUBSCRIBE: ['subscribe'],
  RSVP: ['rsvp', 'respond'],
  DADJOKE: ['dadjoke', 'dad joke'],
  LOCATION: ['location', 'where'],
  DATE: ['date', 'time', 'when', 'schedule'],
  TRAVEL: ['travel', 'how to get there', 'flying'],
  HOTEL: ['hotel', 'motel', 'accommodations'],
  GIFT: ['gift', 'registry'],
  WEBSITE: ['website', 'internet'],
  HELLO: ['hello', 'hey', 'hi', 'greeting'],
  HELP: ['help', 'commands']
}

function determineMessageIntent(msg) {
  for (command in SMS_COMMANDS) {
    for (var i=0; i < SMS_COMMANDS[command].length; i++) {
      if (msg.toLowerCase().includes(SMS_COMMANDS[command][i])) {
        return command;
      }
    }
  }
}

function unsubscribe(respCallback, phoneNumber) {
  let response = {};

  if (phoneNumber) {
    db.collection(SMS_SUB_COLLECTION).update({phone_number: phoneNumber}, {$set: {subscribed: false}}, function(err, doc) {
      if (err) {
        response.message = "Sorry but I couldn't unsubscribe you.";
        respCallback(response, "Failed to sms unsubscription.");
      } else {
        //res.status(201).json(sms_sub);
        response.message = responses.unsubscribe;
        respCallback(response);
      }
    });
  } else {
    response.message = "Sorry but something is broken. 😫";
    respCallback(response, "Must provide a phone number.");
  }
}


function subscribe(respCallback, phoneNumber) {
  let response = {};

  if (phoneNumber) {
    let sms_sub = {
      phone_number: phoneNumber,
      subscribed: true
    };

    db.collection(SMS_SUB_COLLECTION).update({phone_number: phoneNumber}, sms_sub, {upsert: true, safe: false}, function(err, doc) {
      if (err) {
        response.message = "Sorry but I couldn't subscribe you.";
        respCallback(response, "Failed to sms subscription.");
      } else {
        //res.status(201).json(sms_sub);
        response.message = responses.subscribe;
        respCallback(response);
      }
    });
  } else {
    response.message = "Sorry but something is broken. 😫";
    respCallback(response, "Must provide a phone number.");
  }
}

// TODO: implement this
function rsvp(respCallback, message, phoneNumber) {
  let response = {};

  response.message = responses.rsvp;
  respCallback(response);
}

function dadjoke(respCallback) {
  var request = require('request');
  let response = {}
  request({uri: 'http://icanhazdadjoke.com', json: true}, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      response.message = body.joke;
      respCallback(response);
    } else {
      respCallback('', "couldn't complete request");
    }
  })
}

function staticResponse(respCallback, command) {
  let response = {};
  response.message = responses[command.toLowerCase()];
  respCallback(response);
}


function help(respCallback, optMsgStart) {
  let response = { message: '' };
  if (optMsgStart) {
    response.message += optMsgStart + " \n\n";
  }

  response.message += responses.commands;

  respCallback(response);
}

app.get("/api/sms", function(req, res) {

  if (process.env.TWILIO_ACCOUNT_SID !== req.query.AccountSid) {
    utils.handleError(res, "Invalid access", "You do not have access to this.", 403)
  } else if (!req.query.Body) {
    utils.handleError(res, "No message.", "There was no message.", 400)
  } else {
    const phoneNumber = req.query.From;
    const message = req.query.Body
    const twiml = new MessagingResponse();
    const respMsg = twiml.message();

    function respCallback(response, err) {
      console.log(response);
      if (err) {
        utils.handleError(res, err, err, 500);
      } else {
        if (response.message) {
          respMsg.body(response.message);
        }
        res.writeHead(200, {'Content-Type': 'text/xml'});
        res.end(twiml.toString());
      }
    }

    if (message) {
      let requestCommand = determineMessageIntent(message);

      console.log(requestCommand);

      switch(requestCommand) {
        case 'UNSUBSCRIBE':
          unsubscribe(respCallback, phoneNumber);
          break;
        case 'SUBSCRIBE':
          subscribe(respCallback, phoneNumber);
          break;
        case 'RSVP':
          rsvp(respCallback, message, phoneNumber);
          break;
        case 'DADJOKE':
          dadjoke(respCallback)
          break;
        case 'LOCATION':
        case 'DATE':
        case 'HOTEL':
        case 'TRAVEL':
        case 'WEBSITE':
        case 'GIFT':
        case 'HELLO':
          staticResponse(respCallback, requestCommand);
          break;
        case 'HELP':
          help(respCallback);
          break;
        default:
          help(respCallback, responses.sorry);
          break;
      }
    }
  }
});
