
        cmd = '../../../deps/autogrid/autogrid4 -p receptor.gpf -l output.glg';
        await exec(cmd);

        newTim = new Date().getTime();;
        timAutoGrid += newTim - tim;
        tim = newTim;

        if(ONLY_CPU) {
            cmd = '../../../deps/autodock/autodock4 -p ligand_receptor.dpf -l output.dlg';
            await exec(cmd);
        } else {
            cmd = '../../../deps/AutoDock-GPU/bin/autodock_gpu_128wi --lfile ligand.pdbqt --ffile receptor.maps.fld -N output'
            await exec(cmd);
        }

        newTim = new Date().getTime();;
        timAutoDock += newTim - tim;
        tim = newTim;


       
        

    async runMD(workFile, cont, cb) {
        const runPrefix = 's' + (++this.confStep) + '_runMD_' + workFile;

        let array = ['grompp',
            '-f', path.join(PARAMS_DIR, workFile + '.mdp'),
            '-c', this.groFile,
            '-r', this.groFile,
            '-p', 'topol.top',
            '-po', runPrefix + '.mdp',
            '-o', runPrefix + '.tpr'];
        if(cont)
            array.push('-t', this.checkpointFile);
        await this.callGMX(array);

        let start = new Date().getTime(), lastStep, lastStepTime = new Date().getTime();
        await new Promise((resolve, reject) => {
            let subProcess = child_process.spawn(GMX_BIN, ['mdrun',
                '-deffnm', runPrefix]);
    
            let update1 = async () => {
                if(!subProcess)
                    return;
                let waitMS = new Date().getTime() - lastStepTime;
                if(waitMS > 60 * 1000) {
                    try {
                        subProcess.kill('SIGKILL');
                    } catch(e) {}
                    return;
                }

                let tim;
    
                try {
                    let fd = await fs.promises.open(path.join(this.workingDir, 's' + this.confStep + '_runMD_' + workFile + '.log'), 'r');
                    let size = (await fd.stat()).size;
    
                    let buf = Buffer.alloc(size > 1024 ? 1024 : size);
                    if((await fd.read(buf, 0, buf.length, size - buf.length)).bytesRead == buf.length) {
                        let data = buf.toString().split('\n');
                        for(let i = data.length - 2; i >= 0; i--) {
                            if(data[i] == '           Step           Time') {
                                let step = data[i + 1].substr(0, 18).trim();
                                if(lastStep !== step) {
                                    lastStep = step;
                                    lastStepTime = new Date().getTime();
                                }
                                tim = parseFloat(data[i + 1].substr(18).trim());
                                break;
                            }
                        }
                    }
    
                    await fd.close();
                } catch(e) {}
    
                if(tim && cb) {
                    cb({
                        sim_time: tim,
                        run_time: Math.round((new Date().getTime() - start) * 0.001)
                    });
                }
                setTimeout(update1, 1000);
            }
            update1();

            subProcess.stdout.on('data', (d) => {
                process.stdout.write(d);
            });
            subProcess.stderr.on('data', (d) => {
                process.stdout.write(d);
            });

            subProcess.on('error', reject);
            subProcess.on('close', (code) => {
                subProcess = null;
                if(code == 0)
                    resolve();
                else
                    reject('code ' + code + ' on gmx mdrun');
            });
        });

        this.groFile = runPrefix + '.gro';
        this.checkpointFile = runPrefix + '.cpt';
    }