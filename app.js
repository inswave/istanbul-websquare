var express = require('express'),
  httpProxy = require('http-proxy'),
  bodyParser = require('body-parser'),
  url = require('url'),
  path = require('path'),
  saveDir = path.resolve(__dirname, 'tempSource'),
  coverage = require('./lib/handlers.js'),
  config = require('./config.json');

var app = express();
var apiProxy = httpProxy.createProxyServer();

config.listenPort = config.listenPort || 3200;

console.log('=========================================================================')
console.log('Coverage server URL   : http://localhost:' + config.listenPort );
console.log('Coverage report       : http://localhost:' + config.listenPort + '/coverage/:browser');
console.log('Download coverage     : http://localhost:' + config.listenPort + '/coverage/download/:browser');
console.log('Reset coverage        : http://localhost:' + config.listenPort + '/coverage/reset/:browser');
console.log('Save coverage outPath : http://localhost:' + config.listenPort + '/coverage/output/:browser');
console.log('Show browser          : http://localhost:' + config.listenPort + '/coverage/browser');
console.log('WebSquare URL(proxy)  : ' + config.serverUrl );
console.log('=========================================================================\n')

function matcher(req) {
  var parsed = url.parse(req.url);
  //console.log("A " + parsed.pathname);
  //console.log("A " + parsed.pathname.match(/javascript.*\.wq/));
  //console.log("A " + parsed.pathname.match(/\.js/));
  var flag = parsed.pathname && ( parsed.pathname.match(/\.js$/) || parsed.pathname.match(/javascript.*\.wq$/) ) && !parsed.pathname.match(/jquery/) && !parsed.pathname.match(/selenium/) && !parsed.pathname.match(/externalJS/);
  if( flag) {
    if(config.verbose) console.log('[MATCHED]         ' + parsed.pathname );
  } else {
    if(config.verbose) console.log('[NOT MATCHED]     ' + parsed.pathname + "\n");
  }
  return flag;
}
/*
function loadPathTransformer(req) {
  var parsed = url.parse(req.url);
  console.log('[loadPathTransformer] ' + config.sourceLocation + parsed.pathname);
  return config.sourceLocation + parsed.pathname;
}
*/

function pathTransformer(req) {
  var parsed = url.parse(req.url);
  var postfix = "";
  if(parsed.pathname.match(/\.wq$/)) {
    var q = req.query.q
    if( q != null ) {
        postfix = q.split('/').join('.');
    }
  }
  if(config.verbose) console.log('[pathTransformer] ' + saveDir + parsed.pathname + postfix);
  return saveDir + parsed.pathname + postfix;
}

function urlTransformer(req) {
  if(config.verbose) console.log('[urlTransformer]  ' + config.serverUrl + req.url);
  return config.serverUrl + req.originalUrl;
}

function beautifyDetector(req) {
  var parsed = url.parse(req.url);
//  console.log(parsed.pathname);
//  console.log(parsed.pathname.match(/javascript.*\.wq/));
//  console.log(parsed.pathname.match(/\.min[.]+\.js/));
  return parsed.pathname && ( parsed.pathname.match(/\.min.*\.js$/) || parsed.pathname.match(/javascript.*\.wq$/) );
}

coverage.hookLoader(__dirname, {
  verbose: true
});



app.use('/coverage', coverage.createHandler({
  verbose: true,
  resetOnGet: true,
  outputPath: config.outputPath
}));

app.use(coverage.createClientHandler({
  matcher: matcher,
  urlTransformer: urlTransformer,
  pathTransformer: pathTransformer,
  beautifyDetector : beautifyDetector,
  verbose : config.verbose
}));

app.all("*", function(req, res) {
  apiProxy.web(req, res, {
    target: config.serverUrl,

  });
});
/*app.use(cacheControl({
  noCache: false,
  public: true
}));*/

app.listen(config.listenPort);
