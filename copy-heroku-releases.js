#! /usr/bin/env node

'use strict';

/*
 * copy-heroku-releases.js.js
 * https://github.com/raymcdermott/copy-heroku-releases.js.js
 *
 * Copyright (c) 2014 Ray McDermott
 * Licensed under the MIT license.
 */

// Assert pre-requisites
var assert = require('assert');
assert(process.env.HEROKU_API_TOKEN, "You must have HEROKU_API_TOKEN set in your environment");
assert(process.env.TARGET_APPS, "You must have TARGET_APPS set in your environment");

// Functional requires
var lazy = require('lazy.js');
var Heroku = require('heroku-client'),
    heroku = new Heroku({ token: process.env.HEROKU_API_TOKEN });

// Command line options
if (process.argv.length <= 2) {
    console.error("You must specify appname [optional-release-number]");
    return -1;
}

var app = process.argv[2];
var requestedRelease = parseInt(process.argv[3]);

// Do the work
function doCopy(appName, slugId) {
    heroku.post('/apps/' + appName + '/releases/', { 'slug': slugId }, function (err, responseBody) {
        assert.ifError(err, "Could not copy slug " + slugId + " to app " + appName);

        console.log("Copied slug " + slugId + " to app " + appName + " [created new app version " + responseBody.version + "]");
    });
}

// Copy the slug to each of the target apps

// TODO: Support a regex for the target apps
function copySlug(slugId) {
    var targetApps = process.env.TARGET_APPS.split(" ");

    for (var i = 0; i < targetApps.length; i++) {
        doCopy(targetApps[i], slugId);
    }
}

// fetch the slug ids and execute the copying
function processSlug(appName, requestedRelease) {
    heroku.get('/apps/' + appName + '/releases/', function (err, responseBody) {
        assert.ifError(err, "Could not get the releases from Heroku");

        var releaseElement = null;

        if (requestedRelease) {
            releaseElement = lazy(responseBody).find(function (release) {
                return release.version === requestedRelease;
            });

        } else {
            // By default use the latest release ... the JSON is not ordered
            releaseElement = lazy(responseBody).sortBy(function (release) {
                return release.version;
            }).last();
        }

        if (!releaseElement) {
            return "Cannot find a release";
        }

        if (!releaseElement.slug) {
            return "Cannot find a slug";
        }

        copySlug(releaseElement.slug.id);
    });
}

// Entry point
processSlug(app, requestedRelease);