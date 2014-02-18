#!/usr/bin/env node

'use strict';

// TODO: Write unit tests

/*
 * copy-heroku-releases.js
 * https://github.com/raymcdermott/copy-heroku-releases.js
 *
 * Copyright (c) 2014 Ray McDermott
 * Licensed under the MIT license.
 */

var assert = require('assert');
var lazy = require('lazy.js');
var herokuClient = require('heroku-client');


// Mandatory environment variables
assert(process.env.DEPLOY_HEROKU_API_TOKEN, "You must set DEPLOY_HEROKU_API_TOKEN in your environment");
assert(process.env.DEPLOY_SOURCE_APPLICATION, "You must set DEPLOY_SOURCE_APPLICATION in your environment");
assert(process.env.DEPLOY_TARGET_ORGANISATION, "You must set DEPLOY_TARGET_ORGANISATION in your environment");
assert(process.env.DEPLOY_TARGET_APP_FILTER, "You must set DEPLOY_TARGET_APP_FILTER in your environment");

var sourceApp = process.env.DEPLOY_SOURCE_APPLICATION;
var targetOrganisation = process.env.DEPLOY_TARGET_ORGANISATION;
var targetAppFilter = process.env.DEPLOY_TARGET_APP_FILTER;
var heroku = new herokuClient({ token: process.env.DEPLOY_HEROKU_API_TOKEN });


// Use promises (from https://github.com/kriskowal/q) to minimize callbacks

findSlug().then(function (slug) {
    deploySlug(slug, getTargetApps(targetOrganisation, targetAppFilter));
});


function findSlug() {
    return heroku.get('/apps/' + sourceApp + '/releases/').then(function (releases) {
        var release = findReleaseToDeploy(releases);

        if (!release || !release.slug) {
            throw new Error("Cannot find a valid slug ID in release " + JSON.stringify(release));
        }

        return release.slug.id;
    });
}

function findReleaseToDeploy(releases) {
    var release = null;
    if (process.env.DEPLOY_RELEASE_NUMBER) {
        release = lazy(releases).find(function (release) {
            return release.version === process.env.DEPLOY_RELEASE_NUMBER;
        });
    } else {
        // By default use the latest release ... the response is not ordered
        release = lazy(releases).sortBy(function (release) {
            return release.version;
        }).last();
    }
    return release;
}

function getTargetApps(organisation, filter) {
    var targetApps = getAppsForOrganisation(organisation);

    if (filter)
        targetApps = filterTargetApps(targetApps, filter.split(" "));

    return targetApps;
}


function deploySlug(slug, targetApps) {
    for (var app in targetApps)
        performDeploy(slug, targetApps[app]);
}

function performDeploy(slug, app) {
    if (process.env.DEPLOY_REHEARSAL) {
        console.log("** Rehearsal mode ** ... would deploy slug " + slug + " to " + app);
        return 0;
    }

    heroku.post('/apps/' + app + '/releases/', { 'slug': slug }).then(function (response) {
        console.log("Copied slug " + slug + " to app " + app + " [created new app version " + response.version + "]");
    });
}

// Filter the list of applications using the array of regular expressions
function filterTargetApps(appList, regexFilter) {
    if (!regexFilter)
        return appList;

    return lazy(appList).filter(function (name) {

        for (var regex in regexFilter) {
            if (name.match(regexFilter[regex])) return true;
        }

        return false;

    }).toArray(); // TODO: why is this needed ... returns list + lazy.js function names if not used :(
}

// BIG MESS ... until Heroku supports getting the apps by organisation in the API, we will hack it...
//
// $ heroku apps --org ${org} | egrep -v "^$|${org}$" | awk '{ print $1 }' > /tmp/heroku-app-list.${org}
//
// will give us a list of app names for the $org into the file
//
// I am making this a deliberately ugly hard coded hack!!
//
// TODO: Refactor once this is in the API
function getAppsForOrganisation(organisation) {
    var fs = require('fs');

    var appListFile = "/tmp/heroku-app-list." + organisation;

    return fs.readFileSync(appListFile).toString().split("\n");
}


