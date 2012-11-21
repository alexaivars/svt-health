// Generated by CoffeeScript 1.3.3
var Validator, async, client, clone, default_options, events, graphite, http, port, query, request, server, svtse, task, url, url_to_str, util,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

http = require("http");

query = require("querystring");

url = require("url");

request = require('request');

clone = require('clone');

async = require('async');

port = process.env.PORT || 5000;

console.log("svt stats server is running on " + port);

graphite = require('graphite');

events = require('events');

util = require('util');

server = http.createServer().listen(port);

client = graphite.createClient('plaintext://graphite.svti.svt.se:2003/');

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

url_to_str = function(url) {
  url = url.replace(/(http:\/\/www\.)|(http:\/\/)|\s|(\/$)/g, '');
  return url.replace(/\/|\./g, '-');
};

Validator = (function(_super) {

  __extends(Validator, _super);

  function Validator() {
    this.mdate = new Date();
    this.edate = new Date();
    this.edate.setTime(this.mdate.getTime());
    this.cache = null;
    return;
  }

  Validator.prototype.load = function(callback) {
    var _this = this;
    this.mdate = new Date();
    if (this.mdate.getTime() >= this.edate.getTime()) {
      async.map(["http://svt.se", "http://svt.se/nyheter", "http://svt.se/barnkanalen", "http://svt.se/ug", "http://svtplay.se"], task, function(err, results) {
        _this.mdate = new Date();
        _this.edate.setTime(_this.mdate.getTime() + 600 * 1000);
        _this.cache = results;
        _this.emit("new", _this.cache, _this.header());
        _this.emit("success", _this.cache, _this.header());
        if (callback) {
          return callback.call(_this, _this.cache, _this.header);
        }
      });
    } else {
      if (callback) {
        callback.call(this, this.cache, this.header);
      }
      this.emit("success", this.cache, this.header());
    }
    return this;
  };

  Validator.prototype.header = function() {
    var data;
    return data = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'max-age=600, public',
      'Last-Modified': this.mdate,
      'Expires': this.edate
    };
  };

  return Validator;

})(events.EventEmitter);

svtse = new Validator();

svtse.on("success", function(data, header) {
  var key, m, metrics, obj, val, _i, _len, _ref;
  metrics = {
    lab: {
      markup: {}
    }
  };
  for (_i = 0, _len = data.length; _i < _len; _i++) {
    obj = data[_i];
    m = metrics.lab.markup[url_to_str(obj.url)] = {};
    _ref = obj.summary;
    for (key in _ref) {
      val = _ref[key];
      m[key] = val;
    }
  }
  console.log(metrics);
  return client.write(metrics, function(err) {
    console.log(err);
    return client.end();
  });
});

server.on("request", function(req, res) {
  console.log("request");
  if (svtse.mdate.getTime() >= svtse.edate.getTime()) {
    console.log("new");
    return svtse.load(function(body, header) {
      res.writeHead(200, header);
      res.write(JSON.stringify(body));
      return res.end();
    });
  } else {
    res.writeHead(200, svtse.header());
    res.write(JSON.stringify(svtse.cache));
    return res.end();
  }
});

svtse.load();

setInterval(function() {
  console.log("ok");
  return svtse.load();
}, 600000);
