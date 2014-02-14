#!/usr/bin/env node

'use strict';

/*
 * copy-heroku-releases.js
 * https://github.com/raymcdermott/copy-heroku-releases.js
 *
 * Copyright (c) 2014 Ray McDermott
 * Licensed under the MIT license.
 */

var assert = require('assert');

// Command line options
assert((process.argv.length == 3 || process.argv.length == 4), "You must specify appname [optional-release-number]");

var app = process.argv[2];
var requestedRelease = parseInt(process.argv[3]);

// Mandatory environment variables
assert(process.env.HEROKU_API_TOKEN, "You must have HEROKU_API_TOKEN set in your environment");
assert(process.env.TARGET_APPS, "You must have TARGET_APPS set in your environment");


var Heroku = require('heroku-client'),
    heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });


processSlug(app, requestedRelease);


// fetch the slug ids and execute the copying
function processSlug(appName, requestedRelease) {
    heroku.get('/apps/' + appName + '/releases/', function (err, responseBody) {
        assert.ifError(err, "Could not get the releases from Heroku");

        var release = getRelease(responseBody, requestedRelease);

        var slug = (getSlug(release));

        copySlug(slug);
    });
}


function getRelease(releases, requestedRelease) {
    var lazy = require('lazy.js');

    if (requestedRelease) {
        return lazy(releases).find(function (release) {
            return release.version === requestedRelease;
        });
    } else {
        // By default use the latest release ... the response is not ordered
        return lazy(releases).sortBy(function (release) {
            return release.version;
        }).last();
    }
}


function getSlug(release) {
    if (!release || !release.slug) {
        throw new Error("Cannot find a valid slug ID in release " + JSON.stringify(release));
    }

    return release.slug.id;
}


function copySlug(slug) {
    var targetApps = process.env.TARGET_APPS.split(" ");

    for (var i = 0; i < targetApps.length; i++) {
        var appName = targetApps[i];

        heroku.post('/apps/' + appName + '/releases/', { 'slug': slug }, function (err, responseBody) {
            assert.ifError(err, "Could not copy slug " + slug + " to app " + appName);

            console.log("Copied slug " + slug + " to app " + appName + " [created new app version " + responseBody.version + "]");
        });
    }
}

// TODO: Support regex for target apps
// TODO: Support deploying against another organisation
function getAppsForOrganisation() {
// Not available yet
}


