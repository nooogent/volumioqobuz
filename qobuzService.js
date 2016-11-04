var libQ = require('kew');
var qobuzApi = require('./qobuzApi');
var cachemanager = require('cache-manager');
var defaultTtl = 60;//minutes
var defaultCachePruneInterval = 60;//minutes
var defaultSearchTtl = 5;//minutes
var navigation = require('./navigation')();

module.exports = QobuzService;

function QobuzService(logger, apiArgs, cacheArgs) {
    var self = this;

    var api = new qobuzApi(logger, apiArgs);
    var memoryCache = initialiseCache();

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
        return navigationItemList('qobuz/favourites/albums', favouriteAlbums, ["list", "grid"], "qobuz", cacheArgs.favourites);
    };

    self.favouriteTracksList = function () {
        return navigationItemList('qobuz/favourites/tracks', favouriteTracks, ["list"], "qobuz", cacheArgs.favourites);
    };

    self.favouriteArtistsList = function () {
        return navigationItemList('qobuz/favourites/artists', favouriteArtists, ["list", "grid"], "qobuz", cacheArgs.favourites);
    };

    self.userPlaylistsList = function () {
        return navigationItemList('qobuz/favourites/playlists', userPlaylists, ["list", "grid"], "qobuz", cacheArgs.favourites);
    };

    self.albumTracksList = function (albumId, prevUri) {
        return navigationItemList('qobuz/albumTracks/' + albumId, albumTracks.bind(self, albumId), ["list"], prevUri, cacheArgs.items);
    };

    self.playlistTracksList = function (playlistId, prevUri) {
        return navigationItemList('qobuz/playlistTracks/' + playlistId, playlistTracks.bind(self, playlistId), ["list"], prevUri, cacheArgs.items);
    };

    self.featuredAlbumsList = function (type, prevUri) {
        return navigationItemList('qobuz/' + (genreId ? genreId + '/' : '') + type + '/albums/', featuredAlbums.bind(self, type, genreId), ["list", "grid"], prevUri, cacheArgs.editorial);
    };

    self.featuredPlaylistsList = function (type, prevUri) {
        return navigationItemList('qobuz/' + type + '/playlists/', featuredPlaylists.bind(self, type), ["list", "grid"], prevUri, cacheArgs.editorial);
    };

    self.purchasesList = function (type) {
        return navigationItemList('qobuz/purchases/' + type, purchases.bind(self, type), ["list", "grid"], 'qobuz/purchases', cacheArgs.favourites);
    };

    self.artistAlbumsList = function (artistId, type, prevUri) {
        return navigationItemList('qobuz/artist/' + artistId, artistAlbums.bind(self, artistId, type), ["list", "grid"], prevUri, cacheArgs.items);
    };

    self.genres = function (genreId, prevUri) {
        return tryCache('qobuz/genre' + (genreId ? '/' + genreId : ''), genres.bind(self, genreId), cacheArgs.editorial)
            .then(function (genreResults) {
                var lists = [genreResults.genres];
                if (genreId) {
                    lists.push([navigation.navigationFolder("New Releases", "qobuz/genre/" + genreId + "/new" + "/items")]);
                }
                return { navigation: { lists: lists, prev: { uri: prevUri + (genreResults.parentId ? "/" + genreResults.parentId : "") } } };
            });
    };

    self.genreItemList = function (genreId, type, prevUri) {
        return tryCache('qobuz/genre/' + genreId + "/" + type + "/items", genreItems.bind(self, genreId, type), cacheArgs.editorial)
            .then(function (results) {
                return { navigation: { lists: results, prev: { uri: prevUri + "/" + genreId } } };
            });
    };

    self.search = function (query, type) {
        return tryCache('qobuz/search/' + encodeURIComponent(query), search.bind(self, query, type), defaultSearchTtl);
    };

    self.track = function (trackId, formatId) {
        return trackList('qobuz/track/' + trackId, track.bind(self, trackId, formatId));
    };

    self.trackUrl = function (trackId, formatId) {
        //this should never be cached...
        return trackUrl(trackId, formatId);
    };

    self.album = function (albumId, formatId) {
        return trackList('qobuz/album/' + albumId, album.bind(self, albumId, formatId));
    };

    self.playlist = function (playlistId, formatId) {
        return trackList('qobuz/playlist/' + playlistId, playlist.bind(self, playlistId, formatId));
    };

    self.clearCache = function () {
        return memoryCache ? libQ.resolve(memoryCache.reset()) : libQ.resolve();
    };

    function initialiseCache() {
        var cache = cachemanager.caching({ store: 'memory', max: 100, ttl: defaultTtl });

        //schedule a forced remove of expired cache entries
        setInterval(function () {
            if (cache) {
                logger.info('[' + Date.now() + '] ' + 'QobuzService::pruning cache');
                cache.keys()
                    .then(function (keys) {
                        libQ.all(keys.map(function (key) {
                            return cache.get(key);
                        }));
                    });
            }
        }, 1000 * 60 * defaultCachePruneInterval);

        return cache;
    }

    var tryCache = function (cacheKey, apiCall, ttl) {
        logger.info('cache check');

        ttl = (ttl || defaultTtl) * 60; //seconds

        return libQ.resolve(memoryCache.wrap(cacheKey, function () {
            logger.info(cacheKey + ': not in cache');
            return apiCall();
        }, { ttl: ttl }))
            .then(function (items) {
                logger.info(cacheKey + ': finished with cache');
                return items;
            })
            .fail(function (e) {
                logger.info(cacheKey + ': fail cache error');
                return libQ.reject(new Error());
            });
    };

    var navigationItemList = function (cacheKey, dataGetter, navigationViews, prevUri, ttl) {
        return tryCache(cacheKey, dataGetter, ttl)
            .then(function (navigationItems) {
                return navigation.browse(navigationViews, navigationItems, prevUri);
            });
    };

    var trackList = function (cacheKey, dataGetter) {
        return tryCache(cacheKey, dataGetter, cacheArgs.items);
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

    var featuredAlbums = function (type, genreId) {
        return api.getFeaturedAlbums(type, genreId)
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
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/" + (type && type.length > 0 ? type + "/" : "") + "artist/" + artistId + "/album/"));
    };

    var genres = function (genreId) {
        return api.getGenres(genreId)
            .then(function (result) {
                var genreResults = { genres: navigation.searchResults(["list"], qobuzGenresToNavItems(result), "title", "Genres") };
                if (result && result.parent) {
                    if (result.parent.path.length > 1) {
                        genreResults.parentId = result.parent.path[1];
                    }
                }
                return genreResults;
                //navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems("qobuz/genre/" + type + "/" + (genreId ? genreId + "/" : "") + "album/", results[1]), "title", "Albums"),
                //navigation.searchResults(["list", "grid"], qobuzPlaylistsToNavItems("qobuz/genre/" + (genreId ? genreId + "/" : "") + "playlist/", results[2]), "title", "Playlists")
            });
    };

    var genreItems = function (genreId, type) {
        return libQ.all([
            api.getFeaturedAlbums(type, genreId),
            api.getFeaturedPlaylists("editor", genreId),
            api.getFeaturedPlaylists("public", genreId)
                ])
            .then(function (results) {
                return [
                    navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems("qobuz/genre/" + genreId + "/" + type + "/album/", results[0]), "title", "Albums"),
                    navigation.searchResults(
                        ["list", "grid"],
                        qobuzPlaylistsToNavItems("qobuz/genre/" + genreId + "/editor/playlist/", results[1])
                            .concat(qobuzPlaylistsToNavItems("qobuz/genre/" + genreId + "/public/playlist/", results[2])),
                        "title",
                        "Playlists")
                ];
            });
    };

    var search = function (query, type) {
        return api.search(query, type)
            .then(function (result) {
                return [
                    navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems("qobuz/search/" + encodeURIComponent(query) + "/album/", result), "title", "Qobuz Albums"),
                    navigation.searchResults(["list", "grid"], qobuzArtistsToNavItems("qobuz/search/" + encodeURIComponent(query) + "/artist/", result), "title", "Qobuz Artists"),
                    navigation.searchResults(["list"], qobuzTracksToNavItems(result), "title", "Qobuz Tracks"),
                    navigation.searchResults(["list", "grid"], qobuzPlaylistsToNavItems("qobuz/search/" + encodeURIComponent(query) + "/playlist/", result), "title", "Qobuz Playlists")
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

    var qobuzGenresToNavItems = function (qobuzResult) {
        if (!qobuzResult || !qobuzResult.genres || !qobuzResult.genres.items)
            return [];

        return qobuzResult.genres.items.map(function (qobuzGenre) {
            return navigation.item("folder", qobuzGenre.name, "", "", "", "", "qobuz/genre/" + qobuzGenre.id);
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
            return navigation.item("folder", qobuzArtist.name, qobuzArtist.name, "", qobuzArtist.picture || "", "fa fa-user", uriRoot + qobuzArtist.id);
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