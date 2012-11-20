// Generated by CoffeeScript 1.3.3
var async, clone, default_options, http, port, query, request, server, task, url;

http = require("http");

query = require("querystring");

url = require("url");

request = require('request');

clone = require('clone');

async = require('async');

port = process.env.PORT || 5000;

server = http.createServer().listen(port);

console.log("svt stats server running on " + port);

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

server.on("request", function(req, res) {
  return async.map(["http://svt.se", "http://svt.se/nyheter", "http://svt.se/vader"], task, function(err, results) {
    var body;
    body = JSON.stringify(results);
    console.log(body);
    res.write(body);
    return res.end();
  });
});