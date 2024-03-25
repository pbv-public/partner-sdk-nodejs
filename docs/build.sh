#!/bin/bash
cd "`dirname \"$0\"`"

rm -rf generated
npx jsdoc --configure jsdoc.config.json `find ../src -name '*.js' -type f`

if [ "$GITHUB_SHA" = "" ]; then
    gitHash=`git rev-parse HEAD`
else
    gitHash=$GITHUB_SHA
fi
newLine="Generated from <a href=\"https:\\/\\/github.com\\/pb-vision\\/js-schema\\/tree\\/$gitHash\">$gitHash<\\/a><\\/article>"
cat ./generated/index.html | sed -e "s/[<][/]article[>]/$newLine/g" > tmp
mv tmp ./generated/index.html
