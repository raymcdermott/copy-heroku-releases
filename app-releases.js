/**
 * Created by ray on 14/05/14.
 */

function releaseDocument(application) {

    var releaseHistory = {
        app: {
            name: application && application.name || '',
            description: application && application.description || '',
            version: application && application.version || '',
            buildScript: '',
            requires: {}
        },
        releases: [],
        environment: {}
    };

    var require = { // semantics for required key / value pairs
        'app-name': '',
        'minimum-version': ''
    };

    var release = {
        id: '',
//        tagURL: '',
//        commitHash: '',
//        commitComment: '',
//        bambooURL: '',
        herokuReleaseData: {},
        deploys: []
    };

    var deploy = {
        version: '',
        targets: []
    };

    var target = {
        appId: '',
        env: '',
        deploymentStatus: ''
    };

    return {
        // Root type
        releaseHistory: function () {
            return releaseHistory;
        },
        // Minor types that get pushed into lists
        require: function () {
            return require;
        },
        deploy: function () {
            return deploy;
        },
        target: function () {
            return target;
        },
        release: function () {
            return release;
        }
    };
};

exports.releaseDocument = releaseDocument;
