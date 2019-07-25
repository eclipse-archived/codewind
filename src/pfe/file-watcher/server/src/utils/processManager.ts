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
"use strict";

/**
 * The process manager module should be used for any processes that need to be tracked either
 * to check the result of the process at some later point in time or to kill the processes as part of
 * container shutdown.
 */
import { spawn, ChildProcess, SpawnOptions } from "child_process";
import * as logger from "./logger";
import * as stackTrace from "stack-trace";

export interface ProcessResult { exitCode: number; stdout: string; stderr: string; }

interface ProcessObject {
    childprocess: ChildProcess;
    command: string;
}

const runningProcesses = new Map<string, ProcessObject[]>();

/**
 * @function
 * @description Spawn a detached process asynchronously.
 *
 * @param processKey <Required | String> - The process key.
 * @param command <Required | String> - The command to run.
 * @param args <Required | String[]> - The list of args to pass with the command.
 * @param spawnOptions <Required | SpawnOptions> - Additional options for spawning the process.
 *
 * @returns Promise<ProcessResult>
 */
export function spawnDetachedAsync(processKey: string, command: string, args: Array<string>, spawnOptions: SpawnOptions): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        spawnDetached(processKey, command, args, spawnOptions, (result) => {
            if (result.exitCode !== 0) {
                reject(result);
                return;
            }
            resolve(result);
        });
    });
}

/**
 * @function
 * @description Spawn a detached process.
 *
 * @param processKey <Required | String> - The process key.
 * @param command <Required | String> - The command to run.
 * @param args <Required | String[]> - The list of args to pass with the command.
 * @param spawnOptions <Required | SpawnOptions> - Additional options for spawning the process.
 * @param callback <Required | Function> - The callback function.
 *
 * @returns ChildProcess
 */
export function spawnDetached(processKey: string, command: string, args: Array<string>, spawnOptions: SpawnOptions, callback: (result: ProcessResult) => void): ChildProcess {
    const trace = stackTrace.get();
    const stackString = getRelevantStacktraceString(trace);

    // Spawn a detached process so that the process will be the leader of a new process group, this is useful for killing the process later
    spawnOptions.detached = true;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const proc = spawn(command, args, spawnOptions);
    const processObject: ProcessObject = {
        childprocess: proc,
        command: command
    };

    proc.on("error", (err) => {
        logger.logProjectError( + " | " + err.message, processKey);
    });

    proc.stdout.on("data", (data) => {
        stdoutBuffer += data.toString();
        logger.logProjectTrace(data.toString(), processKey);
    });

    proc.stderr.on("data", (data) => {
        stderrBuffer += data.toString();
        logger.logProjectError(stackString + " | " + data.toString(), processKey);
    });

    proc.on("exit", (code) => {
        if (code !== 0) {
            logger.logProjectError(stackString + " | " + "| The command " + command + " " + args + " failed with exit code " + code, processKey);
        }

        callback({ exitCode: code, stdout: stdoutBuffer, stderr: stderrBuffer });
        if (processKey && runningProcesses.get(processKey)) {
            // Once the process has finished remove it from the running processes list
            if (runningProcesses.get(processKey).indexOf(processObject) !== -1) {
                runningProcesses.get(processKey).splice(runningProcesses.get(processKey).indexOf(processObject), 1);
            }
        }
    });

    if (processKey) {
        if (runningProcesses.has(processKey)) {
            runningProcesses.get(processKey).push(processObject);
        } else {
            runningProcesses.set(processKey, [processObject]);
        }
    }

    return proc;
}

/**
 * @function
 * @description Kill running processes.
 *
 * @param processKey <Required | String> - The process key.
 * @param projectName <Required | String> - The project name.
 *
 * @returns void
 */
export function killRunningProcesses(processKey: string, projectName: string): void {
    // Check for running processes that belong to the process group
    if (runningProcesses.has(processKey)) {
        const processes = runningProcesses.get(processKey);
        for (let i = 0; i < processes.length; i++) {
            const pid = processes[i].childprocess.pid;
            logger.logProjectInfo("Found a running process with pid " + pid + " for project " + processKey, processKey);

            try {
                // kill the process group since commands can spawn child processes
                process.kill(pid * -1, "SIGTERM");
                logger.logProjectInfo("Killed the running processes for project " + processKey, processKey);
            } catch (err) {
                logger.logProjectError("Failed to kill the running processes for project " + processKey, processKey);
                logger.logProjectError(err, processKey);
            }
        }
        runningProcesses.delete(processKey);

        setTimeout(printRunningProcesses, 1000, projectName);

    }
}

/**
 * @function
 * @description Print out the running processes.
 *
 * @param projectName <Required | String> - The project name.
 *
 * @returns void
 */
export function printRunningProcesses(projectName: string): void {
    const ps = spawn("ps", ["ax", "-o", "pid,ppid,pgid,comm"]);
    let data: string = "";
    ps.stdout.on("data", (chunk: any) => {
        data += chunk.toString("utf-8");
    });
    ps.stdout.on("end", () => {
        logger.logTrace(`[${projectName}] Running processes:`);
        logger.logTrace(`[${projectName}] ${data}`);
    });
}

/**
 * @function
 * @description Get relevant stack trace information.
 *
 * @param trace <Required | stackTrace.StackFrame[]> - List of stack trace frames.
 *
 * @returns string
 */
function getRelevantStacktraceString(trace: stackTrace.StackFrame[]): string {
    const currentPath = __dirname + "/";
    for (let i = 0; i < trace.length; i++) {
        if (trace[i].getFileName() && !trace[i].getFileName().startsWith(currentPath)) {
            return trace[i].getFunctionName() + " : " + trace[i].getLineNumber();
        }
    }
    return trace[0].getFunctionName() + " : " + trace[0].getLineNumber();
}
