# RELEASE.sh
# Parameters: [ remoteName branchName ]

remote=origin
branch=master

[ $# -ne 0 ] && [ $# -ne 2 ] && echo "correct arguments are [ remote branch ]" && exit 1

if [ $# -eq 2 ]
then
	remote=$1
	branch=$2
fi

npm version patch -m "Automated release to version %s"

git push $remote --tags

# push the code to heroku to build it there and obtain a slug
git push heroku master

# code needed … use the Heroku release API to obtain the slug ID for the build you just made

# code needed … save the release data to MongoDB

# NB: The code doesn’t try too hard to handle all error cases - just reports and let the developer work it out


