#!/usr/bin/env node

'use strict';

// TODO: Write unit tests

/*
 * heroku-releases.js
 * https://github.com/raymcdermott/copy-heroku-releases.js
 *
 * Copyright (c) 2014 Ray McDermott
 * Licensed under the MIT license.
 */

var assert = require('assert');
var lazy = require('lazy.js');
var herokuClient = require('heroku-client');
var mongoClient = require('mongodb').MongoClient, format = require('util').format;

// Mandatory environment variables
assert(process.env.DEPLOY_HEROKU_API_TOKEN, "You must set DEPLOY_HEROKU_API_TOKEN in your environment");
assert(process.env.MONGOLAB_URI, "You must set MONGOLAB_URI in your environment");

var heroku = new herokuClient({ token: process.env.DEPLOY_HEROKU_API_TOKEN });

// Options:
// save-last-release ... save the latest release to the release database

// Process command line arguments
var argv = require('yargs').argv;

var sourceApp = argv._; // more to come, for now there should just be the app name

recordLastRelease(sourceApp);

// Use promises (from https://github.com/kriskowal/q) to minimize callbacks

//findSlug().then(function (slug) {
//    deploySlug(slug, getTargetApps(targetOrganisation, targetAppFilter));
//});

function storeReleaseData(application, release) {

    console.log("app" + application);
    console.log("release" + release);

    mongoClient.connect(process.env.MONGOLAB_URI, function (err, db) {
        if (err) throw err;

        var collection = db.collection('test_insert');
        collection.insert({a: 2}, function (err, docs) {

            collection.count(function (err, count) {
                console.log(format("count = %s", count));
            });

            // Locate all the entries using find
            collection.find().toArray(function (err, results) {
                console.dir(results);
                // Let's close the db
                db.close();
            });
        });
    })
}

function recordLastRelease(sourceApp) {
    heroku.get('/apps/' + sourceApp + '/releases/').then(function (releases) {

        console.log("releases " + releases);

        // Find the latest release ... the release list in the response is not ordered
        var release = releases[0];

        console.log("release " + JSON.stringify(release));

//        sortBy(function (release) {
//            return release.version;
//        }).last();

//        console.log("release " + release.slug.id);

//        if (!release || release.slug === null) {
//            throw new Error("Cannot find a valid slug ID in release " + JSON.stringify(release));
//        }

        console.log("release 2 " + release);

        storeReleaseData(sourceApp, release);
    });
}

function findSlug() {
    return heroku.get('/apps/' + sourceApp + '/releases/').then(function (releases) {
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

    if (filter) {
        targetApps = filterTargetApps(targetApps, filter.split(" "));
    }

    return targetApps;
}


function deploySlug(slug, targetApps) {
    targetApps.forEach(function (app) {
        performDeploy(slug, app);
    });
}

function performDeploy(slug, app) {
    if (process.env.DEPLOY_REHEARSAL) {
        console.log("** Rehearsal mode ** ... would deploy slug " + slug + " to " + app);
        return 0;
    }

    heroku.post('/apps/' + app + '/releases/', { 'slug': slug }).then(function (newRelease) {
        console.log("User " + newRelease.user.email + " deployed slug " +
            newRelease.slug.id + " to app " + app + " [created new app version " +
            newRelease.version + " (\'" + newRelease.description + "\')]");
    });
}

// Filter the list of applications using the array of regular expressions
function filterTargetApps(appList, regexFilter) {
    if (!regexFilter) {
        return appList;
    }

    return lazy(appList).filter(function (name) {

        for (var regex in regexFilter) {
            if (name.match(regexFilter[regex])) {
                return true;
            }
        }

        return false;

    }).toArray();
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


