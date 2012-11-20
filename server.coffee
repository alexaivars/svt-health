http = require("http")
query = require("querystring")
url = require("url")
request = require('request')
clone = require('clone')
async = require('async')
port = process.env.PORT || 5000
server = http.createServer().listen port
console.log "svt stats server running on #{port}"


default_options =
  proxy: process.env.HTTP_PROXY || ""
  url:"http://validator.w3.org/check"
  qs:
    output: "json"
    uri: "http://svt.se"


task = (uri,callback) ->
  options = clone default_options
  options.qs.uri = uri
  request options , (error, response, body) ->
    result =
      summary:
        recursion: response.headers["x-w3c-validator-recursion"]
        status: response.headers["x-w3c-validator-status"]
        errors: response.headers["x-w3c-validator-errors"]
        warnings: response.headers["x-w3c-validator-warnings"]
    if (!error && response.statusCode == 200)
      # callback null, JSON.parse(body)
      result.url = JSON.parse(body).url
      callback null, result
    else
      callback error, result
  return

server.on "request", (req, res) ->
  async.map ["http://svt.se","http://svt.se/nyheter","http://svt.se/vader"], task, (err, results) ->
    body = JSON.stringify(results)
    console.log body
    res.write body
    res.end()

