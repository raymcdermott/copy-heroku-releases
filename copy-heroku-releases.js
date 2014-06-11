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

var debug = process.env.DEPLOY_DEBUG; // if this is set to "true" we will emit debug messages

var sourceApp = process.env.DEPLOY_SOURCE_APPLICATION;
var targetOrganisation = process.env.DEPLOY_TARGET_ORGANISATION;
var targetAppFilter = process.env.DEPLOY_TARGET_APP_FILTER;
var heroku = new herokuClient({ token: process.env.DEPLOY_HEROKU_API_TOKEN });

if (debug === 'true') {
    console.log('DEBUG env-var DEPLOY_SOURCE_APPLICATION: ' + sourceApp);
    console.log('DEBUG env-var DEPLOY_TARGET_ORGANISATION: ' + targetOrganisation);
    console.log('DEBUG env-var DEPLOY_TARGET_APP_FILTER: ' + targetAppFilter);
}

// Use promises (from https://github.com/kriskowal/q - which comes along with heroku-client) to minimize callbacks

checkAcount();

findSlug().then(function (slug) {
    getTargetApps(targetOrganisation, targetAppFilter).then(function (targetApps) {
        deploySlug(slug, targetApps);
    });
}).catch(function (error) {
    console.log(error);
    return -1;
});

function checkAcount() {
    heroku.get('/account').then(function (user) {
        console.log("We are deploying with account: " + JSON.stringify(user));
    });
}
function findSlug() {

    var getUrl = '/apps/' + sourceApp + '/releases/';

    if (debug === 'true') {
        console.log('DEBUG in findSlug(), begin calling heroku: with ' + getUrl);
    }

    return heroku.get(getUrl).then(function (releases) {
        if (debug === 'true') {
            console.log('DEBUG in findSlug(), We have data from heroku: ' + JSON.stringify(releases));
        }
        var release = findReleaseToDeploy(releases);

        if (!release || !release.slug) {
            throw new Error("Cannot find a valid slug ID in release " + JSON.stringify(release));
        }

        var slug = release.slug.id;

        console.log("Source app: " + sourceApp + " source version: " + release.version +
            " (\'" + release.description + "\') source slug: " + slug);

        return slug;
    });
}

function findReleaseToDeploy(releases) {
    if (debug === 'true') {
        console.log('DEBUG in findReleaseToDeploy(), selecting release from list: ' + JSON.stringify(releases));
    }

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

    if (debug === 'true') {
        console.log('DEBUG in findReleaseToDeploy(), selected release: ' + JSON.stringify(release));
    }

    return release;
}

function getTargetApps(organisation, filter) {
    if (debug === 'true') {
        console.log('DEBUG in getTargetApps(), selecting target apps for organisation: ' + organisation + ' using filter: ' + filter);
    }

    var getUrl = '/organizations/' + organisation + '/apps';

    return heroku.get(getUrl).then(function (apps) {

        if (debug === 'true') {
            console.log('DEBUG in getTargetApps(), found the list of apps for organisation: ' + organisation + ' list: ' + apps);
        }

        if (filter) {
            apps = filterTargetApps(apps, filter.split(" "));
        }

        if (debug === 'true') {
            console.log('DEBUG in getTargetApps(), filtered the list of apps for organisation: ' + organisation + ' filtered list: ' + apps);
        }

        return apps;
    });

}


function deploySlug(slug, targetApps) {
    if (debug === 'true') {
        console.log('DEBUG in deploySlug(), preparing to deploy slug: ' + slug + ' to list: ' + targetApps);
    }

    if (targetApps.length === 0) {
        console.log('FAIL no matching targets');
        return -1;
    }

    targetApps.forEach(function (app) {
        performDeploy(slug, app);
    });
}

function performDeploy(slug, app) {
    var rehearsal = process.env.DEPLOY_REHEARSAL;

    if (rehearsal === 'true') {
        console.log("** Rehearsal mode ** ... would deploy slug " + slug + " to " + app.name);
        return 0;
    }

    var postUrl = '/apps/' + app.name + '/releases/';

    if (debug === 'true') {
        console.log('DEBUG in performDeploy(), posting to: ' + postUrl);
    }

    heroku.post(postUrl, { 'slug': slug }).then(function (newRelease) {
        console.log("User " + newRelease.user.email + " deployed slug " +
            newRelease.slug.id + " to app " + app.name + " [created new app version " +
            newRelease.version + " (\'" + newRelease.description + "\')]");

        if (debug === 'true') {
            console.log('DEBUG in performDeploy(), full release data: ' + JSON.stringify(newRelease));
        }
    });
}

// Filter the list of applications using the array of regular expressions
function filterTargetApps(appList, regexFilter) {
    if (debug === 'true') {
        console.log('DEBUG in filterTargetApps(), filtering list: ' + appList + ' with regex: ' + regexFilter);
    }

    if (!regexFilter) {
        console.log('DEBUG in filterTargetApps(), nothing to filter. Returning unfiltered list');
        return appList;
    }

    var targetApps = lazy(appList).filter(function (app) {

        var matches = lazy(regexFilter).filter(function (regex) {
            if (app.name.match(regex)) {
                return true;
            }

            return false;
        }).toArray();

        return (matches.length > 0);

    }).toArray();

    return targetApps;
}