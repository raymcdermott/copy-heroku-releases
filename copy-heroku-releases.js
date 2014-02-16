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


// Optional environment variables
var rehearsal = process.env.DEPLOY_REHEARSAL;
var requestedRelease = process.env.DEPLOY_RELEASE_NUMBER;

// Heroku set up requires authentication
var heroku = new herokuClient({ token: process.env.DEPLOY_HEROKU_API_TOKEN });


// Obtain the releases from Heroku to kick us off...

heroku.get('/apps/' + sourceApp + '/releases/', function (err, responseBody) {
    assert.ifError(err, "Could not get the releases from Heroku");

    deployRelease(sourceApp, responseBody, requestedRelease);
});


function deployRelease(sourceApp, releases, requestedRelease) {

    var release = findReleaseToDeploy(releases, requestedRelease);

    var slug = findSlug(release);

    console.log("Deploying from " + sourceApp + " release " + release.version + " (\'" + release.description + "\') with slug " + slug);

    var targetApps = getAppsForOrganisation(targetOrganisation);

    if (targetAppFilter) {
        targetAppFilter = targetAppFilter.split(" ");
        targetApps = filterTargetApps(targetApps, targetAppFilter);
    }

    if (rehearsal) {
        console.log("Rehearsal mode ... would deploy slug to the following apps in organisation " + targetOrganisation);
        for (var targetApp = 0; targetApp < targetApps.length; targetApp++) {
            console.log(targetApps[targetApp]);
        }
        return 0;
    }

    deploySlug(slug, targetApps);
}

function findReleaseToDeploy(releases, requestedRelease) {
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


function findSlug(release) {
    if (!release || !release.slug) {
        throw new Error("Cannot find a valid slug ID in release " + JSON.stringify(release));
    }

    return release.slug.id;
}


function deploySlug(slug, targetApps) {
    for (var i = 0; i < targetApps.length; i++) {
        var appName = targetApps[i];

        heroku.post('/apps/' + appName + '/releases/', { 'slug': slug }, function (err, responseBody) {
            assert.ifError(err, "Could not copy slug " + slug + " to app " + appName);

            console.log("Copied slug " + slug + " to app " + appName + " [created new app version " + responseBody.version + "]");
        });
    }
}

// Filter the list of applications using the array of regular expressions
function filterTargetApps(appList, regexFilter) {
    if (!regexFilter)
        return appList;

    return lazy(appList).filter(function (name) {

        for (var i = 0; i < regexFilter.length; i++) {
            if (name.match(regexFilter[i])) return true;
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


