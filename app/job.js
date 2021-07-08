'use strict';

const { app } = require('electron');

const https = require('https');
const fs = require('fs');
const path = require('path');
const stream = require('stream');
const child_process = require('child_process');
const url = require('url');
const util = require('util');

const unzipper = require('unzipper');
const archiver = require('archiver');

let logPath = path.join(app.getPath('userData'), 'log.json');
let workPath = path.join(app.getPath('userData'), 'work');

let server, ui;

let childProcess;
let origCWD = process.cwd();

const GMX_BIN = path.join(__dirname, '../engine/gromacs/bin/gmx');
const AUTOGRID4_BIN = path.join(__dirname, '../engine/autogrid4');
const AUTODOCK_GPU_BIN = path.join(__dirname, '../engine/autodock_gpu_128wi');

exports.init = async function init(_ui, _server) {
    ui = _ui;
    server = _server;

 //   try { await fs.promises.unlink(logPath); } catch(e) {}

    try {
        exports.log = JSON.parse(await fs.promises.readFile(logPath, 'utf8'));
        if(exports.log.length && !exports.log[exports.log.length - 1].end) {
            entry.end = new Date().toLocaleString();
            entry.result = 'program quit unexpectedly at earlier point in time';
            entry.result_success = false;
    
            await fs.promises.writeFile(logPath, JSON.stringify(exports.log, null, 2));
            ui.logChanged();
        }
    } catch(e) {
        exports.log = [];
    }

    try {
        await fs.promises.mkdir(workPath);
    } catch(e) {
        if(e.code != 'EEXIST')
            throw e;
    }
    let files = await fs.promises.readdir(workPath);
    for(let i = 0; i < files.length; i++) {
        if(files[i][0] != '.')
            try {
                await fs.promises.rmdir(path.join(workPath, files[i]), { recursive: true, force: true, maxRetries: 3 });
            } catch(e) {
                console.error('delete work directory: ', e);
            }
    }
}

exports.run = async function run(params) {
    if(exports.log.length && !exports.log[exports.log.length - 1].end)
        return undefined;

    exports.log.push({
        start: new Date().toLocaleString(),
        type: params.type,
        result: 'downloading task...',
        earned: 0,
        earnedFormatted: '0.00'
    });
    let id = exports.log.length;
    innerRun(params);
    await fs.promises.writeFile(logPath, JSON.stringify(exports.log, null, 2));

    ui.logChanged();
    return id;
}

function formatNo(no, sub_digits) {
    const CONTINENTAL = false;

    const sub = no < 0;
    if (sub)
      no = -no;

    let val;
    if (CONTINENTAL)
      val = ((no | 0) + '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    else
      val = ((no | 0) + '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
    if (sub_digits) {
      const subDigits = (no - (no | 0)).toFixed(sub_digits);
      if (subDigits == 1) {
        no = (no | 0) + 1;
        if (CONTINENTAL)
          val = ((no | 0) + '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
        else
          val = ((no | 0) + '').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,');
      }
      val += (CONTINENTAL ? ',' : '.') + subDigits.substr(2);
    }
    if (sub)
      val = '-' + val;

    return val;
  }

exports.result = function result(params) {
    let id = params.id | 0;
    if(id >= 1 && id <= exports.log.length) {
        if(params.result)
            exports.log[id - 1].result = params.result;
        if(params.result_success)
            exports.log[id - 1].result = params.result_success;
        if(params.earned) {
            exports.log[id - 1].earned = params.earned;
            exports.log[id - 1].earnedFormatted = formatNo(params.earned, 2);
        }
    }

    fs.promises.writeFile(logPath, JSON.stringify(exports.log, null, 2));
}

exports.abort = async function abort() {
    innerAbort();
}

exports.handleQuit = function handleQuit() {
    innerAbortQuit();

    if(exports.log.length && !exports.log[exports.log.length - 1].end) {
        let entry = exports.log[exports.log.length - 1];
        entry.end = new Date().toLocaleString();
        entry.result = 'program quit';
        entry.result_success = false;

        fs.writeFileSync(logPath, JSON.stringify(exports.log, null, 2));
    }
}

let doAbort;

async function innerRun(params) {
    doAbort = false;

	let workDir = path.join(workPath, new Date().getTime() + '');

	try {
        await fs.promises.rmdir(workDir, { recursive: true, force: true, maxRetries: 3 });
        await fs.promises.mkdir(workDir);

        await new Promise((resolve, reject) => {
			let req;
			let timeout = setTimeout(() => {
				try {
					req.destroy();
				} catch (e) { }
				reject(doAbort ? new Error('user abort') : new Error('timeout'));
			}, 30000);

			req = https.get(params.url_get, (res) => {
				if (res.statusCode != 200)
					return reject(new Error('not status code of 200'));

                let unzip = unzipper.Extract({ path: workDir });

                res.on('data', () => { if(doAbort) reject(new Error('user abort')); else timeout.refresh() });
                stream.pipeline(res, unzip, (err) => {
                    if (err) {
                        clearTimeout(timeout);
                        reject(err);
                    }
                });
                unzip.on('close', () => {
                    clearTimeout(timeout);
                    resolve();
                });
			});
			req.on('error', reject);
		});

        let cmds, subPath, subWorkDir = workDir;
        try {
            cmds = await fs.promises.readFile(path.join(workDir, 'commands.txt'), 'utf8');
            process.chdir(workDir);
        } catch(e) {0
            if(e.code == 'ENOENT') {
                let files = await fs.promises.readdir(workDir);
                let i;
                for(i = 0; i < files.length; i++) {
                    if(files[i][0] == '.')
                        continue;

                    try {
                        cmds = await fs.promises.readFile(path.join(workDir, files[i], 'commands.txt'), 'utf8');
                        subPath = files[i];

                        process.chdir(path.join(workDir, files[i]));
                        subWorkDir = path.join(workDir, files[i]);
                        break;
                    } catch(e) {}
                }
                if(i == files.length)
                    throw new Error('cannot find commands');
            }
        }

        if(doAbort) throw new Error('user abort');

        let entry = exports.log[exports.log.length - 1];
        entry.result = 'running simulation...';
        ui.logChanged();

        cmds = cmds.split('\n');
        for(let i = 0; i < cmds.length; i++) {
            if(doAbort) throw new Error('user abort');

            let cmd = cmds[i].trim();
            if(!cmd)
                continue;

            if(cmd.indexOf('..') >= 0)
                throw new Error('unsafe command');

            cmd = cmd.split(/\s+/);
            let exe = cmd.shift();

            function execFile(a, b) {
                return new Promise((resolve, reject) => {
                    childProcess = child_process.execFile(a, b, async (err, stdout, stderr) => {
                        childProcess = null;

                        if(stdout)
                            await fs.promises.writeFile(path.join(subWorkDir, 'command-' + i + '.stdout.txt'), stdout);
                        if(stderr)
                            await fs.promises.writeFile(path.join(subWorkDir, 'command-' + i + '.stderr.txt'), stderr);
                        if(err)
                            await fs.promises.writeFile(path.join(subWorkDir, 'command-' + i + '.err.txt'), err.message);

                        if(err)
                            reject(err);
                        else
                            resolve();
                    });
                })
            }

            if(exe == 'gmx')
                await execFile(GMX_BIN, cmd);
            if(exe == 'autogrid4')
                await execFile(AUTOGRID4_BIN, cmd);
            if(exe == 'autodock_gpu_128wi')
                await execFile(AUTODOCK_GPU_BIN, cmd);
        }

        if(doAbort) throw new Error('user abort');

        entry = exports.log[exports.log.length - 1];
        entry.result = 'uploading results...';
        ui.logChanged();

		await new Promise((resolve, reject) => {
			let options = url.parse(params.url_put);
			options.method = 'PUT';

			let req;
			let timeout = setTimeout(() => {
				try {
					req.destroy();
				} catch (e) { }
				reject(doAbort ? new Error('user abort') : new Error('timeout'));
			}, 30000);

			req = https.request(options, (res) => {
				if (res.statusCode != 200)
					return reject(new Error('not status code of 200 ' + res.statusCode));

				res.on('error', () => {
					clearTimeout(timeout);
					reject();
				});
				res.on('data', () => { });
				res.on('end', () => {
					clearTimeout(timeout);
					resolve();
				});
			});

			let archive = archiver('zip');
            archive.on('data', () => { if(doAbort) reject(new Error('user abort')); else timeout.refresh() });
			stream.pipeline(
				archive,
				req,
				(err) => {
					clearTimeout(timeout);
					if (err)
						reject(err);
					else
						resolve();
				}
			);
            if(subPath)
                archive.directory(path.join(workDir, subPath), subPath);
            else
                archive.directory(workDir, false);
			archive.finalize();
		});

        process.chdir(origCWD);
        await fs.promises.rmdir(workDir, { recursive: true, force: true, maxRetries: 3 });

        entry = exports.log[exports.log.length - 1];
        entry.end = new Date().toLocaleString();
        entry.result = 'finished successfully';
        entry.result_success = true;

        await fs.promises.writeFile(logPath, JSON.stringify(exports.log, null, 2));
        ui.logChanged();
	} catch (e) {
        if(e.killed  && doAbort)
            e = new Error('user abort');
        if(e.message != 'user abort')
            console.error(e);

        try {
            process.chdir(origCWD);
            await fs.promises.rmdir(workDir, { recursive: true, force: true, maxRetries: 3 });
        } catch(e) {}

        let entry = exports.log[exports.log.length - 1];
        entry.end = new Date().toLocaleString();
        entry.result = e.message == 'user abort' ? 'aborted by user' : 'Job failed. Please check that you have CUDA 11.2 installed, a CUDA compatible GPU (NVIDIA) and 10 GB of disk space available.';
        entry.result_success = false;
        server.emitAll('job_failed', {
            id: exports.log.length - 1,
            result: entry.result
        });

        await fs.promises.writeFile(logPath, JSON.stringify(exports.log, null, 2));
        ui.logChanged();
	}
}

async function innerAbort() {
    doAbort = true;
    try {
        if(childProcess)
            childProcess.kill('SIGTERM');
    } catch(e) {
        console.error(e);
    }
}

function innerAbortQuit() {
    try {
        doAbort = true;
        if(childProcess)
            childProcess.kill('SIGKILL');

        process.chdir(origCWD);
        fs.rmdirSync(workPath, { recursive: true, force: true, maxRetries: 3 });
    } catch(e) {
        console.error(e);
    }
}