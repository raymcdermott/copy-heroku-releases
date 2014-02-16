# copy-heroku-releases

A node command line utility to copy Heroku slugs from one app to one or more other apps

This is valuable when you want the same code in different Heroku apps to partition your system (for example by country)

For details of the Heroku platform API see

https://blog.heroku.com/archives/2013/12/20/programmatically_release_code_to_heroku_using_the_platform_api

## Getting Started

Install the command line utility with: `npm install -g copy-heroku-releases`

You must have an account on Heroku

## Documentation

This program will deploy a slug from one application to one or more others. You must own these apps.

The default is to copy the most recent (highest) release

The program accepts its parameters from the environment rather than the command line.

## Environment variables

Mandatory parameters

The source application name: DEPLOY_SOURCE_APPLICATION

The Heroku API key for your account: DEPLOY_HEROKU_API_TOKEN

The target organisation: DEPLOY_TARGET_ORGANISATION

The list of target apps: DEPLOY_TARGET_APP_FILTER

Note: the target apps can be a list of regular app names or a list of regexes or a mix of both

Optional parameters

You can run a rehearsal of the deployment by setting DEPLOY_REHEARSAL (any value). This will list the action that the program would take but prevents execution.

You can request an explicit release setting DEPLOY_RELEASE_NUMBER. This will use the specific release rather than the latest.

## Errors

Some releases don't have slugs and this is reported as an error

If the requested release number is not present this is reported as an error

## Examples

$ copy-heroku-releases

Deploying from test-deploy-app release 27 ('stable feature xxx v0.3.1') with slug 4bd9fcde-c6b0-499d-9029

Copied slug 4bd9fcde-c6b0-499d-9029 to app test-deploy-xyz [created new app version 36]

Copied slug 4bd9fcde-c6b0-499d-9029 to app test-deploy-xyz [created new app version 35]

## Contributing

In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
0.8.3 - hack to support deploying apps by organisation
0.8.2 - relies on the updated Heroku client now ... and I have more TODOs!
0.8.1 - realised that it wasn't fully functional ... proxy patch
0.8.0 - fully functional for me ... not 1.0.0 as I haven't socialised this enough yet :)

## License
Copyright (c) 2014 Ray McDermott  
Licensed under the MIT license.