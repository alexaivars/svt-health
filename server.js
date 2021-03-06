// Generated by CoffeeScript 1.3.3
var async, cache, clone, default_options, eDate, http, port, query, request, server, task, url;

http = require("http");

query = require("querystring");

url = require("url");

request = require('request');

clone = require('clone');

async = require('async');

port = process.env.PORT || 5000;

server = http.createServer().listen(port);

console.log("svt stats server is running on " + port);

default_options = {
  proxy: process.env.HTTP_PROXY || "",
  url: "http://validator.w3.org/check",
  qs: {
    output: "json",
    uri: "http://svt.se"
  }
};

task = function(uri, callback) {
  var options;
  options = clone(default_options);
  options.qs.uri = uri;
  request(options, function(error, response, body) {
    var result;
    result = {
      summary: {
        recursion: response.headers["x-w3c-validator-recursion"],
        status: response.headers["x-w3c-validator-status"],
        errors: response.headers["x-w3c-validator-errors"],
        warnings: response.headers["x-w3c-validator-warnings"]
      }
    };
    if (!error && response.statusCode === 200) {
      result.url = JSON.parse(body).url;
      return callback(null, result);
    } else {
      return callback(error, result);
    }
  });
};

eDate = new Date();

cache = null;

server.on("request", function(req, res) {
  var mDate;
  console.log("request");
  mDate = new Date();
  if (mDate.getTime() >= eDate.getTime()) {
    console.log("new");
    return async.map(["http://svt.se", "http://svt.se/nyheter", "http://www.svt.se/barnkanalen/", "http://www.svt.se/ug/", "http://www.svtplay.se/"], task, function(err, results) {
      var body, header;
      mDate = new Date();
      eDate.setTime(mDate.getTime() + 600 * 1000);
      body = JSON.stringify(results);
      console.log(body);
      cache = body;
      header = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'max-age=600, public',
        'Last-Modified': mDate,
        'Expires': eDate
      };
      res.writeHead(200, header);
      res.write(cache);
      return res.end();
    });
  } else {
    res.write(cache);
    return res.end();
  }
});
