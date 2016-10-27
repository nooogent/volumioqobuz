'use strict';

var libQ = require('kew');
var config = new (require('v-conf'))();
var qobuzService = require('./qobuzService');

module.exports = ControllerQobuz;

function ControllerQobuz(context) {
    // This fixed variable will let us refer to 'this' object at deeper scopes
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

ControllerQobuz.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    self.samplerate = self.config.get('max_bitrate') || 6;
    self.userAuthToken = self.config.get('user_auth_token');
    self.appId = "285473059"; //214748364";
    self.appSecret = "xxxxxxxxxxxxxxxx";
};

ControllerQobuz.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};

ControllerQobuz.prototype.addToBrowseSources = function () {
    var data = { name: 'Qobuz', uri: 'qobuz', plugin_type: 'music_service', plugin_name: 'qobuz' };
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerQobuz.prototype.onStop = function () {
    var self = this;

    self.logger.info("Qobuz plugin stopping");

    return libQ.resolve();
};

ControllerQobuz.prototype.onStart = function () {
    var self = this;

    self.addToBrowseSources();
    self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
    self.initialiseService();
    return libQ.resolve();
};

ControllerQobuz.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    self.logger.info('ControllerQobuz::handleBrowseUri: "' + curUri +'"');

    var response;
    var uriParts = curUri.split('/');

    if (curUri.startsWith('qobuz')) {
        if (curUri === 'qobuz') {
            response = self.service.rootList();
        }
        else if (curUri.startsWith('qobuz/favourites/album')) {
            if (curUri === 'qobuz/favourites/albums') {
                response = self.service.favouriteAlbumsList();
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/favourites/albums');
            }
        }
        else if (curUri.startsWith('qobuz/new/album')) {
            if (curUri === 'qobuz/new/albums') {
                response = self.service.featuredAlbumsList("new", "qobuz");
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/new/albums');
            }
        }
        else if (curUri.startsWith('qobuz/bestsellers/album')) {
            if (curUri === 'qobuz/bestsellers/albums') {
                response = self.service.featuredAlbumsList("bestsellers", "qobuz");
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/bestsellers/albums');
            }
        }
        else if (curUri.startsWith('qobuz/moststreamed/album')) {
            if (curUri === 'qobuz/moststreamed/albums') {
                response = self.service.featuredAlbumsList("moststreamed", "qobuz");
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/moststreamed/albums');
            }
        }
        else if (curUri.startsWith('qobuz/press/album')) {
            if (curUri === 'qobuz/press/albums') {
                response = self.service.featuredAlbumsList("press", "qobuz");
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/press/albums');
            }
        }
        else if (curUri.startsWith('qobuz/editor/album')) {
            if (curUri === 'qobuz/editor/albums') {
                response = self.service.featuredAlbumsList("editor", "qobuz");
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/editor/albums');
            }
        }
        else if (curUri.startsWith('qobuz/mostfeatured/album')) {
            if (curUri === 'qobuz/mostfeatured/albums') {
                response = self.service.featuredAlbumsList("mostfeatured", "qobuz");
            }
            else {
                response = self.service.albumTracksList(uriParts[3], 'qobuz/mostfeatured/albums');
            }
        }
        else if (curUri.startsWith('qobuz/favourites/tracks')) {
            response = self.service.favouriteTracksList();
        }
        else if (curUri.startsWith('qobuz/favourites/playlist')) {
            if (curUri === 'qobuz/favourites/playlists') {
                response = self.service.userPlaylistsList();
            }
            else {
                response = self.service.playlistTracksList(uriParts[3], 'qobuz/favourites/playlists');
            }
        }
        else if (curUri.startsWith('qobuz/editor/playlist')) {
            if (curUri === 'qobuz/editor/playlists') {
                response = self.service.featuredPlaylistsList("editor", "qobuz");
            }
            else {
                response = self.service.playlistTracksList(uriParts[3], 'qobuz/editor/playlists');
            }
        }
    }
    return response;
};

// Controller functions

// Define a method to clear, add, and play an array of tracks
ControllerQobuz.prototype.clearAddPlayTrack = function (track) {

    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::clearAddPlayTrack');

    return self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('load "' + track.uri + '"', []);
        })
        .fail(function (e) {
            return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
        })
        .then(function () {
            self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
            return self.mpdPlugin.sendMpdCommand('play', []);
        });
};

// Qobuz stop
ControllerQobuz.prototype.stop = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::stop');

    return self.mpdPlugin.sendMpdCommand('stop', []);
};

// Qobuz pause
ControllerQobuz.prototype.pause = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::pause');

    // TODO don't send 'toggle' if already paused
    return self.mpdPlugin.sendMpdCommand('pause', []);
};

// Qobuz resume
ControllerQobuz.prototype.resume = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::resume');

    // TODO don't send 'toggle' if already playing
    return self.mpdPlugin.sendMpdCommand('play', []);
};

// Qobuz seek
ControllerQobuz.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::seek');

    return self.mpdPlugin.seek(position);
};

ControllerQobuz.prototype.onRestart = function () {
};

ControllerQobuz.prototype.onInstall = function () {
};

ControllerQobuz.prototype.onUninstall = function () {
};

ControllerQobuz.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {

            var findOption = function (optionVal, options) {
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === optionVal)
                        return options[i];
                }
            };

            //remove either the log on or logout section
            var indexOfSectionToRemove =
                self.config.get('user_auth_token') && self.config.get('user_auth_token').length > 0
                    ? 0
                    : 1;

            uiconf.sections[0].content[0].value = self.config.get('username');
            uiconf.sections[0].content[1].value = '';
            uiconf.sections[1].description =
                uiconf.sections[1].description.replace('{0}', self.config.get('username'));
            uiconf.sections[2].content[0].value =
                findOption(self.config.get('max_bitrate'), uiconf.sections[2].content[0].options);

            uiconf.sections.splice(indexOfSectionToRemove, 1);

            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerQobuz.prototype.setUIConfig = function (data) {
};

ControllerQobuz.prototype.getConf = function (varName) {
};

ControllerQobuz.prototype.setConf = function (varName, varValue) {
};

ControllerQobuz.prototype.explodeUri = function (uri) {

    var self = this;

    var defer = libQ.defer();
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri start uri: ' + uri);

    if (uri.startsWith('qobuz/track/')) {
        var trackId = uri.split('/')[2];
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri track id: ' + trackId);

        self.service.track(trackId, self.samplerate)
            .then(function (result) {
                defer.resolve(result);
            })
            .fail(function (e) {
                self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri track failed');
                defer.reject(new Error());
            });
    }
    else if (
        uri.startsWith('qobuz/favourites/album') ||
        uri.startsWith('qobuz/new/album') ||
        uri.startsWith('qobuz/bestsellers/album') ||
        uri.startsWith('qobuz/moststreamed/album') ||
        uri.startsWith('qobuz/press/album') ||
        uri.startsWith('qobuz/editor/album') ||
        uri.startsWith('qobuz/mostfeatured/album')) {

        var albumId = uri.split('/')[3];
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri albumId: ' + albumId);

        self.service.album(albumId, self.samplerate)
            .then(function (result) {
                defer.resolve(result);
            })
            .fail(function (e) {
                self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri album failed');
                defer.reject(new Error());
            });
    }
    else if (
        uri.startsWith('qobuz/favourites/playlist') ||
        uri.startsWith('qobuz/editor/playlist') ||
        uri.startsWith('qobuz/public/playlist')) {

        var playlistId = uri.split('/')[3];
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri playlistId: ' + playlistId);

        self.service.playlist(playlistId, self.samplerate)
            .then(function (result) {
                defer.resolve(result);
            })
            .fail(function (e) {
                self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri playlist failed');
                defer.reject(new Error());
            });
    }
    else {
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri no uri pattern matched');
    }

    return defer.promise;
};

ControllerQobuz.prototype.search = function (query) {

    var self = this;

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::search start query: ' + query);

    var defer = libQ.defer();
    if (!query || !query.value || query.value.length === 0) {
        defer.resolve([]);
    }
    else {
        self.service.search(query.value)
            .then(function (result) {
                defer.resolve(result);
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
    }

    return defer.promise;
};

ControllerQobuz.prototype.initialiseService = function () {
    var self = this;
    self.service = new qobuzService(self.commandRouter.logger, self.appId, self.appSecret, self.userAuthToken);
};

ControllerQobuz.prototype.qobuzAccountLogin = function (data) {
    var self = this;

    var defer = libQ.defer();

    qobuzService
        .login(self.commandRouter.logger, self.appId, data["username"], data["password"])
        .then(function (result) {
            //update config
            self.config.set('username', data["username"]);
            self.config.set('user_auth_token', result);
            self.userAuthToken = result;

            //initalise qobuz service
            self.initialiseService();

            //celebrate great success!
            self.commandRouter.pushToastMessage('success', "Qobuz Account Login", 'You have been successsfully logged in to your Qobuz account');
            defer.resolve({});
        })
        .fail(function (e) {
            self.commandRouter.pushToastMessage('failure', "Qobuz Account Login", 'Qobuz account login failed.');
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerQobuz.prototype.qobuzAccountLogout = function () {
    var self = this;

    self.config.set('username', "");
    self.config.set('user_auth_token', "");

    delete self.userAuthToken;
    delete self.service;

    self.commandRouter.pushToastMessage('success', "Qobuz Account Log out", 'You have been successsfully logged out of your Qobuz account');

    return libQ.resolve();
};

ControllerQobuz.prototype.saveQobuzSettings = function (data) {
    var self = this;

    self.commandRouter.logger.info('saveQobuzSettings data: ' + JSON.stringify(data));

    var maxBitRate =
        data['max_bitrate'] && data['max_bitrate'].value && data['max_bitrate'].value.length > 0
            ? data['max_bitrate'].value
            : 6;
    self.config.set('bitrate', maxBitRate);
    self.samplerate = maxBitRate;

    self.commandRouter.pushToastMessage('success', "Qobuz Settings update", 'Your setting have been successsfully updated.');

    return libQ.resolve({});
};