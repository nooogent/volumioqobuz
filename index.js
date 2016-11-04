'use strict';

var libQ = require('kew');
var config = new (require('v-conf'))();
var qobuzService = require('./qobuzService');

module.exports = ControllerQobuz;

function ControllerQobuz(context) {
    // This fixed variable will let us refer to 'this' object at deeper scopes
    var self = this;

    self.context = context;
    self.commandRouter = context.coreCommand;
    self.logger = context.logger;
    self.configManager = context.configManager;
}

ControllerQobuz.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);

    self.samplerate = self.config.get('max_bitrate') || 6;
    self.apiArgs = { appId: "285473059", appSecret: "47249d0eaefa6bf43a959c09aacdbce8", userAuthToken: self.config.get('user_auth_token') };
    self.cacheArgs = { editorial: self.config.get('cache_editorial'), favourites: self.config.get('cache_favourites'), items: self.config.get('cache_items') };
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
    self.logger.info('ControllerQobuz::handleBrowseUri: "' + curUri + '"');

    var response;
    var uriParts = curUri.split('/');

    if (curUri.startsWith('qobuz')) {
        //root
        if (curUri === 'qobuz') {
            response = self.service.rootList();
        }
        //albums
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
        else if (curUri.startsWith('qobuz/album')) {
            response = self.service.albumTracksList(uriParts[2], 'qobuz');
        }
        //artists
        else if (curUri.startsWith('qobuz/artist')) {
            if (curUri === 'qobuz/artist/' + uriParts[2]) {
                response = self.service.artistAlbumsList(uriParts[2], '', 'qobuz');
            }
            else {
                response = self.service.albumTracksList(uriParts[4], 'qobuz/artist/' + uriParts[2]);
            }
        }
        else if (curUri.startsWith('qobuz/favourites/artist')) {
            if (curUri === 'qobuz/favourites/artists') {
                response = self.service.favouriteArtistsList();
            }
            else {
                if (curUri === 'qobuz/favourites/artist/' + uriParts[3]) {
                    response = self.service.artistAlbumsList(uriParts[3], 'favourites', 'qobuz/favourites/artists');
                }
                else {
                    response = self.service.albumTracksList(uriParts[5], 'qobuz/favourites/artist/' + uriParts[3]);
                }
            }
        }
        //tracks
        else if (curUri.startsWith('qobuz/favourites/tracks')) {
            response = self.service.favouriteTracksList();
        }
        //playlists
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
        else if (curUri.startsWith('qobuz/playlist')) {
            response = self.service.playlistTracksList(uriParts[2], 'qobuz');
        }
        //purchases
        else if (curUri.startsWith('qobuz/purchases')) {
            if (curUri === 'qobuz/purchases') {
                response = self.service.purchaseTypesList();
            }
            else if (curUri === 'qobuz/purchases/tracks') {
                response = self.service.purchasesList('tracks');
            }
            else if (curUri.startsWith('qobuz/purchases/album')) {
                if (curUri === 'qobuz/purchases/albums') {
                    response = self.service.purchasesList('albums');
                }
                else {
                    response = self.service.albumTracksList(uriParts[3], 'qobuz/purchases/albums');
                }
            }
        }
        //search
        else if (curUri.startsWith('qobuz/search')) {
            if (curUri === 'qobuz/search/' + uriParts[2]) {
                response = self.search({ value: decodeURIComponent(uriParts[2]), type: 'any' })
                    .then(function (searchResults) {
                        return { navigation: { lists: searchResults, prev: { uri: '/' } } };
                    });
            }
            else if (curUri.startsWith('qobuz/search/' + uriParts[2] + '/album')) {
                response = self.service.albumTracksList(uriParts[4], 'qobuz/search/' + uriParts[2]);
            }
            else if (curUri.startsWith('qobuz/search/' + uriParts[2] + '/playlist')) {
                response = self.service.playlistTracksList(uriParts[4], 'qobuz/search/' + uriParts[2]);
            }
            else if (curUri === 'qobuz/search/' + uriParts[2] + '/artist/' + uriParts[4]) {
                response = self.service.artistAlbumsList(uriParts[4], 'search/' + uriParts[2], 'qobuz/search/' + uriParts[2]);
            }
            else if (curUri.startsWith('qobuz/search/' + uriParts[2] + '/artist/' + uriParts[4] + '/album')) {
                response = self.service.albumTracksList(uriParts[6], 'qobuz/search/' + uriParts[2] + '/artist/' + uriParts[4]);
            }
        }
        else {
            response = libQ.reject();
        }
    }

    return response
        .fail(function (e) {
            self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::handleBrowseUri failed');
            libQ.reject(new Error());
        });
};

// Controller functions

// Define a method to clear, add, and play an array of tracks
ControllerQobuz.prototype.clearAddPlayTrack = function (track) {

    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::clearAddPlayTrack');
    self.logger.info("Qobuz clearAddPlayTrack track: " + JSON.stringify(track));
    var trackId = track.uri.split('/').pop();
    var trackUri;
    return self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function () {
            return self.service.trackUrl(trackId, self.samplerate);
        })
        .then(function (trackData) {
            //return self.mpdPlugin.sendMpdCommand('load "' + track.uri + '"', []);

            trackUri = trackData.uri;
            track.bitdepth = trackData.bitdepth;
            track.samplerate = trackData.samplerate;
            track.trackType = trackData.trackType;
            return self.mpdPlugin.sendMpdCommand('load "' + trackUri + '"', []);
        })
        .fail(function (e) {
            return self.mpdPlugin.sendMpdCommand('add "' + trackUri + '"', []);
        })
        .then(function () {
            self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
            return self.mpdPlugin.sendMpdCommand('play', []);
        });
};

ControllerQobuz.prototype.prefetch = function (track) {
    var self = this;
    var trackId = track.uri.split('/').pop();
    return self.service.trackUrl(trackId, self.samplerate)
        .then(function (trackData) {
            track.bitdepth = trackData.bitdepth;
            track.samplerate = trackData.samplerate;
            track.trackType = trackData.trackType;
            return self.mpdPlugin.sendMpdCommand('add "' + trackData.uri + '"', [])
                .then(function () {
                    return self.mpdPlugin.sendMpdCommand('consume 1', []);
                });
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
    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

    return self.mpdPlugin.sendMpdCommand('pause', []);
};

// Qobuz resume
ControllerQobuz.prototype.resume = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::resume');
    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

    return self.mpdPlugin.sendMpdCommand('play', []);
};

// Qobuz seek
ControllerQobuz.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::seek');

    return self.mpdPlugin.seek(position);
};

ControllerQobuz.prototype.onRestart = function () { };

ControllerQobuz.prototype.onInstall = function () { };

ControllerQobuz.prototype.onUninstall = function () { };

ControllerQobuz.prototype.getUIConfig = function () {
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    return self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
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
            uiconf.sections[3].content[0].value = self.config.get('cache_favourites');
            uiconf.sections[3].content[1].value = self.config.get('cache_items');
            uiconf.sections[3].content[2].value = self.config.get('cache_editorial');

            uiconf.sections.splice(indexOfSectionToRemove, 1);

            return uiconf;
        })
        .fail(function () {
            libQ.reject(new Error());
        });
};

ControllerQobuz.prototype.setUIConfig = function (data) { };

ControllerQobuz.prototype.getConf = function (varName) { };

ControllerQobuz.prototype.setConf = function (varName, varValue) { };

ControllerQobuz.prototype.explodeUri = function (uri) {

    var self = this;

    var itemGetter;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri start uri: ' + uri);

    if (uri.startsWith('qobuz/track/')) {
        var trackId = uri.split('/').pop();
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri track id: ' + trackId);
        itemGetter = self.service.track.bind(self, trackId, self.samplerate);
    }
    else if (
        uri.startsWith('qobuz/album') ||
        uri.startsWith('qobuz/favourites/album') ||
        uri.startsWith('qobuz/purchases/album') ||
        uri.startsWith('qobuz/new/album') ||
        uri.startsWith('qobuz/bestsellers/album') ||
        uri.startsWith('qobuz/moststreamed/album') ||
        uri.startsWith('qobuz/press/album') ||
        uri.startsWith('qobuz/editor/album') ||
        uri.startsWith('qobuz/mostfeatured/album') ||
        uri.startsWith('qobuz/search/' + uri.split('/')[2] + '/album') ||
        uri.startsWith('qobuz/artist/' + uri.split('/')[2] + '/album') ||
        uri.startsWith('qobuz/favourites/artist/' + uri.split('/')[3] + '/album') ||
        uri.startsWith('qobuz/search/' + uri.split('/')[2] + '/artist/' + uri.split('/')[4] + '/album')) {

        var albumId = uri.split('/').pop();
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri albumId: ' + albumId);
        itemGetter = self.service.album.bind(self, albumId, self.samplerate);
    }
    else if (
        uri.startsWith('qobuz/playlist') ||
        uri.startsWith('qobuz/favourites/playlist') ||
        uri.startsWith('qobuz/editor/playlist') ||
        uri.startsWith('qobuz/public/playlist') ||
        uri.startsWith('qobuz/search/' + uri.split('/')[2] + '/playlist')) {

        var playlistId = uri.split('/').pop();
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri playlistId: ' + playlistId);
        itemGetter = self.service.playlist.bind(self, playlistId, self.samplerate);
    }
    else {
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri no uri pattern matched');
    }

    return itemGetter()
        .fail(function (e) {
            self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri failed');
            libQ.reject(new Error());
        });
};

ControllerQobuz.prototype.search = function (query) {

    var self = this;

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::search start query: ' + JSON.stringify(query));

    if (!query || !query.value || query.value.length === 0)
        return libQ.resolve([]);

    var queryParts = query.value.split(':');
    var searchQuery = query.value;
    var searchType;
    if (queryParts.length > 1) {
        searchQuery = queryParts[1];
        var queryType = queryParts[0].toLowerCase();
        if (queryType === 'albums' || queryType === 'album' || queryType === 'a') {
            searchType = 'albums';
        }
        else if (queryType === 'artists' || queryType === 'artist' || queryType === 'r') {
            searchType = 'artists';
        }
        else if (queryType === 'tracks' || queryType === 'track' || queryType === 't') {
            searchType = 'tracks';
        }
        else if (queryType === 'playlists' || queryType === 'playlist' || queryType === 'p') {
            searchType = 'playlists';
        }
    }

    return self.service.search(searchQuery, searchType)
        .fail(function (e) {
            libQ.reject(new Error());
        });
};

ControllerQobuz.prototype.initialiseService = function () {
    var self = this;
    self.service = new qobuzService(self.commandRouter.logger, self.apiArgs, self.cacheArgs);
};

ControllerQobuz.prototype.qobuzAccountLogin = function (data) {
    var self = this;

    return qobuzService
        .login(self.commandRouter.logger, self.apiArgs.appId, data["username"], data["password"])
        .then(function (result) {
            //update config
            self.config.set('username', data["username"]);
            self.config.set('user_auth_token', result);
            self.userAuthToken = result;

            //initalise qobuz service
            self.initialiseService();

            //celebrate great success!
            self.commandRouter.pushToastMessage('success', "Qobuz Account Login", 'You have been successsfully logged in to your Qobuz account');
        })
        .fail(function (e) {
            self.commandRouter.pushToastMessage('failure', "Qobuz Account Login", 'Qobuz account login failed.');
            libQ.reject(new Error());
        });
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

    self.commandRouter.pushToastMessage('success', "Qobuz Settings", 'Qobuz Settings successsfully updated.');

    return libQ.resolve({});
};

ControllerQobuz.prototype.saveQobuzCacheSettings = function (data) {
    var self = this;

    var cacheFavourites =
        data['cache_favourites']
            ? data['cache_favourites'].value
            : 360;

    var cacheItems =
        data['cache_items']
            ? data['cache_items'].value
            : 720;

    var cacheEditorial =
        data['cache_editorial']
            ? data['cache_editorial'].value
            : 720;

    self.config.set('cache_favourites', cacheFavourites);
    self.config.set('cache_items', cacheItems);
    self.config.set('cache_editorial', cacheEditorial);

    self.cacheArgs = { favourites: cacheFavourites, items: cacheItems, editorial: cacheEditorial };

    self.logger.info('write settings json:' + JSON.stringify(self.cacheArgs));

    return self.clearQobuzCache()
        .then(function () {
            self.initialiseService();
            self.commandRouter.pushToastMessage('success', "Qobuz Cache Settings", 'Qobuz Cache Settings successsfully updated.');
        })
        .fail(function (e) {
            self.commandRouter.pushToastMessage('failure', "Qobuz Cache Settings", 'Qobuz Cache Settings save failed.');
            libQ.reject(new Error());
        });
};

ControllerQobuz.prototype.clearQobuzCache = function () {
    var self = this;
    if (self.service) {
        return self.service.clearCache()
            .then(function () {
                self.commandRouter.pushToastMessage('success', "Qobuz Cache", 'Qobuz Cache successfully cleared.');
            })
            .fail(function (e) {
                self.commandRouter.pushToastMessage('failure', "Qobuz Cache", 'Qobuz Cache clear failed.');
                libQ.reject(new Error());
            });
    }
    else {
        self.commandRouter.pushToastMessage('success', "Qobuz Cache", 'Qobuz Cache successfully cleared.');
        return libQ.resolve();
    }
};