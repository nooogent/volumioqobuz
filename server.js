var http = require('http');
var url = require('url');
var vq = require('./index');
var port = process.env.port || 1337;
var libQ = require('kew');
var as = require('./as');

var vqInstance;

http.createServer(function (req, res) {

    var queryData = url.parse(req.url, true).query;

    if (queryData.action) {
        //         var userAuthToken;
        //          vqInstance.qobuzAccountLogin ({'username':'lombardox','password':'p@ssw0rd'})
        //          .then(function (res){
        // userAuthToken = res;
        //          });

        if (!vqInstance)
            vqInstance = createInstance();

        res.writeHead(200, { 'Content-Type': 'text/plain' });

        var actionParts = queryData.action.split('|');
        var action = actionParts.shift();
        var parsedActionParts = actionParts.map(function (param) { return param.charAt(0) === '{' ? JSON.parse(param) : param; });

        vqInstance[action].apply(vqInstance, parsedActionParts)
            //.search({ value: 'thriller', type: 'any' })
            .then(function (results) {
                res.end(JSON.stringify(results) + '\n');
            })
            .fail(function (e) {
                res.end(JSON.stringify(e) + '\n');
            });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('nothing doing\n');
    }
}).listen(port);

var createInstance = function () {

    var log = function (message) {
        console.log(message);
    };

    var context = {
        coreCommand: {
            pushConsoleMessage: log,
            pushToastMessage: function (a, b, c) {
                log('toast: ' + a + '|' + b + '|' + c);
            },
            logger: { info: log }
        },
        logger: { info: log },
        configManager: {}
    };

    var mockMpd = { sendMpdCommand: function (a, b) { log(a); return libQ.resolve(); } };

    var inst = new vq(context);
    inst.config = {
        set: function (key, value) { log('config set for key: ' + key + 'value: ' + value); }
    };
    inst.apiArgs = {
        appId: "285473059",
        appSecret: as.get(),
        userAuthToken: "5u4_h7Fji_Qv0kAx3Qu7P-ZByBcgg97tpdk7cTHZWP7Sz9fVsEPnWyZga0P3CYPLFtOp8zbRGJ75-sWV9LfK7g",
        proxy: 'http://127.0.0.1:8888',
        maxBitRate: 6
    };
    inst.serviceArgs = {
        cache: { enabled: true, editorial: 100, favourites: 5, items: 102, pruneInterval: 5 },
        sort: { albums: "artistTitle", playlists: "title", tracks: "title" },
        display: { showQobuzListsInRoot: true }
    };
    inst.mpdPlugin = mockMpd;
    inst.debug = true;
    inst.logger.qobuzDebug = function (data) {
        if (inst.debug === true)
            inst.logger.info('[' + Date.now() + '] ControllerQobuz::' + data);
    };
    inst.initialiseService();

    return inst;
};