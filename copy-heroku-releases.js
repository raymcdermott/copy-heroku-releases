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

console.log('DEBUG env-var DEPLOY_SOURCE_APPLICATION: ' + sourceApp);
console.log('DEBUG env-var DEPLOY_TARGET_ORGANISATION: ' + targetOrganisation);
console.log('DEBUG env-var DEPLOY_TARGET_APP_FILTER: ' + targetAppFilter);


// Use promises (from https://github.com/kriskowal/q - which comes along with heroku-client) to minimize callbacks

findSlug().then(function (slug) {
    if (debug === 'true') {
        console.log('DEBUG ready to deploy slug: ' + slug);
    }
    deploySlug(slug, getTargetApps(targetOrganisation, targetAppFilter));
});


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

    var targetApps = getAppsForOrganisation(organisation);

    if (debug === 'true') {
        console.log('DEBUG in getTargetApps(), found the list of apps for organisation: ' + organisation + ' list: ' + targetApps);
    }

    if (filter) {
        targetApps = filterTargetApps(targetApps, filter.split(" "));
    }

    if (debug === 'true') {
        console.log('DEBUG in getTargetApps(), filtered the list of apps for organisation: ' + organisation + ' filtered list: ' + targetApps);
    }

    return targetApps;
}


function deploySlug(slug, targetApps) {
    if (debug === 'true') {
        console.log('DEBUG in deploySlug(), will deploy slug: ' + slug + ' to list: ' + targetApps);
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
        console.log("** Rehearsal mode ** ... would deploy slug " + slug + " to " + app);
        return 0;
    }

    var postUrl = '/apps/' + app + '/releases/';

    if (debug === 'true') {
        console.log('DEBUG in performDeploy(), posting to: ' + postUrl);
    }

    heroku.post(postUrl, { 'slug': slug }).then(function (newRelease) {
        console.log("User " + newRelease.user.email + " deployed slug " +
            newRelease.slug.id + " to app " + app + " [created new app version " +
            newRelease.version + " (\'" + newRelease.description + "\')]");

        if (debug === 'true') {
            console.log('DEBUG in performDeploy(), full release data: ' + newRelease);
        }
    });
}

// Filter the list of applications using the array of regular expressions
function filterTargetApps(appList, regexFilter) {
    if (debug === 'true') {
        console.log('DEBUG in filterTargetApps(), filtering list: ' + appList + ' with regex: ' + regexFilter);
    }

    if (!regexFilter) {
        console.log('DEBUG in filterTargetApps(), nothing to do. Returning list: ' + appList);
        return appList;
    }

    var targetApps = lazy(appList).filter(function (name) {

        var matches = lazy(regexFilter).filter(function (regex) {
            if (debug === 'true') {
                console.log('DEBUG in filterTargetApps(), matching: ' + name + ' with regex: ' + regex);
            }

            if (name.match(regex)) {
                if (debug === 'true') {
                    console.log('DEBUG in filterTargetApps(), FOUND A MATCH between: ' + name + ' and regex: ' + regex);
                }
                return true;
            }

            return false;
        }).toArray();

        return (matches.length > 0);

    }).toArray();

    if (debug === 'true') {
        console.log('DEBUG in filterTargetApps(). Returning filtered list: ' + targetApps);
    }

    return targetApps;
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

    if (debug === 'true') {
        console.log('DEBUG in getAppsForOrganisation(). Reading file with list of apps for ' + appListFile);
    }

    fs.existsSync(appListFile, function (exists) {
        if (!exists) {
            throw new Error('FAIL: Cannot find list of apps for ' + organisation + ' in ' + appListFile + ' - have you ran the hacky script?');
        }
    });

    return fs.readFileSync(appListFile).toString().split("\n");
}


