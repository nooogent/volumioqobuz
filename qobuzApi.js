'use strict';

var crypto = require('crypto');
var libQ = require('kew');
var unirest = require('unirest');

module.exports = QobuzApi;

function QobuzApi(logger, appId, appSecret, userAuthToken) {
    var self = this;

    self.logger = logger;
    self.appId = appId;
    self.appSecret = appSecret;
    self.userAuthToken = userAuthToken;
    
    var getTrackUrl = function (trackId, formatId) {
        var tsrequest = Math.floor(Date.now() / 1000);

        var params = {
            'format_id': formatId,
            'intent': 'stream',
            'request_sig': QobuzApi.getMd5Hash(
                "trackgetFileUrl" +
                "format_id" + formatId +
                "intentstream" +
                "track_id" + trackId +
                tsrequest +
                self.appSecret),
            'request_ts': tsrequest,
            'track_id': trackId
        };

        return makeQobuzRequest(params, "track/getFileUrl");
    };

    var getFavourites = function (favouriteType) {
        var params = {
            'type': favouriteType
        };

        return makeQobuzRequest(params, "favorite/getUserFavorites");
    };

    var getUserPlaylists = function () {
        return makeQobuzRequest({}, "playlist/getUserPlaylists");
    };

    var getAlbum = function (albumId) {
        var params = {
            'album_id': albumId
        };

        return makeQobuzRequest(params, "album/get");
    };

    var getPlaylist = function (playlistId) {
        var params = {
            'extra': 'tracks',
            'playlist_id': playlistId
        };

        return makeQobuzRequest(params, "playlist/get");
    };

    var getTrack = function (trackId) {
        var params = {
            'track_id': trackId
        };

        return makeQobuzRequest(params, "track/get");
    };

    var getFeaturedAlbums = function (type, genreId) {
        var params = {};

        if (genreId)
            params.genre_id = genreId;

        if (type) {
            switch (type) {
                case "new":
                    params.type = "new-releases";
                    break;
                case "bestsellers":
                    params.type = "best-sellers";
                    break;
                case "moststreamed":
                    params.type = "most-streamed";
                    break;
                case "press":
                    params.type = "press-awards";
                    break;
                case "editor":
                    params.type = "editor-picks";
                    break;
                case "mostfeatured":
                    params.type = "most-featured";
                    break;
                default:
            }
        }
        
        return makeQobuzRequest(params, "album/getFeatured");
    };

    var getFeaturedPlaylists = function (type, genreId) {
        var params = {};

        if (genreId)
            params.genre_id = genreId;

        switch (type) {
            case "public":
                params.type = "last-created";
                break;
            case "editor":
            default:
                params.type = "editor-picks";
        }

        return makeQobuzRequest(params, "playlist/getFeatured", 100);
    };

    var getPurchases = function () {
        return makeQobuzRequest({}, "purchase/getUserPurchases");
    };

    var getArtist = function (artistId) {
        var params = {
            'extra': 'albums',
            'artist_id': artistId
        };

        return makeQobuzRequest(params, "artist/get");
    };

    var search = function (query, type) {
        var params = {
            query: query
        };

        if (type)
            params.type = type;

        return makeQobuzRequest(params, "catalog/search", 50);
    };

    var makeQobuzRequest = function (params, method, limit) {
        self.logger.info('[' + Date.now() + '] ' + 'QobuzApi call method: ' + method + '; params: ' + JSON.stringify(params));

        var defer = libQ.defer();

        var uri = QobuzApi.qobuzBaseUri + method;

        var headers = { [QobuzApi.appIdHeaderName]: self.appId, [QobuzApi.userAuthHeaderName]: self.userAuthToken };

        params.limit = limit || 150;

        unirest
            .get(uri)
            .headers(headers)
            .query(params)
            .end(function (response) {
                if (response.ok) {
                    self.logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest response: ' + JSON.stringify(response.body));
                    defer.resolve(response.body);
                }
                else {
                    self.logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest failed response: ' + JSON.stringify(response.body));
                    defer.reject(new Error());
                }
            });

        return defer.promise;
    };

    return {
        getAlbum: getAlbum,
        getArtist: getArtist,
        getFavourites: getFavourites,
        getFeaturedAlbums: getFeaturedAlbums,
        getFeaturedPlaylists: getFeaturedPlaylists,
        getPlaylist: getPlaylist,
        getPurchases: getPurchases,
        getTrack: getTrack,
        getTrackUrl: getTrackUrl,
        getUserPlaylists: getUserPlaylists,
        search: search
    };
}

QobuzApi.qobuzBaseUri = "http://www.qobuz.com/api.json/0.2/";
QobuzApi.userAuthHeaderName = "X-User-Auth-Token";
QobuzApi.appIdHeaderName = "X-App-Id";

QobuzApi.getMd5Hash = function (str) {
    return crypto.createHash('md5').update(str).digest("hex");
};

QobuzApi.login = function (logger, appId, username, password) {
    var defer = libQ.defer();

    logger.info('[' + Date.now() + '] ' + 'login start: ' + username);

    var params = {
        'app_id': appId,
        'password': QobuzApi.getMd5Hash(password),
        'username': username
    };

    logger.info('[' + Date.now() + '] ' + 'login params: ' + JSON.stringify(params));

    var uri = QobuzApi.qobuzBaseUri + "user/login";

    logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest uri: ' + uri);

    unirest
        .get(uri)
        .query(params)
        .end(function (response) {
            if (response.ok) {
                logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest response: ' + JSON.stringify(response.body));
                defer.resolve(response.body);
            }
            else {
                logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest failed response: ' + JSON.stringify(response.body));
                defer.reject(new Error());
            }
        });

    return defer.promise;
};