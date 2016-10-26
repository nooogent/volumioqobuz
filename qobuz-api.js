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
    self.qobuzBaseUri = "http://www.qobuz.com/api.json/0.2/";
    self.userAuthHeaderName = "X-User-Auth-Token";
    self.appIdHeaderName = "X-App-Id";
}

QobuzApi.prototype.login = function (appId, username, password) {

    var self = this;

    var defer = libQ.defer();

    self.logger.info('[' + Date.now() + '] ' + 'login start: ' + username);

    var params = {
        'app_id': appId,
        'password': self.getMd5Hash(password),
        'username': username
    };

    self.logger.info('[' + Date.now() + '] ' + 'login params: ' + JSON.stringify(params));

    var uri = self.qobuzBaseUri + "user/login";

    self.logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest uri: ' + uri);

    unirest
        .get(uri)
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

QobuzApi.prototype.getTrackUrl = function (trackId, formatId) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getTrackUrl start trackId: ' + trackId + ' formatId : ' + formatId);

    var tsrequest = Math.floor(Date.now() / 1000);
    self.logger.info('[' + Date.now() + '] ' + 'getTrackUrl generated ts: ' + tsrequest);

    var params = {
        'format_id': formatId,
        'intent': 'stream',
        'request_sig': self.getMd5Hash(
            "trackgetFileUrl" +
            "format_id" + formatId +
            "intentstream" +
            "track_id" + trackId +
            tsrequest +
            self.appSecret),
        'request_ts': tsrequest,
        'track_id': trackId
    };
    self.logger.info('[' + Date.now() + '] ' + 'getTrackUrl params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "track/getFileUrl");
};

QobuzApi.prototype.getFavourites = function (favouriteType) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getFavourites start: ' + favouriteType);

    var params = {
        'type': favouriteType
    };
    self.logger.info('[' + Date.now() + '] ' + 'getFavourites params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "favorite/getUserFavorites");
};

QobuzApi.prototype.getUserPlaylists = function () {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getUserPlaylists start');

    var params = {};
    self.logger.info('[' + Date.now() + '] ' + 'getUserPlaylists params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "playlist/getUserPlaylists");
};

QobuzApi.prototype.getAlbum = function (albumId) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getAlbum start: ' + albumId);

    var params = {
        'album_id': albumId
    };
    self.logger.info('[' + Date.now() + '] ' + 'getAlbum params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "album/get");
};

QobuzApi.prototype.getPlaylist = function (playlistId) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getPlaylist start');

    var params = {
        'extra': 'tracks',
        'playlist_id': playlistId
    };
    self.logger.info('[' + Date.now() + '] ' + 'getPlaylist params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "playlist/get");
};

QobuzApi.prototype.getTrack = function (trackId) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getTrack start');

    var params = {
        'track_id': trackId
    };
    self.logger.info('[' + Date.now() + '] ' + 'getTrack params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "track/get");
};

QobuzApi.prototype.getFeaturedAlbums = function (type, genreId) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getFeaturedAlbums start');

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

    self.logger.info('[' + Date.now() + '] ' + 'getFeaturedAlbums params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "album/getFeatured");
};

QobuzApi.prototype.getFeaturedPlaylists = function (type, genreId) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'getFeaturedPlaylists start');

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

    self.logger.info('[' + Date.now() + '] ' + 'getFeaturedPlaylists params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "playlist/getFeatured");
};

QobuzApi.prototype.search = function (query, type) {

    var self = this;
    self.logger.info('[' + Date.now() + '] ' + 'search start');

    var params = {
        query: query
    };

    if (type)
        params.type = type;

    self.logger.info('[' + Date.now() + '] ' + 'search params: ' + JSON.stringify(params));

    return self.makeQobuzRequest(params, "catalog/search");
};

QobuzApi.prototype.makeQobuzRequest = function (params, method) {
    var self = this;

    self.logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest start');

    var defer = libQ.defer();

    var uri = self.qobuzBaseUri + method;
    self.logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest uri: ' + uri);

    var headers = { [self.appIdHeaderName]: self.appId, [self.userAuthHeaderName]: self.userAuthToken };
    self.logger.info('[' + Date.now() + '] ' + 'makeQobuzRequest headers: ' + JSON.stringify(headers));

    params.limit = 150;

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

QobuzApi.prototype.getMd5Hash = function (str) {
    return crypto.createHash('md5').update(str).digest("hex");
};
