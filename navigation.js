'use strict';

module.exports = Navigation;

function Navigation() {
    
    var nav = {
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

    var populate = function (views, items, prevUri) {
        nav.navigation.lists[0].availableListViews = views;
        nav.navigation.lists[0].items = items;
        nav.navigation.prev.uri = prevUri;
        return nav;
    };

    var item = function (type, title, artist, album, albumart, icon, uri) {
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

    var folder = function (title, artist, album, uri) {
        return item('folder', title, artist, album, '', 'fa fa-folder-open-o', uri);
    };

    var track = function (title, artist, album, uri) {
        return item('song', title, artist, album, '', 'fa fa-microphone', uri);
    };

    var navigationFolder = function (title, uri) {
        return folder(title, "", "", uri);
    };

    return {
        populate: populate,
        item: item,
        folder: folder,
        track: track,
        navigationFolder: navigationFolder
    };
};
