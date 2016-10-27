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
                navigation.navigationFolder("My Playlists", "qobuz/favourites/playlists"),
                navigation.navigationFolder("Qobuz Playlists", "qobuz/editor/playlists"),
                navigation.navigationFolder("New Releases", "qobuz/new/albums"),
                navigation.navigationFolder("Best Sellers", "qobuz/bestsellers/albums"),
                navigation.navigationFolder("Most Streamed", "qobuz/moststreamed/albums"),
                navigation.navigationFolder("Press Awards", "qobuz/press/albums"),
                navigation.navigationFolder("Selected by Qobuz", "qobuz/editor/albums"),
                navigation.navigationFolder("Selected by the Media", "qobuz/mostfeatured/albums")
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

    self.albumTracksList = function (albumId, prevUri) {
        var defer = libQ.defer();
        tryCache('qobuz/albumTracks/' + albumId, albumTracks.bind(self, albumId))
            .then(function (items) {
                defer.resolve(navigation.populate(["list"], items, prevUri));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.playlistTracksList = function (playlistId, prevUri) {
        var defer = libQ.defer();
        tryCache('qobuz/playlistTracks/' + playlistId, playlistTracks.bind(self, playlistId))
            .then(function (items) {
                defer.resolve(navigation.populate(["list"], items, prevUri));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.featuredAlbumsList = function (type, prevUri) {
        var defer = libQ.defer();
        tryCache('qobuz/' + type + '/albums/', featuredAlbums.bind(self, type))
            .then(function (items) {
                defer.resolve(navigation.populate(["list", "grid"], items, prevUri));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.featuredPlaylistsList = function (type, prevUri) {
        var defer = libQ.defer();
        tryCache('qobuz/' + type + '/playlists/', featuredPlaylists.bind(self, type))
            .then(function (items) {
                defer.resolve(navigation.populate(["list", "grid"], items, prevUri));
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.search = function (query, type) {
        var defer = libQ.defer();
        search(query, type)
            .then(function (items) {
                defer.resolve(items);
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.track = function (trackId, formatId) {
        var defer = libQ.defer();
        tryCache('qobuz/track/' + trackId, track.bind(self, trackId, formatId))
            .then(function (item) {
                defer.resolve(item);
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.album = function (albumId, formatId) {
        var defer = libQ.defer();
        tryCache('qobuz/album/' + albumId, album.bind(self, albumId, formatId))
            .then(function (items) {
                defer.resolve(items);
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    self.playlist = function (playlistId, formatId) {
        var defer = libQ.defer();
        tryCache('qobuz/playlist/' + playlistId, playlist.bind(self, playlistId, formatId))
            .then(function (items) {
                defer.resolve(items);
            })
            .fail(function (e) {
                defer.reject(new Error());
            });
        return defer.promise;
    };

    var tryCache = function (cacheKey, apiCall) {
        var defer = libQ.defer();
        self.logger.info('cache check');
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
        }
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

    var albumTracks = function (albumId) {
        return self.api.getAlbum(albumId)
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return navigation.track(qobuzTrack.title, result.artist.name, result.title, "qobuz/track/" + qobuzTrack.id);
                });
            });
    };

    var playlistTracks = function (playlistId) {
        return self.api.getPlaylist(playlistId)
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return navigation.track(qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, "qobuz/track/" + qobuzTrack.id);
                });
            });
    };

    var featuredAlbums = function (type) {
        return self.api.getFeaturedAlbums(type)
            .then(function (result) {
                return result.albums.items.map(function (qobuzAlbum) {
                    var title = qobuzAlbum.title + ' (' + new Date(qobuzAlbum.released_at * 1000).getFullYear() + ')';
                    return navigation.item("folder", title, qobuzAlbum.artist.name, "", qobuzAlbum.image.small, '', "qobuz/" + type + "/album/" + qobuzAlbum.id);
                });
            });
    };

    var featuredPlaylists = function (type) {
        return self.api.getFeaturedPlaylists(type)
            .then(function (result) {
                return result.playlists.items.map(function (qobuzPlaylist) {
                    return navigation.item("folder", qobuzPlaylist.name, qobuzPlaylist.owner.name, qobuzPlaylist.description, qobuzPlaylist.images[0], "", "qobuz/" + type + "/playlist/" + qobuzPlaylist.id);
                });
            });
    };

    var search = function (query, type) {
        return self.api.search(query, type)
            .then(function (result) {
                var resultLists = [];
                if (result.tracks.items && result.tracks.items.length > 0) {
                    var tracksList = result.tracks.items.map(function (qobuzTrack) {
                        return navigation.item('song', qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, qobuzTrack.album.image.small, '', 'qobuz/track/' + qobuzTrack.id);
                    });
                    resultLists.push({ type: 'title', title: 'Qobuz Tracks', availableListViews: ["list"], items: tracksList });

                }

                if (result.albums.items && result.albums.items.length > 0) {
                    var albumsList = result.albums.items.map(function (qobuzAlbum) {
                        var title = qobuzAlbum.title + ' (' + new Date(qobuzAlbum.released_at * 1000).getFullYear() + ')';
                        return navigation.item('folder', title, qobuzAlbum.artist.name, '', qobuzAlbum.image.small, '', 'qobuz/album/' + qobuzAlbum.id);
                    });
                    resultLists.push({ type: 'title', title: 'Qobuz Albums', availableListViews: ["list", "grid"], items: albumsList });
                }

                if (result.playlists.items && result.playlists.items.length > 0) {
                    var playlistsList = result.playlists.items.map(function (qobuzPlaylist) {
                        return navigation.item("folder", qobuzPlaylist.name, qobuzPlaylist.owner.name, qobuzPlaylist.description, qobuzPlaylist.images[0], "", "qobuz/playlist/" + qobuzPlaylist.id);
                    });
                    resultLists.push({ type: 'title', title: 'Qobuz Playlists', availableListViews: ["list, grid"], items: playlistsList });
                }

                return resultLists;
            });
    };

    var track = function (trackId, formatId) {
        var defer = libQ.defer();

        var promises = [
            self.api.getTrack(trackId),
            self.api.getTrackUrl(trackId, formatId)
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
                defer.reject(new Error());
            });

        return defer.promise;
    };

    var album = function (albumId, formatId) {
        var defer = libQ.defer();

        self.api.getAlbum(albumId)
            .then(function (result) {
                libQ.all(
                    result.tracks.items.map(function (qobuzTrack) {
                        return self.api.getTrackUrl(qobuzTrack.id, formatId);
                    }))
                    .then(function (urlResults) {
                        defer.resolve(
                            result.tracks.items.map(function (qobuzTrack, i) {
                                return {
                                    service: 'qobuz',
                                    type: 'track',
                                    name: qobuzTrack.title,
                                    title: qobuzTrack.title + '?',
                                    artist: result.artist.name,
                                    album: result.title,
                                    duration: qobuzTrack.duration,
                                    albumart: result.image.small,
                                    uri: urlResults[i].url,
                                    samplerate: urlResults[i].sampling_rate,
                                    bitdepth: urlResults[i].bit_depth + ' bit',
                                    trackType: urlResults[i].mime_type //.split('/')[1];
                                };
                            })
                        );
                    });
            })
            .fail(function (e) { defer.reject(new Error()); });

        return defer.promise;
    };

    var playlist = function (playlistId, formatId) {
        var defer = libQ.defer();

        self.api.getPlaylist(playlistId)
            .then(function (result) {
                libQ.all(
                    result.tracks.items.map(function (qobuzTrack) {
                        return self.api.getTrackUrl(qobuzTrack.id, formatId);
                    }))
                    .then(function (urlResults) {
                        defer.resolve(
                            result.tracks.items.map(function (qobuzTrack, i) {
                                return {
                                    service: 'qobuz',
                                    type: 'track',
                                    name: qobuzTrack.title,
                                    title: qobuzTrack.title + '?',
                                    artist: qobuzTrack.album.artist.name,
                                    album: qobuzTrack.album.title,
                                    duration: qobuzTrack.duration,
                                    albumart: qobuzTrack.album.image.small,
                                    uri: urlResults[i].url,
                                    samplerate: urlResults[i].sampling_rate,
                                    bitdepth: urlResults[i].bit_depth + ' bit',
                                    trackType: urlResults[i].mime_type //.split('/')[1];
                                };
                            })
                        );
                    });
            })
            .fail(function (e) { defer.reject(new Error()); });

        return defer.promise;
    };
}

QobuzService.prototype.login = function (logger, appId, username, password) {
    var defer = libQ.defer();

    if (!username || username.length === 0 || !password || password.length === 0)
        defer.reject(new Error());
    else {
        new qobuzApi(logger)
            .login(appId, username, password)
            .then(function (result) {
                if (result.user_auth_token && result.user_auth_token.length > 0) {
                    defer.resolve(result.user_auth_token);
                }
                else {
                    defer.reject(new Error());
                }
            })
            .fail(function (e) { defer.reject(new Error()); });
    }
    return defer.promise;
};