/*******************************************************************************
 * Copyright (c) 2019 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials
 * are made available under the terms of the Eclipse Public License v2.0
 * which accompanies this distribution, and is available at
 * http://www.eclipse.org/legal/epl-v20.html
 *
 * Contributors:
 *     IBM Corporation - initial API and implementation
 *******************************************************************************/

import fs from 'fs-extra';
import { exec } from 'child_process';
import request from 'request';

export function importProjectFromTar(tarFile: string, name: string, dest: string): Promise<void> {

    const fileName = `/app/${name}.tar.gz`;
    const file = fs.createWriteStream(fileName);

    return new Promise((resolve, reject) => {
    request(tarFile)
    .pipe(file)
    .on('finish', () => {
          exec(`tar -xvf ${fileName} -C ${dest}`, (err: any, stdout: any, stderr: any) => {
            try {
                fs.removeSync(fileName);
            }
            catch (err) {
                /* Logging error when removing temp dir fails */
                console.log(err);
            }
            if (err) {
                return reject(err);
            }
            resolve();
          });
    })
    .on('error', reject);
    });

}
