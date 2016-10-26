'use strict';

var libQ = require('kew');
//var libMpd = require('mpd');
var config = new (require('v-conf'))();
var qobuzApi = require('./qobuz-api');
var qobuzService = require('./qobuzService');

// Define theControllerQobuz class
module.exports = ControllerQobuz;
function ControllerQobuz(context) {
    // This fixed variable will let us refer to 'this' object at deeper scopes
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
};


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
    self.initialiseApi();
    return libQ.resolve();
};

ControllerQobuz.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    self.logger.info('ControllerQobuz::handleBrowseUri: ' + curUri);

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
                self.logger.info('ControllerQobuz::handleBrowseUri album tracks start');
                response = self.albumTracksList(uriParts[3], 'qobuz/favourites/albums');
            }
        }
        else if (curUri.startsWith('qobuz/favourites/tracks')) {
            response = self.service.favouriteTracksList(curUri);
        }
        else if (curUri.startsWith('qobuz/favourites/playlist')) {
            if (curUri === 'qobuz/favourites/playlists') {
                response = self.service.userPlaylistsList(curUri);
            }
            else {
                self.logger.info('ControllerQobuz::handleBrowseUri playlist tracks start');
                response = self.playlistTracksList(uriParts[3], 'qobuz/favourites/playlists');
            }
        }
    }
    return response;
};

ControllerQobuz.prototype.listItem = function (type, title, artist, album, albumart, icon, uri) {
    return {
        service: 'qobuz',
        type: type,
        title: title,
        artist: artist,
        album: album,
        albumart: albumart,
        icon: icon,
        uri: uri
    };
};

ControllerQobuz.prototype.folderListItem = function (title, artist, album, uri) {
    return this.listItem('folder', title, artist, album, '', 'fa fa-folder-open-o', uri);
};

ControllerQobuz.prototype.trackListItem = function (title, artist, album, uri) {
    return this.listItem('song', title, artist, album, '', 'fa fa-microphone', uri);
};

ControllerQobuz.prototype.navigationFolderListItem = function (title, uri) {
    return this.folderListItem(title, "", "", uri);
};

ControllerQobuz.prototype.populatedNavigation = function (views, items, prevUri) {
    var nav = this.emptyNavigation();
    nav.navigation.lists[0].availableListViews = views;
    nav.navigation.lists[0].items = items;
    nav.navigation.prev.uri = prevUri;
    return nav;
};

ControllerQobuz.prototype.emptyNavigation = function () {
    return {
        navigation: {
            lists: [
                {
                    "availableListViews": [],
                    "items": []
                }
            ],
            "prev": {
                uri: ""
            }
        }
    };
};

// ControllerQobuz.prototype.rootList = function () {
//     var self = this;
//     var nav = self.populatedNavigation(
//         ["list"],
//         [
//             self.navigationFolderListItem("My Albums", "qobuz/favourites/albums"),
//             self.navigationFolderListItem("My Tracks", "qobuz/favourites/tracks"),
//             self.navigationFolderListItem("My Playlists", "qobuz/favourites/playlists")
//         ],
//         "/");

//     self.commandRouter.logger.info('rootList nav: ' + JSON.stringify(nav));

//     return libQ.resolve(nav);
// };

// ControllerQobuz.prototype.favouriteAlbumsList = function () {
//     var self = this;

//     var defer = libQ.defer();

//     var parseResult = function (result) {
//         var items = [];
//         for (var i = 0; i < result.albums.items.length; i++) {
//             var qobuzAlbum = result.albums.items[i];
//             var title = qobuzAlbum.title + ' (' + new Date(qobuzAlbum.released_at * 1000).getFullYear() + ')';
//             items.push(self.listItem("folder", title, qobuzAlbum.artist.name, "", qobuzAlbum.image.small, '', "qobuz/favourites/album/" + qobuzAlbum.id));
//         }
//         return items;
//     };

//     self.commandRouter.logger.info('favouriteAlbumsList: ' + JSON.stringify(self.api));

//     self.api.getFavourites("albums")
//         .then(function (result) {
//             defer.resolve(self.populatedNavigation(["list", "grid"], parseResult(result), "qobuz"));
//         })
//         .fail(function (e) { defer.reject(new Error()); });

//     return defer.promise;
// };

// ControllerQobuz.prototype.favouriteTracksList = function () {
//     var self = this;

//     var defer = libQ.defer();

//     var parseResult = function (result) {
//         var items = [];
//         for (var i = 0; i < result.tracks.items.length; i++) {
//             var qobuzTrack = result.tracks.items[i];
//             items.push(self.trackListItem(qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, "qobuz/track/" + qobuzTrack.id));
//         }
//         return items;
//     };

//     self.api.getFavourites("tracks")
//         .then(function (result) {
//             defer.resolve(self.populatedNavigation(["list"], parseResult(result), "qobuz"));
//         })
//         .fail(function (e) { defer.reject(new Error()); });

//     return defer.promise;
// };

// ControllerQobuz.prototype.userPlaylistsList = function () {
//     var self = this;

//     var defer = libQ.defer();

//     var parseResult = function (result) {
//         var items = [];
//         for (var i = 0; i < result.playlists.items.length; i++) {
//             var qobuzPlayList = result.playlists.items[i];
//             items.push(self.listItem("folder", qobuzPlayList.name, qobuzPlayList.owner.name, qobuzPlayList.description, qobuzPlayList.images[0], "", "qobuz/favourites/playlist/" + qobuzPlayList.id));
//         }
//         return items;
//     };

//     self.api.getUserPlaylists()
//         .then(function (result) {
//             defer.resolve(self.populatedNavigation(["list", "grid"], parseResult(result), "qobuz"));
//         })
//         .fail(function (e) { defer.reject(new Error()); });

//     return defer.promise;
// };

ControllerQobuz.prototype.albumTracksList = function (albumId, prevUri) {
    var self = this;

    var defer = libQ.defer();

    var parseResult = function (result) {
        var items = [];
        for (var i = 0; i < result.tracks.items.length; i++) {
            var qobuzTrack = result.tracks.items[i];
            items.push(self.trackListItem(qobuzTrack.title, result.artist.name, result.title, "qobuz/track/" + qobuzTrack.id));
        }
        return items;
    };

    self.api.getAlbum(albumId)
        .then(function (result) {
            defer.resolve(self.populatedNavigation(["list"], parseResult(result), prevUri));
        })
        .fail(function (e) { defer.reject(new Error()); });

    return defer.promise;
};

ControllerQobuz.prototype.playlistTracksList = function (playlistId, prevUri) {
    var self = this;

    var defer = libQ.defer();

    var parseResult = function (result) {
        var items = [];
        for (var i = 0; i < result.tracks.items.length; i++) {
            var qobuzTrack = result.tracks.items[i];
            items.push(self.trackListItem(qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, "qobuz/track/" + qobuzTrack.id));
        }
        return items;
    };

    self.api.getPlaylist(playlistId)
        .then(function (result) {
            defer.resolve(self.populatedNavigation(["list"], parseResult(result), prevUri));
        })
        .fail(function (e) { defer.reject(new Error()); });

    return defer.promise;
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
    var self = this;
    //
};

ControllerQobuz.prototype.onInstall = function () {
    var self = this;
    //Perform your installation tasks here
};

ControllerQobuz.prototype.onUninstall = function () {
    var self = this;
    //Perform your installation tasks here
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
            }

            //remove either the log on or logout section
            var indexOfSectionToRemove =
                (self.config.get('user_auth_token') && self.config.get('user_auth_token').length > 0)
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
    var self = this;
    //Perform your installation tasks here
};

ControllerQobuz.prototype.getConf = function (varName) {
    var self = this;
    //Perform your installation tasks here
};

ControllerQobuz.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------
// These are 'this' aware, and return a promise

ControllerQobuz.prototype.explodeUri = function (uri) {

    var self = this;

    var defer = libQ.defer();
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri start uri: ' + uri);

    if (uri.startsWith('qobuz/track/')) {
        var trackId = uri.split('/')[2];
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri track id: ' + trackId);

        var promises = [
            self.api.getTrack(trackId),
            self.api.getTrackUrl(trackId, 6)
        ];

        libQ.all(promises)
            .then(function (results) {
                defer.resolve(
                    {
                        service: 'qobuz',
                        type: 'track',
                        name: results[0].title,
                        title: results[0].title + '?',
                        artist: results[0].album.artist.name,
                        album: results[0].album.title,
                        duration: results[0].duration,
                        albumart: results[0].album.image.small,
                        uri: results[1].url,
                        samplerate: results[1].sampling_rate,
                        bitdepth: results[1].bit_depth + ' bit',
                        trackType: results[1].mime_type //.split('/')[1];
                    }
                );
            })
            .fail(function (e) {
                self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri failed');
                defer.reject(new Error());
            });
    }
    else if (uri.startsWith('qobuz/favourites/album')) {
        var albumId = uri.split('/')[3];
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri albumId: ' + albumId);

        self.api.getAlbum(albumId)
            .then(function (result) {
                self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri album gettrackurls start:');
                var promises = [];
                for (var i = 0; i < result.tracks.items.length; i++) {
                    promises.push(self.api.getTrackUrl(result.tracks.items[i].id, 6));
                }
                var items = [];
                libQ.all(promises)
                    .then(function (urlResults) {
                        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri album gettrackurls results:');
                        for (var j = 0; j < result.tracks.items.length; j++) {
                            items.push(
                                {
                                    service: 'qobuz',
                                    type: 'track',
                                    name: result.tracks.items[j].title,
                                    title: result.tracks.items[j].title + '?',
                                    artist: result.artist.name,
                                    album: result.title,
                                    duration: result.tracks.items[j].duration,
                                    albumart: result.image.small,
                                    uri: urlResults[j].url,
                                    samplerate: urlResults[j].sampling_rate,
                                    bitdepth: urlResults[j].bit_depth + ' bit',
                                    trackType: urlResults[j].mime_type //.split('/')[1];
                                });
                        }

                        defer.resolve(items);
                    });
            })
            .fail(function (e) { defer.reject(new Error()); });
    }
    else {
        self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerQobuz::explodeUri no uri pattern matched');
    }

    return defer.promise;
};

ControllerQobuz.prototype.initialiseApi = function () {
    var self = this;

    self.service = new qobuzService(self.commandRouter.logger, self.appId, self.appSecret, self.userAuthToken);
    self.api = new qobuzApi(self.commandRouter.logger, self.appId, self.appSecret, self.userAuthToken);
}

ControllerQobuz.prototype.qobuzAccountLogin = function (data) {
    var self = this;

    var defer = libQ.defer();

    var rejectAndPushToast = function () {
        self.commandRouter.pushToastMessage('failure', "Qobuz Account Login", 'Qobuz account login failed.');
        defer.reject(new Error());
    };

    if (!data["username"] || data["username"].length === 0 || !data["password"] || data["password"].length === 0)
        return rejectAndPushToast();

    new qobuzApi(this.commandRouter.logger)
        .login(self.appId, data["username"], data["password"])
        .then(function (result) {
            if (result.user_auth_token && result.user_auth_token.length > 0) {
                //update config
                self.config.set('username', data["username"]);
                self.config.set('user_auth_token', result.user_auth_token);
                self.userAuthToken = result.user_auth_token;

                //initalise qobuz api
                self.initialiseApi();

                //celebrate great success!
                self.commandRouter.pushToastMessage('success', "Qobuz Account Login", 'You have been successsfully logged in to your Qobuz account');
                defer.resolve({});
            }
            else {
                rejectAndPushToast();
            }
        })
        .fail(function (e) { rejectAndPushToast(); });

    return defer.promise;
};

ControllerQobuz.prototype.qobuzAccountLogout = function () {
    var self = this;

    self.config.set('username', "");
    self.config.set('user_auth_token', "");

    delete self.userAuthToken;
    delete self.api;

    self.commandRouter.pushToastMessage('success', "Qobuz Account Log out", 'You have been successsfully logged out of your Qobuz account');

    return libQ.resolve();
};

ControllerQobuz.prototype.saveQobuzSettings = function (data) {
    var self = this;

    self.commandRouter.logger.info('saveQobuzSettings data: ' + JSON.stringify(data));

    var maxBitRate =
        (data['max_bitrate'] && data['max_bitrate'].value && data['max_bitrate'].value.length > 0)
            ? data['max_bitrate'].value
            : 6;
    self.config.set('bitrate', maxBitRate);
    self.samplerate = maxBitRate;
    self.commandRouter.pushToastMessage('success', "Qobuz Settings update", 'Your setting have been successsfully updated.');

    return libQ.resolve({});
};