#!/bin/sh
set -e
node ./node_modules/typeorm/cli.js migration:run -d dist/config/data-source.js
node dist/database/run-admin-seed.js
exec node dist/main.js
