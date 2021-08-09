"use strict";

const server = require('./app/server.js');
const settings = require('./app/settings.js');
const job = require('./app/job.js');
const mine = require('./app/mine.js');

async function run() {
    await settings.init(false, server, mine);
    await job.init(false, server, mine);
    await server.init(null, job, mine);
}
run();
