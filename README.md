# heroku-releases-slug-ids [![Build Status](https://secure.travis-ci.org/raymcdermott/heroku-releases-slug-ids.png?branch=master)](http://travis-ci.org/raymcdermott/heroku-releases-slug-ids)

A node command line utility to copy Heroku slugs from one app to one or more other apps

This is valuable when you want the same code in different Heroku apps to partition your system (for example by country)

FOr details of the Heroku platform API see

https://blog.heroku.com/archives/2013/12/20/programmatically_release_code_to_heroku_using_the_platform_api

## Getting Started
Install the command line utility with: `npm install -g heroku-releases-slug-ids`

You must have an account on Heroku

You must provide the Heroku API key for your account in the environment variable HEROKU_API_TOKEN

You must provide the list of target apps in the environment variable TARGET_APPS

## Documentation

This program is given the name of an application that you own on Heroku and [optionally] a release number

The default is to copy the most recent (highest) release

## Errors

Some releases don't have slugs and this is reported as an error

If the requested release number is not present this is reported as an error

## Examples

$ copy-heroku-releases test-deploy-app

Copied slug 6b938191-f5a3-4033-a916-xyz to app test-deploy-xyz [created new app version 10]

Copied slug 6b938191-f5a3-4033-a916-xyz to app test-deploy-def [created new app version 9]

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
0.3.0 - fully functional for me ... not 1.0.0 as I haven't socialised this enough yet :)

## License
Copyright (c) 2014 Ray McDermott  
Licensed under the MIT license.
