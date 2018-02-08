/*
 Copyright (c) 2013, Yahoo! Inc.  All rights reserved.
 Copyrights licensed under the New BSD License. See the accompanying LICENSE file for terms.
 */
var path = require('path'),
    fs = require('fs'),
    core = require('./core'),
    istanbul = require('istanbul'),
    bodyParser = require('body-parser'),
    ASSETS_DIR = istanbul.assetsDir,
    existsSync = fs.existsSync || path.existsSync,
    url = require('url'),
    http = require('http'),
    archiver = require('archiver'),
    ZipWriter = require('./zip-writer'),
    express = require('express'),
    beautify = require('js-beautify').js_beautify,
    Report = istanbul.Report,
    Collector = istanbul.Collector,
    utils = istanbul.utils,
    cache = {},
    JS_RE = /\.js$/;

/**
 * Set default max limit to 100mb for incoming JSON and urlencoded
 * @type {String}
 */
var fileSizeMaximum = '100mb';
var isExtended = true;

function pad2(n) { return n < 10 ? '0' + n : n }

function createHandler(opts) {
    /*jslint nomen: true */
    opts = opts || {};

    var app = express();
    // using separete options objects to maintain readability as the objects are getting more complex
    var urlOptions = { extended: isExtended, limit: fileSizeMaximum };
    var jsonOptions = { limit: fileSizeMaximum };

    //send static file for /asset/asset-name
    app.use('/asset', express.static(ASSETS_DIR));
    app.use('/asset', express.static(path.join(ASSETS_DIR, 'vendor')));

    app.use(bodyParser.urlencoded(urlOptions));
    app.use(bodyParser.json(jsonOptions));

    //show main page for coverage report for /
    app.get('/', function (req, res) {
        var origUrl = url.parse(req.originalUrl).pathname,
            origLength = origUrl.length;
        if (origUrl.charAt(origLength - 1) !== '/') {
            origUrl += '/';
        }
        core.render(null, res, origUrl);
    });

    //show page for specific file/ dir for /show?file=/path/to/file
    app.get('/show', function (req, res) {
        var origUrl = url.parse(req.originalUrl).pathname,
            u = url.parse(req.url).pathname,
            pos = origUrl.indexOf(u),
            file = req.query.p;
        if (pos >= 0) {
            origUrl = origUrl.substring(0, pos);
        }
        if (!file) {
            res.setHeader('Content-type', 'text/plain');
            return res.end('[p] parameter must be specified');
        }
        core.render(file, res, origUrl);
    });

    //reset coverage to baseline on POST /reset
    app.post('/reset', function (req, res) {
        core.restoreBaseline();
        res.json({ ok: true });
    });

    //opt-in to allow resets on GET as well (useful for easy browser-based demos :)
    if (opts.resetOnGet) {
        app.get('/reset', function (req, res) {
            core.restoreBaseline();
            res.json({ ok: true });
        });
    }

    //return global coverage object on /object as JSON
    app.get('/object', function (req, res) {
        res.json(core.getCoverageObject() || {});
    });

    //send self-contained download package with coverage and reports on /download
    app.get('/download', function (req, res) {
        var stream = archiver.createZip(),
            writer = new ZipWriter(stream, process.cwd()),
            coverageObject = core.getCoverageObject() || {},
            collector = new Collector(),
            baseDir = process.cwd(),
            reports = [
                Report.create('html', { writer: writer, dir: path.join(baseDir, 'lcov-report') }),
                Report.create('lcovonly', { writer: writer, dir: baseDir })
            ],
            date = new Date(),
            filename = 'coverage_' + date.getFullYear().toString() + pad2(date.getMonth() + 1) + pad2( date.getDate()) + pad2( date.getHours() ) + pad2( date.getMinutes() ) + pad2( date.getSeconds() ) + '.zip';

        utils.removeDerivedInfo(coverageObject);
        collector.add(coverageObject);

        res.statusCode = 200;
        res.setHeader('Content-type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename=' + filename);
        stream.pipe(res);
        writer.writeFile('coverage.json', function (w) {
            w.write(JSON.stringify(coverageObject, undefined, 4));
        });
        reports.forEach(function (report) {
            report.writeReport(collector);
        });
        writer.done();
        console.log("[report download] " + filename);
    });

    //merge client coverage posted from browser
    app.post('/client', function (req, res) {
        var body = req.body;
        if (!(body && typeof body === 'object')) { //probably needs to be more robust
            return res.send(400, 'Please post an object with content-type: application/json');
        }
        core.mergeClientCoverage(body);
        res.json({ok: true});
        console.log("[result updated]");

    });

    return app;
}

function defaultClientMatcher(req) {
    var parsed = url.parse(req.url);
    return parsed.pathname && parsed.pathname.match(JS_RE);
}

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function clientHandler(matcher, urlTransformer, pathTransformer, beautifyDetector, opts) {
  var verbose = opts.verbose;

  return function (req, res, next) {
    if (!matcher(req)) {
      return next();
    }
    var savePath = pathTransformer(req);
    var loadUrl = urlTransformer(req);
    if (!savePath || !loadUrl) { return next(); }
    if(cache[savePath]) {
      res.setHeader('Content-type', 'application/javascript');
      if(verbose) console.log("[cache response]  " + url.parse(req.url).pathname);
      return res.send(cache[savePath]);
    }
    var isbeautify = beautifyDetector(req);

    if (!core.getInstrumenter()) {
        console.error('No instrumenter set up, please call createHandler() before you use the client middleware');
        return next();
    }

    http.get(loadUrl, (res1) => {
      const { statusCode } = res1;
      const contentType = res1.headers['content-type'];

      let error;
      if (statusCode !== 200) {
        console.error('Request Failed.\n' + `Status Code: ${statusCode}`);
        return next();
      }
      res1.setEncoding('utf8');
      let contents = '';
      res1.on('data', (chunk) => { contents += chunk; });
      res1.on('end', () => {
        if(isbeautify) {
          try {
            if(verbose) console.log("[beautified]      " + url.parse(req.url).pathname);
            contents = beautify(contents, {indent_size:2});
          } catch (ex) {
            console.warn('Error instrumenting :' + ex);
          }
        }
        if(loadUrl.indexOf("javascriptPluginAll.wq")>0 || loadUrl.indexOf("websquare/engine/logger.j")>0 ) {
          contents = contents + ";var __getErrorLog = WebSquare.logger.getErrorLog;" +
          "var __uploadCoverage = function() {" +
          "  try {" +
          "    if (window.__coverage__) {" +
          "      if (window.XMLHttpRequest) {" +
          "        var request = new XMLHttpRequest();" +
          "      } else {" +
          "        var request = new ActiveXObject('Microsoft.XMLHTTP');" +
          "      }" +
          "      request.open('POST', '/coverage/client', true);" +
          "      request.setRequestHeader('Content-Type', 'application/json');" +
          "      request.send(JSON.stringify(window.__coverage__));" +
          "      request.onreadystatechange = function() {" +
          "        if (request.readyState == 4 && request.status == 200) {" +
          "          console.log('save coverage : ' + request.responseText);" +
          "        }" +
          "      }" +
          "    }" +
          "  } catch (e) {}" +
          "};" +
          "WebSquare.logger.getErrorLog = function() {" +
          "  __uploadCoverage();" +
          "  return __getErrorLog();" +
          "};";
        }
        try {
          console.log("[instrumented]    " + url.parse(req.url).pathname);
          ensureDirectoryExistence(savePath);
          fs.writeFileSync(savePath, contents);

          //console.log("A " + parsed.pathname);
          instrumented = core.getInstrumenter().instrumentSync(contents, savePath);

          cache[savePath] = instrumented;
          res.setHeader('Content-type', 'application/javascript');
          return res.send(instrumented);
        } catch (ex) {
          console.warn('Error instrumenting file:' + savePath);
          return next();
        }
      });
    });
  };
}


function createClientHandler(opts) {
  opts = opts || {};

  var app = express(),
      matcher = opts.matcher || defaultClientMatcher,
      beautifyDetector = opts.beautifyDetector,
      urlTransformer = opts.urlTransformer,
      pathTransformer = opts.pathTransformer;
  app.get('*', clientHandler(matcher, urlTransformer, pathTransformer, beautifyDetector,  opts));
  return app;
}

module.exports = {
  createClientHandler: createClientHandler,
  createHandler: createHandler,
  hookLoader: core.hookLoader
};
