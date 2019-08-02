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
// backup coverage report 1/5
var updateCount = 0;

function pad2(n) { return n < 10 ? '0' + n : n }

/*
 * Chrome : chrome
 * Internet Explorer : ie6, ie7, ie8, ie9, ie10, ie11
 * Safari : safari
 * Firefox : firefox
 * Opera : opera
 */
function checkBrowser(userAgentStr) { 
  var result = "default";
  var temp;
  if(userAgentStr.indexOf("Chrome") >= 0) {
    result = 'chrome';
  }
  else if(userAgentStr.indexOf("MSIE") >= 0) {
    //https://docs.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/compatibility/ms537503(v=vs.85)
    temp = userAgentStr.indexOf("Trident");
    if(userAgentStr[temp+8] == '4') {
      result = 'ie8';
    }
    else if(userAgentStr[temp+8] == '5') {
      result = 'ie9';
    }
    else if(userAgentStr[temp+8] == '6') {
      result = 'ie10';
    }
    else if(userAgentStr[temp+8] == '7') {
      result = 'ie11';
    }

    temp = userAgentStr.indexOf("MSIE");
    if(userAgentStr[temp+5] == '6') {
      result = 'ie6';
    }
    else if(userAgentStr[temp+5] == '7') {
      result = 'ie7';
    }
    else if(userAgentStr[temp+5] == '8') {
      result = 'ie8';
    }
    else if(userAgentStr[temp+5] == '9') {
      result = 'ie9';
    }
    else if(userAgentStr[temp+5] == '1' && userAgentStr[temp+6] == '0') {
      result = 'ie10';
    }
    if(result == "default") {
      result = 'ie';
    }
  }
  else if(userAgentStr.indexOf("Safari") >= 0) {
    result = 'safari';
  }
  else if(userAgentStr.indexOf("Firefox") >= 0) {
    result = 'firefox';
  }
  else if(userAgentStr.indexOf("Opera") >= 0) {
    result = 'opera';
  }
  else if(userAgentStr.indexOf("Trident") >= 0) {
    temp = userAgentStr.indexOf("Trident");
    if(userAgentStr[temp+8] == '4') {
      result = 'ie8';
    }
    else if(userAgentStr[temp+8] == '5') {
      result = 'ie9';
    }
    else if(userAgentStr[temp+8] == '6') {
      result = 'ie10';
    }
    else if(userAgentStr[temp+8] == '7') {
      result = 'ie11';
    }
  }
  else {
    result = 'none'
  }
  return result;

}

function checkBrowserByQuery(qry) { 
  var result = "default";
  var temp = qry.split('_');
  if(temp[2] == "Chrome") {
    result = 'chrome';
  }
  else if(temp[2] == "Firefox") {
    result = 'firefox';
  }
  else if(temp[2] == "Opera") {
    result = 'opera';
  }
  else if(temp[2] == "IE6") {
    result = 'ie6';
  }
  else if(temp[2] == "IE7") {
    result = 'ie7';
  }
  else if(temp[2] == "IE8") {
    result = 'ie8';
  }
  else if(temp[2] == "IE9") {
    result = 'ie9';
  }
  else if(temp[2] == "IE10") {
    result = 'ie10';
  }
  else if(temp[2] == "IE11") {
    result = 'ie11';
  }
  else if(temp[2] == "wbrowser") {
    result = 'wbrowser';
  }
  else if(temp[2] == "Edge") {
    result = 'edge';
  }
  else if(temp[2] == "Safari") {
    result = 'safari';
  }
  else if(temp[2] == "Ultron") {
    result = 'ultron';
  }
  else if(temp[2] == "wbrowser") {
    result = 'wbrowser';
  }
  
  return result;

}

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

    //show page for specific file/ dir for /show?file=/path/to/file
    app.get('/show/:browser', function (req, res) {
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

        core.render(file, res, origUrl, req.params.browser);
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
    app.post('/reset/:browser', function (req, res) {
        var browser = req.params.browser || 'chrome';
        core.restoreBaseline(browser);
        res.json({ ok: true });
    });

    //opt-in to allow resets on GET as well (useful for easy browser-based demos :)
    if (opts.resetOnGet) {
        //reset selected browser
        app.get('/reset/:browser', function (req, res) {
            var browser = req.params.browser || 'chrome';
            core.restoreBaseline(browser);
            res.json({ ok: true });
        });

        //reset All browser
        app.get('/reset', function (req, res) {
            for(var bName in global.coverageObjList) {
              if(bName != 'all') {
                core.restoreBaseline(bName);
              }
            }
            res.json({ ok: true });
        });
    }

    //return coverage browsers list
    app.get('/browser', function (req, res) {
        var temp = [];
        for(var browser in Object.keys(global.coverageObjList)) {
            var name = Object.keys(global.coverageObjList)[browser];
            if( name != 'all' && Object.keys(global.coverageObjList[name]).length > 0) {
                temp[temp.length] = name;
            }
        }
        res.json({ browsers: temp});
    });

    //return global coverage object on /object as JSON in selected browser
    app.get('/object/:browser', function (req, res) {
        var browser = req.params.browser || 'chrome';
        res.json(core.getCoverageObject(browser) || {});
    });

    //return global coverage object on /object as JSON in all browser
    app.get('/object', function (req, res) {
        var browser = 'all';
        res.json(core.getCoverageObject(browser) || {});
    });

    //send self-contained download package with coverage and reports on /download
    app.get('/download/:browser', function (req, res) {
        var browser = req.params.browser || 'chrome';
        var stream = archiver.createZip(),
            writer = new ZipWriter(stream, process.cwd()),
            coverageObject = core.getCoverageObject(browser) || {},
            collector = new Collector(),
            baseDir = process.cwd(),
            reports = [
                Report.create('html', { writer: writer, dir: path.join(baseDir, 'lcov-report') }),
                Report.create('lcovonly', { writer: writer, dir: baseDir })
            ],
            date = new Date(),
            filename = 'coverage_' + browser + '_'
                + date.getFullYear().toString() + pad2(date.getMonth() + 1) + pad2( date.getDate()) + pad2( date.getHours() ) + pad2( date.getMinutes() ) + pad2( date.getSeconds() ) + '.zip';

        
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

    app.get('/download', function (req, res) {
        var browser = 'all';
        var stream = archiver.createZip(),
            writer = new ZipWriter(stream, process.cwd()),
            coverageObject = core.getCoverageObject(browser) || {},
            collector = new Collector(),
            baseDir = process.cwd(),
            reports = [
                Report.create('html', { writer: writer, dir: path.join(baseDir, 'lcov-report') }),
                Report.create('lcovonly', { writer: writer, dir: baseDir })
            ],
            date = new Date(),
            filename = 'coverage_' + browser + '_'
                + date.getFullYear().toString() + pad2(date.getMonth() + 1) + pad2( date.getDate()) + pad2( date.getHours() ) + pad2( date.getMinutes() ) + pad2( date.getSeconds() ) + '.zip';

        
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

    app.get('/output/:browser', function (req, res) {
        var browser = req.params.browser || 'chrome';
        if(opts.outputPath == "") {
          res.json({ok: "NOPATH"});
          return;
        }
        var stream = archiver.createZip(),
            writer = new ZipWriter(stream, process.cwd()),
            coverageObject = core.getCoverageObject(browser) || {},
            collector = new Collector(),
            baseDir = process.cwd(),
            reports = [
                Report.create('html', { writer: writer, dir: path.join(baseDir, 'lcov-report') }),
                Report.create('lcovonly', { writer: writer, dir: baseDir })
            ],
            date = new Date(),
            filename = 'coverage_' + browser + '_'
                + date.getFullYear().toString() + pad2(date.getMonth() + 1) + pad2( date.getDate()) + pad2( date.getHours() ) + pad2( date.getMinutes() ) + pad2( date.getSeconds() ) + '.zip';

        utils.removeDerivedInfo(coverageObject);
        collector.add(coverageObject);

        var output = fs.createWriteStream( opts.outputPath + "/" + filename);

        stream.pipe(output);
        writer.writeFile('coverage.json', function (w) {
            w.write(JSON.stringify(coverageObject, undefined, 4));
        });
        reports.forEach(function (report) {
            report.writeReport(collector);
        });
        writer.done();
        console.log("[report output download] " + filename);
        res.json({ ok: true, filename: filename });
    });

    app.get('/output', function (req, res, next) {
      
        var browser = 'all';
        if(opts.outputPath == "") {
           res.json({ok: "NOPATH"});
           next();
        }
        var stream = archiver.createZip(),
            writer = new ZipWriter(stream, process.cwd()),
            coverageObject = core.getCoverageObject(browser) || {},
            collector = new Collector(),
            baseDir = process.cwd(),
            reports = [
                Report.create('html', { writer: writer, dir: path.join(baseDir, 'lcov-report') }),
                Report.create('lcovonly', { writer: writer, dir: baseDir })
            ],
            date = new Date(),
            filename = 'coverage_' + browser + '_'
                + date.getFullYear().toString() + pad2(date.getMonth() + 1) + pad2( date.getDate()) + pad2( date.getHours() ) + pad2( date.getMinutes() ) + pad2( date.getSeconds() ) + '.zip';

        utils.removeDerivedInfo(coverageObject);
        collector.add(coverageObject);

        var output = fs.createWriteStream( opts.outputPath + "/" + filename);

        stream.pipe(output);
        writer.writeFile('coverage.json', function (w) {
            w.write(JSON.stringify(coverageObject, undefined, 4));
        });
        reports.forEach(function (report) {
            report.writeReport(collector);
        });
        writer.done();
        console.log("[report output download] " + filename);
        res.json({ ok: true, filename: filename });
    });

    //merge client coverage posted from browser
    app.post('/client/:platform', function (req, res) {
        var body = req.body;
        if (!(body && typeof body === 'object')) { //probably needs to be more robust
            return res.send(400, 'Please post an object with content-type: application/json');
        }
        var browser = checkBrowser(req.headers['user-agent']);
        if(!!req.params.platform) {
            //console.log(req.params.platform);
            browser = checkBrowserByQuery(req.params.platform);
        }
        /*if(opts.autoBackup) {
            if(updateCount % opts.autoBackup == 0) {
                var temp = [];
                for (var browserKey in Object.keys(global.coverageObjList)) {
                    var name = Object.keys(global.coverageObjList)[browserKey];
                    if ( name != 'all' && Object.keys(global.coverageObjList[name]).length > 0) {
                        temp[temp.length] = name;
                    }
                }
                for (var i = 0; i < temp.length; i++) {
                    var browserTemp = temp[i];
                    var backupPath = path.resolve(__dirname, '../backup');
                    if (!fs.existsSync(backupPath)) {
                        fs.mkdirSync(backupPath);
                    }
                    var contents = core.getCoverageObject(browserTemp);
                    fs.writeFile(backupPath + '/' + browserTemp, JSON.stringify(contents), 'utf8', function(err) {
                        if(err) console.log("[result autobackup failed] " + err);
                    });
                    console.log("[result autobackup(" + browserTemp + ")]");
                }
            }
            updateCount += 1;
        }*/
        core.mergeClientCoverage(body, browser);
        res.json({ok: true});
        console.log("[result updated("+ browser +")]");

    });

    //merge client coverage posted from browser
    app.post('/client', function (req, res) {
        var body = req.body;
        if (!(body && typeof body === 'object')) { //probably needs to be more robust
            return res.send(400, 'Please post an object with content-type: application/json');
        }
        var browser = checkBrowser(req.headers['user-agent']);
        if(req.query.platform) {
            browser = checkBrowserByQuery(req.query.platform);
        }
        /*if(opts.autoBackup) {
            if(updateCount % opts.autoBackup == 0) {
                var temp = [];
                for (var browserKey in Object.keys(global.coverageObjList)) {
                    var name = Object.keys(global.coverageObjList)[browserKey];
                    if ( name != 'all' && Object.keys(global.coverageObjList[name]).length > 0) {
                        temp[temp.length] = name;
                    }
                }
                for (var i = 0; i < temp.length; i++) {
                    var browserTemp = temp[i];
                    var backupPath = path.resolve(__dirname, '../backup');
                    if (!fs.existsSync(backupPath)) {
                        fs.mkdirSync(backupPath);
                    }
                    var contents = core.getCoverageObject(browserTemp);
                    fs.writeFile(backupPath + '/' + browserTemp, JSON.stringify(contents), 'utf8', function(err) {
                        if(err) console.log("[result autobackup failed] " + err);
                    });
                    console.log("[result autobackup(" + browserTemp + ")]");
                }
            }
            updateCount += 1;
        }*/
        core.mergeClientCoverage(body, browser);
        res.json({ok: true});
        console.log("[result updated("+ browser +")]");

    });

    //restore istanbul coverage
    app.get('/restore/:browser', function (req, res) {
        var browser = req.params.browser;
        var backupPath = path.resolve(__dirname, '../backup');
        if(fs.existsSync(backupPath + '/' + browser)) {
            var contents = fs.readFileSync( backupPath + '/' + browser, 'utf8');
            var cvgObj = JSON.parse(contents);
            core.setCoverageObject(cvgObj, browser);

            res.json({ok: true});
            console.log("[result restored("+ browser +")]");
        } else {
            res.json({ok: false, msg: 'not exist backup file'});
            console.log("[result restore failed] " + browser);
        }
    });

    //force backup istanbul coverage
    app.get('/backup/:browser', function (req, res) {
        var backupPath = path.resolve(__dirname, '../backup');
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath);
        }
        var browser = req.params.browser;
        var contents = core.getCoverageObject(browser);
        fs.writeFile(backupPath + '/' + browser, JSON.stringify(contents), 'utf8', function(err) {
            if(err) console.log("[result backup failed] " + err);
        });
        console.log("[result backup(" + browser + ")]");
        res.json({ok: true});
    });

    //force backup istanbul coverage
    app.get('/backup', function (req, res) {
        var temp = [];
        for (var browserKey in Object.keys(global.coverageObjList)) {
            var name = Object.keys(global.coverageObjList)[browserKey];
            if ( name != 'all' && Object.keys(global.coverageObjList[name]).length > 0) {
                temp[temp.length] = name;
            }
        }
        for (var i = 0; i < temp.length; i++) {
            var browserTemp = temp[i];
            var backupPath = path.resolve(__dirname, '../backup');
            if (!fs.existsSync(backupPath)) {
                fs.mkdirSync(backupPath);
            }
            var contents = core.getCoverageObject(browserTemp);
            fs.writeFile(backupPath + '/' + browserTemp, JSON.stringify(contents), 'utf8', function(err) {
                if(err) console.log("[result backup failed] " + err);
            });
            console.log("[result backup(" + browserTemp + ")]");
        }
        res.json({ok: true});
    });

    //show main page for coverage report for /
    app.get('/:browser', function (req, res) {

        var browser = req.params.browser;

        //remove slash in end of string
        var tem = req.originalUrl[req.originalUrl.length-1] == '/' ? req.originalUrl.slice(0, req.originalUrl.length-1) : req.originalUrl;
        var origUrl = url.parse(tem.slice(0,tem.lastIndexOf('/'))).pathname,
            origLength = origUrl.length;
        if (origUrl.charAt(origLength - 1) !== '/') {
            origUrl += '/';
        }
        core.render(null, res, origUrl, browser);
    });

    //show main page for coverage report for /
    app.get('/', function (req, res) {

        var browser = 'all';

        //remove slash in end of string
        var origUrl = url.parse(req.originalUrl).pathname,
            origLength = origUrl.length;
        if (origUrl.charAt(origLength - 1) !== '/') {
            origUrl += '/';
        }
        core.render(null, res, origUrl, browser);
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
    res.setHeader("cache-control", "private, max-age=86400");
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
        if(loadUrl.indexOf("javascriptPluginAll.wq")>0 || loadUrl.indexOf("websquare/engine/logger.js")>0 ) {
          contents = contents + "\n\n;var __getErrorLog = WebSquare.logger.getErrorLog;" +
          "var __uploadCoverage = function() {" +
          "  try {" +
          "    if (window.__coverage__) {" +
          "      if (window.XMLHttpRequest) {" +
          "        var request = new XMLHttpRequest();" +
          "      } else {" +
          "        var request = new ActiveXObject('Microsoft.XMLHTTP');" +
          "      }" +
          "      request.open('POST', '/coverage/client', false);" +
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
          console.log("[instrumented("+ checkBrowser(req.headers['user-agent'])+")]    " + url.parse(req.url).pathname);
          ensureDirectoryExistence(savePath);
          fs.writeFileSync(savePath, contents);

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
