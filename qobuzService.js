var libQ = require('kew');
var qobuzApi = require('./qobuz-api');
var cachemanager = require('cache-manager');
var memoryCache = cachemanager.caching({ store: 'memory', max: 100, ttl: 10 * 60/*seconds*/ });
var navigation = require('./navigation')();

module.exports = QobuzService;

function QobuzService(logger, appId, appSecret, userAuthToken) {
    var self = this;
    
    var api = new qobuzApi(logger, appId, appSecret, userAuthToken);

    self.rootList = function () {
        return libQ.resolve(
            navigation.browse(
                ["list"],
                [
                    navigation.navigationFolder("My Albums", "qobuz/favourites/albums"),
                    navigation.navigationFolder("My Tracks", "qobuz/favourites/tracks"),
                    navigation.navigationFolder("My Playlists", "qobuz/favourites/playlists"),
                    navigation.navigationFolder("My Artists", "qobuz/favourites/artists"),
                    navigation.navigationFolder("My Purchases", "qobuz/purchases"),
                    navigation.navigationFolder("Qobuz Playlists", "qobuz/editor/playlists"),
                    navigation.navigationFolder("New Releases", "qobuz/new/albums"),
                    navigation.navigationFolder("Best Sellers", "qobuz/bestsellers/albums"),
                    navigation.navigationFolder("Most Streamed", "qobuz/moststreamed/albums"),
                    navigation.navigationFolder("Press Awards", "qobuz/press/albums"),
                    navigation.navigationFolder("Selected by Qobuz", "qobuz/editor/albums"),
                    navigation.navigationFolder("Selected by the Media", "qobuz/mostfeatured/albums")
                ],
                "/"));
    };

    self.purchaseTypesList = function () {
        return libQ.resolve(
            navigation.browse(
                ["list"],
                [
                    navigation.navigationFolder("Albums", "qobuz/purchases/albums"),
                    navigation.navigationFolder("Tracks", "qobuz/purchases/tracks")
                ],
                "qobuz"));
    };

    self.favouriteAlbumsList = function () {
        return navigationItemList('qobuz/favourites/albums', favouriteAlbums, ["list", "grid"], "qobuz");
    };

    self.favouriteTracksList = function () {
        return navigationItemList('qobuz/favourites/tracks', favouriteTracks, ["list"], "qobuz");
    };

    self.favouriteArtistsList = function () {
        return navigationItemList('qobuz/favourites/artists', favouriteArtists, ["list", "grid"], "qobuz");
    };

    self.userPlaylistsList = function () {
        return navigationItemList('qobuz/favourites/playlists', userPlaylists, ["list", "grid"], "qobuz");
    };

    self.albumTracksList = function (albumId, prevUri) {
        return navigationItemList('qobuz/albumTracks/' + albumId, albumTracks.bind(self, albumId), ["list"], prevUri);
    };

    self.playlistTracksList = function (playlistId, prevUri) {
        return navigationItemList('qobuz/playlistTracks/' + playlistId, playlistTracks.bind(self, playlistId), ["list"], prevUri);
    };

    self.featuredAlbumsList = function (type, prevUri) {
        return navigationItemList('qobuz/' + type + '/albums/', featuredAlbums.bind(self, type), ["list", "grid"], prevUri);
    };

    self.featuredPlaylistsList = function (type, prevUri) {
        return navigationItemList('qobuz/' + type + '/playlists/', featuredPlaylists.bind(self, type), ["list", "grid"], prevUri);
    };

    self.purchasesList = function (type) {
        return navigationItemList('qobuz/purchases/' + type, purchases.bind(self, type), ["list", "grid"], 'qobuz/purchases');
    };

    self.artistAlbumsList = function (artistId, type, prevUri) {
        return navigationItemList('qobuz/artist/' + artistId, artistAlbums.bind(self, artistId, type), ["list", "grid"], prevUri);
    };

    self.search = function (query, type) {
        return search(query, type);
    };

    self.track = function (trackId, formatId) {
        return trackList('qobuz/track/' + trackId, track.bind(self, trackId, formatId));
    };

    self.trackUrl = function (trackId, formatId) {
        return trackUrl(trackId, formatId);
    };

    self.album = function (albumId, formatId) {
        return trackList('qobuz/album/' + albumId, album.bind(self, albumId, formatId));
    };

    self.playlist = function (playlistId, formatId) {
        return trackList('qobuz/playlist/' + playlistId, playlist.bind(self, playlistId, formatId));
    };

    var tryCache = function (cacheKey, apiCall) {
        logger.info('cache check');

        return libQ.resolve(memoryCache.wrap(cacheKey, function () {
            logger.info(cacheKey + ': not in cache');
            return apiCall();
        }))
            .then(function (items) {
                logger.info(cacheKey + ': finished with cache');
                return items;
            })
            .fail(function (e) {
                logger.info(cacheKey + ': fail cache error');
                return libQ.reject(new Error());
            });
    };

    var navigationItemList = function (cacheKey, dataGetter, navigationViews, prevUri) {
        return tryCache(cacheKey, dataGetter)
            .then(function (navigationItems) {
                return navigation.browse(navigationViews, navigationItems, prevUri);
            });
    };

    var trackList = function (cacheKey, dataGetter) {
        return tryCache(cacheKey, dataGetter);
    };

    var favouriteAlbums = function () {
        return api.getFavourites("albums")
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/favourites/album/"));
    };

    var favouriteTracks = function () {
        return api.getFavourites("tracks")
            .then(qobuzTracksToNavItems);
    };

    var favouriteArtists = function () {
        return api.getFavourites("artists")
            .then(qobuzArtistsToNavItems.bind(self, "qobuz/favourites/artist/"));
    };

    var userPlaylists = function () {
        return api.getUserPlaylists()
            .then(qobuzPlaylistsToNavItems.bind(self, "qobuz/favourites/playlist/"));
    };

    var albumTracks = function (albumId) {
        return api.getAlbum(albumId)
            .then(qobuzAlbumTracksToNavItems);
    };

    var playlistTracks = function (playlistId) {
        return api.getPlaylist(playlistId)
            .then(qobuzTracksToNavItems);
    };

    var featuredAlbums = function (type) {
        return api.getFeaturedAlbums(type)
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/" + type + "/album/"));
    };

    var featuredPlaylists = function (type) {
        return api.getFeaturedPlaylists(type)
            .then(qobuzPlaylistsToNavItems.bind(self, "qobuz/" + type + "/playlist/"));
    };

    var purchases = function (type) {
        return api.getPurchases()
            .then(function (result) {
                return type === "albums" ? qobuzAlbumsToNavItems("qobuz/purchases/album/", result) : qobuzTracksToNavItems(result);
            });
    };

    var artistAlbums = function (artistId, type) {
        return api.getArtist(artistId)
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/" + type + "/artist/" + artistId + "/album/"));
    };

    var search = function (query, type) {
        return api.search(query, type)
            .then(function (result) {
                return [
                    navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems("qobuz/album/", result), "title", "Qobuz Albums"),
                    navigation.searchResults(["list"], qobuzTracksToNavItems(result), "title", "Qobuz Tracks"),
                    navigation.searchResults(["list", "grid"], qobuzPlaylistsToNavItems("qobuz/playlist/", result), "title", "Qobuz Playlists")
                ];
            });
    };

    var qobuzAlbumsToNavItems = function (uriRoot, qobuzResult) {
        if (!qobuzResult || !qobuzResult.albums || !qobuzResult.albums.items)
            return [];

        return qobuzResult.albums.items.map(function (qobuzAlbum) {
            var title = qobuzAlbum.title + ' (' + new Date(qobuzAlbum.released_at * 1000).getFullYear() + ')';
            return navigation.item('folder', title, qobuzAlbum.artist.name, "", qobuzAlbum.image.small, "", uriRoot + qobuzAlbum.id);
        });
    };

    var qobuzPlaylistsToNavItems = function (uriRoot, qobuzResult) {
        if (!qobuzResult || !qobuzResult.playlists || !qobuzResult.playlists.items)
            return [];

        return qobuzResult.playlists.items.map(function (qobuzPlaylist) {
            return navigation.item("folder", qobuzPlaylist.name, qobuzPlaylist.owner.name, qobuzPlaylist.description, qobuzPlaylist.images[0], "", uriRoot + qobuzPlaylist.id);
        });
    };

    var qobuzTracksToNavItems = function (qobuzResult) {
        if (!qobuzResult || !qobuzResult.tracks || !qobuzResult.tracks.items)
            return [];

        return qobuzResult.tracks.items.map(function (qobuzTrack) {
            return navigation.item('song', qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, qobuzTrack.album.image.small, "", "qobuz/track/" + qobuzTrack.id);
        });
    };

    var qobuzAlbumTracksToNavItems = function (qobuzAlbum) {
        if (!qobuzAlbum || !qobuzAlbum.tracks || !qobuzAlbum.tracks.items)
            return [];

        return qobuzAlbum.tracks.items.map(function (qobuzTrack) {
            return navigation.item('song', qobuzTrack.title, qobuzAlbum.artist.name, qobuzAlbum.title, qobuzAlbum.image.small, "", "qobuz/track/" + qobuzTrack.id);
        });
    };

    var qobuzArtistsToNavItems = function (uriRoot, qobuzResult) {
        if (!qobuzResult || !qobuzResult.artists || !qobuzResult.artists.items)
            return [];

        return qobuzResult.artists.items.map(function (qobuzArtist) {
            return navigation.item("folder", qobuzArtist.name, qobuzArtist.name, "", qobuzArtist.picture || "", "", uriRoot + qobuzArtist.id);
        });
    };

    var qobuzResultToTrack = function (qobuzTrack, qobuzTrackUrl, qobuzAlbum) {
        return {
            service: 'qobuz',
            type: 'track',
            name: qobuzTrack.title,
            title: qobuzTrack.title + '?',
            artist: qobuzAlbum.artist.name,
            album: qobuzAlbum.title,
            duration: qobuzTrack.duration,
            albumart: qobuzAlbum.image.small,
            uri: 'qobuz/track/' + qobuzTrack.id,
            samplerate: '',
            bitdepth: '',
            trackType: ''
            //uri: qobuzTrackUrl.url,
            //samplerate: qobuzTrackUrl.sampling_rate,
            //bitdepth: qobuzTrackUrl.bit_depth + ' bit',
            //trackType: qobuzTrackUrl.mime_type.split('/')[1]
        };
    };

    var track = function (trackId, formatId) {
        return api.getTrack(trackId)
            // libQ.all(
            // [
            //     api.getTrack(trackId),
            //     api.getTrackUrl(trackId, formatId)
            // ])
            .then(function (results) {
                return qobuzResultToTrack(results, {}, results.album);
                //return qobuzResultToTrack(results[0], results[1], results[0].album);
            })
            .fail(function (e) {
                libQ.reject(new Error());
            });
    };

    var trackUrl = function (trackId, formatId) {
        return api.getTrackUrl(trackId, formatId)
            .then(function (results) {
                return {
                    uri: results.url,
                    bitdepth: results.bit_depth + " bit",
                    samplerate: results.sampling_rate,
                    trackType: results.mime_type.split('/')[1]
                };
            })
            .fail(function (e) {
                libQ.reject(new Error());
            });
    };

    // var album = function (albumId, formatId) {
    //     return api.getAlbum(albumId)
    //         .then(function (result) {
    //             return libQ.all(
    //                 result.tracks.items.map(function (qobuzTrack) {
    //                     return api.getTrackUrl(qobuzTrack.id, formatId);
    //                 }))
    //                 .then(function (urlResults) {
    //                     return result.tracks.items.map(function (qobuzTrack, i) {
    //                         return qobuzResultToTrack(qobuzTrack, urlResults[i], result);
    //                     });
    //                 });
    //         })
    //         .fail(function (e) {
    //             libQ.reject(new Error());
    //         });
    // };

    var album = function (albumId, formatId) {
        return api.getAlbum(albumId)
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return qobuzResultToTrack(qobuzTrack, {}, result);
                });
            })
            .fail(function (e) {
                libQ.reject(new Error());
            });
    };


    var playlist = function (playlistId, formatId) {
        return api.getPlaylist(playlistId)
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return qobuzResultToTrack(qobuzTrack, {}, qobuzTrack.album);
                });
            })
            .fail(function (e) { libQ.reject(new Error()); });
    };
}

QobuzService.login = function (logger, appId, username, password) {
    if (!username || username.length === 0 || !password || password.length === 0)
        return libQ.reject(new Error());

    return qobuzApi
        .login(logger, appId, username, password)
        .then(function (result) {
            if (result.user_auth_token && result.user_auth_token.length > 0) {
                return result.user_auth_token;
            }
            else {
                libQ.reject(new Error());
            }
        })
        .fail(function (e) { libQ.reject(new Error()); });
};