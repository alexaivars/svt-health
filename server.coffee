http = require("http")
query = require("querystring")
url = require("url")
request = require('request')
clone = require('clone')
async = require('async')
port = process.env.PORT || 5000
console.log "svt stats server is running on #{port}"
graphite = require('graphite')
events = require('events')
util = require('util')

server = http.createServer().listen port
client = graphite.createClient('plaintext://graphite.svti.svt.se:2003/')

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
      result.url = JSON.parse(body).url
      result.json = response.request.href
      result.html = response.request.href.replace("output=json&","")
      callback null, result
    else
      callback error, result
  return

url_to_str = (url) ->
  url = url.replace(/(http:\/\/www\.)|(http:\/\/)|\s|(\/$)/g,'') # clean the urls
  url.replace(/\/|\./g,'-')

class Validator extends events.EventEmitter
  constructor: ->
    @mdate = new Date()
    @edate = new Date()
    @edate.setTime @mdate.getTime()
    @cache = null
    return
  load: (callback) ->
    @mdate = new Date()
    if @mdate.getTime() >= @edate.getTime()
      async.map ["http://svt.se","http://svt.se/nyheter","http://svt.se/barnkanalen","http://svt.se/ug","http://svtplay.se"], task, (err, results) =>
        @mdate = new Date()
        @edate.setTime( @mdate.getTime() + 600 * 1000)
        @cache = results
        @emit "new", @cache, @header()
        @emit "success", @cache, @header()
        if callback
          callback.call @, @cache, @header
    else
      if callback
        callback.call @, @cache, @header
      @emit "success", @cache, @header()
    return @
  header: ->
    data =
      'Content-Type': 'application/json; charset=utf-8'
      'Cache-Control': 'max-age=600, public'
      'Last-Modified' : @mdate
      'Expires' : @edate

svtse = new Validator()
svtse.on "success", (data,header) ->
  metrics =
    prod:
      markup : {}
  for obj in data
    m = metrics.prod.markup[url_to_str(obj.url)] = {}
    for key,val of obj.summary
      m[key] = val

  console.log metrics
  client.write metrics, (err) ->
    if err == null
      console.log "problem posting to graphite server"
    client.end()


server.on "request", (req, res) ->
  params = url.parse(req.url, true).query
  jsonp = params.callback
  console.log jsonp 
  if svtse.mdate.getTime() >= svtse.edate.getTime()
    console.log "new"
    svtse.load (body,header) ->
      res.writeHead 200, header
      if jsonp then res.write jsonp + " ("
      res.write JSON.stringify(body)
      if jsonp then res.write ");"
      res.end()
  else
    res.writeHead 200, svtse.header()
    if jsonp then res.write jsonp + " ("
    res.write JSON.stringify(svtse.cache)
    if jsonp then res.write ");"
    res.end()

svtse.load()
setInterval () ->
  console.log "ok"
  svtse.load()
, 600000
