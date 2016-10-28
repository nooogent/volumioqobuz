var http = require('http');
var url = require('url');
var vq = require('./index');
var port = process.env.port || 1337;
var libQ = require('kew');

http.createServer(function (req, res) {

    var queryData = url.parse(req.url, true).query;

    if (queryData.action) {
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

        var vqInstance = new vq(context);
        vqInstance.samplerate = 6;
        vqInstance.userAuthToken = "RF8MA35J1XE0-OmLWybpyo5neUqVU3I541lok39THQfRyGPzlMOB-iPGf-ZKn0T0qep01bFWSoCMh2HeQWZ6cg";
        vqInstance.appId = "214748364";//"285473059"; //; 
        vqInstance.appSecret = "";
        vqInstance.initialiseService();

        res.writeHead(200, { 'Content-Type': 'text/plain' });

        var actionParts = queryData.action.split('|');
        var action = actionParts.shift();
        var parsedActionParts = actionParts.map(function(param){return param.charAt(0)==='{' ? JSON.parse(param) : param;});
        
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