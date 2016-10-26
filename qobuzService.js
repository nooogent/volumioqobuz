'use strict';

var libQ = require('kew');
var qobuzApi = require('./qobuz-api');
var cachemanager = require('cache-manager');
var memoryCache = cachemanager.caching({ store: 'memory', max: 100, ttl: 10 * 60/*seconds*/ });
var navigation = require('./navigation')();

module.exports = QobuzService;

function QobuzService(logger, appId, appSecret, userAuthToken) {
    var self = this;
    self.logger = logger;

    self.api = new qobuzApi(logger, appId, appSecret, userAuthToken);

    self.rootList = function () {
        var root = navigation.populate(
            ["list"],
            [
                navigation.navigationFolder("My Albums", "qobuz/favourites/albums"),
                navigation.navigationFolder("My Tracks", "qobuz/favourites/tracks"),
                navigation.navigationFolder("My Playlists", "qobuz/favourites/playlists")
            ],
            "/");

        self.logger.info('rootList nav: ' + JSON.stringify(root));

        return libQ.resolve(root);
    };

    self.favouriteAlbumsList = function () {
        var defer = libQ.defer();
        tryCache('qobuz/favourites/albums', favouriteAlbums)
            .then(function (items) {
                defer.resolve(navigation.populate(["list", "grid"], items, "qobuz"));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.favouriteTracksList = function () {
        var defer = libQ.defer();
        tryCache('qobuz/favourites/tracks', favouriteTracks)
            .then(function (items) {
                defer.resolve(navigation.populate(["list"], items, "qobuz"));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.userPlaylistsList = function () {
        var defer = libQ.defer();
        tryCache('qobuz/favourites/playlists', userPlaylists)
            .then(function (items) {
                defer.resolve(navigation.populate(["list", "grid"], items, "qobuz"));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    var tryCache = function (cacheKey, apiCall) {
        var defer = libQ.defer();
        self.logger.info('favouriteAlbumsList: cache check');
        try {
            memoryCache.wrap(cacheKey, function () {
                self.logger.info(cacheKey + ': not in cache');
                return apiCall();
            })
                .then(function (items) {
                    self.logger.info(cacheKey + ': finished with cache');
                    defer.resolve(items);
                });
        } catch (e) {
            self.logger.info(cacheKey + ': cache error' + e.message);
            defer.reject(new Error());
        };
        return defer.promise;
    };

    var favouriteAlbums = function () {
        return self.api.getFavourites("albums")
            .then(function (result) {
                return result.albums.items.map(function (qobuzAlbum) {
                    var title = qobuzAlbum.title + ' (' + new Date(qobuzAlbum.released_at * 1000).getFullYear() + ')';
                    return navigation.item("folder", title, qobuzAlbum.artist.name, "", qobuzAlbum.image.small, '', "qobuz/favourites/album/" + qobuzAlbum.id);
                });
            });
    };

    var favouriteTracks = function () {
        return self.api.getFavourites("tracks")
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return navigation.track(qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, "qobuz/track/" + qobuzTrack.id);
                });
            });
    };

    var userPlaylists = function () {
        return self.api.getUserPlaylists()
            .then(function (result) {
                return result.playlists.items.map(function (qobuzPlaylist) {
                    return navigation.item("folder", qobuzPlaylist.name, qobuzPlaylist.owner.name, qobuzPlaylist.description, qobuzPlaylist.images[0], "", "qobuz/favourites/playlist/" + qobuzPlaylist.id);
                });
            });
    };
};

    // else if (curUri.startsWith('qobuz/favourites/album')) {
    //     if (curUri === 'qobuz/favourites/albums') {
    //         response = self.favouriteAlbumsList();
    //     }
    //     else {
    //         self.commandRouter.logger.info('ControllerQobuz::handleBrowseUri album tracks start');
    //         response = self.albumTracksList(uriParts[3], 'qobuz/favourites/albums');
    //     }
    // }
    // else if (curUri.startsWith('qobuz/favourites/tracks')) {
    //     response = self.favouriteTracksList(curUri);
    // }
    // else if (curUri.startsWith('qobuz/favourites/playlist')) {
    //     if (curUri === 'qobuz/favourites/playlists') {
    //         response = self.userPlaylistsList(curUri);
    //     }
    //     else {
    //         self.commandRouter.logger.info('ControllerQobuz::handleBrowseUri playlist tracks start');
    //         response = self.playlistTracksList(uriParts[3], 'qobuz/favourites/playlists');