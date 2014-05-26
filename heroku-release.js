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
var appRelease = require("./app-releases");
var argv = require('yargs').argv;

var debug = process.env.DEPLOY_DEBUG; // if this is set to "true" we will emit debug messages

// Mandatory environment variables
assert(process.env.DEPLOY_HEROKU_API_TOKEN, "You must set DEPLOY_HEROKU_API_TOKEN in your environment");
assert(process.env.MONGOLAB_URI, "You must set MONGOLAB_URI in your environment");

var heroku = new herokuClient({ token: process.env.DEPLOY_HEROKU_API_TOKEN });
var mongoClient = require('mongodb').MongoClient, format = require('util').format;

if (argv.release) {
    console.log('recording release');
    saveRelease();
} else if (argv.deploy) {
    console.log('running deploy');
    deployRelease(argv._);
} else if (argv.configure) {
    return console.log('running configure');
} else {
    return console.error('bad option');
}

function saveRelease() {
    var application = validateApp();
    findReleaseData(application, recordLastRelease);
}

function deployRelease(targetApps) {
    var application = validateApp(targetApps);
    findReleaseData(application, deploySlug);
}

// --clone-configuration [ --exclude env-var1, --exclude env-var2, ... ] target-app [ target-app2, ... ]
function cloneConfiguration(targetApp) {
    //TODO
}


function findDeclaredApplicationRequirements() {
    var fs = require('fs');

    var rj = 'require.json';

    var exists = fs.existsSync(function (exists) {
        return exists;
    });

    if (exists) {
        return JSON.parse(fs.readFileSync(rj).toString());
    }
}

function validateApp(targetApps) {

    // Only supports node apps ...
    var fs = require('fs');

    var pj = 'package.json';

    var appDefinition = JSON.parse(fs.readFileSync(pj).toString());

    if (!(appDefinition && appDefinition.name ))
        throw new Error('Cannot parse ' + pj + ' FAIL - release not supported');

    appDefinition.parameterTargetApps = targetApps;

    return appDefinition;
}


//recordLastRelease(sourceApp).then(function save(herokuRelease) {
//
//    var releaseHistory = appRelease.release(sourceApp).releaseHistory();
//
//    var release = appRelease.release(sourceApp).release();
//
//    release.herokuReleaseData = herokuRelease;
//
//    releaseHistory.releases.push(release);
//
//    storeReleaseData(releaseHistory);
//});

// Use promises (from https://github.com/kriskowal/q) to minimize callbacks

//findSlug().then(function (slug) {
//    deploySlug(slug, getTargetApps(targetOrganisation, targetAppFilter));
//});

// CRUD ops needed for the document
function fetchAppReleaseHistory(release) {
}
function updateAppReleaseHistory(release) {
}
function createAppReleaseHistory(release) {
}

function updateReleaseDocumentFromApplication(releaseDocument, application) {
    var requirements = findDeclaredApplicationRequirements();
    if (requirements) {
        releaseDocument.app.requires = requirements;
    }
    releaseDocument.app.version = application.version;
    releaseDocument.targets = application.parameterTargetApps.slice();

    return releaseDocument;
}

function findReleaseData(application, callback) {

    mongoClient.connect(process.env.MONGOLAB_URI, function (err, db) {
        if (err) {
            throw new Error('Problem accessing data in MongoDB: ' + process.env.MONGOLAB_URI + '. Error: ' + err);
        }

        var collection = db.collection('releases');

        collection.findOne({'app.name': application.name}, function (err, releaseData) {
            if (err) {
                throw new Error('Problem accessing data in for ' + application.name);
            }

            if (releaseData) {
                db.close();
                releaseData = updateReleaseDocumentFromApplication(releaseData, application);
                console.log('fromdb - data:' + JSON.stringify(releaseData));
                callback(releaseData);
            }
            else {
                var releaseDocument = appRelease.releaseDocument(application).releaseHistory();

                updateReleaseDocumentFromApplication(releaseDocument, application);

                collection.insert(releaseDocument, {w: 1}, function (err, releaseData) {
                    if (err) {
                        throw new Error('Problem inserting data ' + JSON.stringify(releaseDocument));
                    } else if (releaseData.length !== 1) {
                        console.warn(releaseData.length + ' results from insert - should be just 1. Check this: ' + JSON.stringify(releaseData));
                    }

                    db.close();

                    console.log('intodb - data:' + JSON.stringify(releaseData[0]));

                    callback(releaseData[0]);
                });
            }
        });
    });
}

function recordDeploy(releaseData) {
    var found = lazy(releaseData.releases.deploys).find(function (deploy) {
        return deploy.version === version;
    });

    if (!found) {
        // TODO record deploy stuff

        updateReleaseHistory(releaseData);
    } else {
        console.warn('WARNING - This release is a duplicate so it has not been recorded');
    }

}

function recordLastRelease(releaseData) {

    // TODO - is there a mock for the release API?
//    var herokuReleaseData = { 'id': '1' };

    var appUrl = '/apps/' + releaseData.app.name + '/releases/';

    console.info('Fetching release data from: ' + appUrl);

    heroku.get(appUrl).then(function (releases) {
        // Find the latest release ... the release list in the response is not ordered by version or date
        var herokuReleaseData = lazy(releases).sortBy(function (release) {
            return release.version;
        }).last();

        var found = lazy(releaseData.releases).find(function (release) {
            return release.herokuReleaseData.id === herokuReleaseData.id; // TODO fix the match once we have the real data from Heroku
        });

        if (!found) {
            var latestRelease = appRelease.releaseDocument().release();
            latestRelease.id = herokuReleaseData.id;
            latestRelease.herokuReleaseData = herokuReleaseData;

            releaseData.releases.push(latestRelease);

            updateReleaseHistory(releaseData);
        } else {
            console.warn('WARNING - This release is a duplicate so it has not been recorded');
        }
    }).catch(function (error) {
        console.error(JSON.stringify(error));
        return new Error(JSON.stringify(error));
    });
}

function updateReleaseHistory(releaseHistory) {
    mongoClient.connect(process.env.MONGOLAB_URI, function (err, db) {
        if (err) {
            throw new Error('Problem accessing data in MongoDB: ' + process.env.MONGOLAB_URI + '. Error: ' + err);
        }

        db.collection('releases').update({_id: releaseHistory._id }, releaseHistory, function (err, updateCount) {
            if (err) {
                throw new Error('Problem updating data: ' + JSON.stringify(releaseHistory));
            } else if (updateCount != 1) {
                console.warn('Update count of ' + updateCount + ' was not expected (should be exactly 1)')
            }
            db.close();
        });
    });
}

function findSlug(releases) {
    var release = findReleaseToDeploy(releases);

    if (!release || !release.slug) {
        throw new Error("Cannot find a valid slug ID in release " + JSON.stringify(release));
    }

    var slug = release.slug.id;

    console.log("Source app: " + sourceApp + " source version: " + release.version +
        " (\'" + release.description + "\') source slug: " + slug);

    return slug;
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

function deploySlug(releaseData) {
    if (debug === 'true') {
        console.log('DEBUG in deploySlug(), will deploy slug: ' + slug + ' to list: ' + targetApps);
    }

    if (releaseData.targets.length === 0) {
        console.log('FAIL no matching targets');
        return -1;
    }

    var slug = findSlug(releaseData.releases);

    releaseData.targets.forEach(function (app) {
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
            console.log('DEBUG in performDeploy(), full release data: ' + JSON.stringify(newRelease));
        }
    });
}



