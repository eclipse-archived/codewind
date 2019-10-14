const fs = require('fs-extra');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const rimraf = require('rimraf');
const licenseChecker = require('license-checker');
const readLine = require('read-each-line-sync');

const root = path.join(__dirname, '../');
const binDirectory = path.join(root, '/resources/codewind-license-data/bin');

function TrimLocalPackages(packageJson) {
    if (packageJson.dependencies !== {}) {
        for (const dependency in packageJson.dependencies) {
            if (packageJson.dependencies[dependency].startsWith('file:')) {
                delete packageJson.dependencies[dependency];
            }
        }
    }
}

async function NodePackageInstall(packageJson, packageDirectory, packageLockJson) {
    let npmInstallCommand;
    const packageJsonPath = path.join(packageDirectory, 'package.json');
    let packageLockJsonPath;

    if (packageLockJson === null) {
        npmInstallCommand = `npm install --production --prefix ${packageDirectory}`;
    } else {
        packageLockJsonPath = path.join(packageDirectory, 'package-lock.json');
        fs.writeFileSync(packageLockJsonPath, JSON.stringify(packageLockJson));
        npmInstallCommand = `npm ci --production --prefix ${packageDirectory}`;
    }

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson));
    await exec(npmInstallCommand);
}

function PerformLicenseCheck(packageDirectory) {
    return new Promise(function(resolve, reject) {
        licenseChecker.init({
            start: packageDirectory,
            json: true,
        }, function(err, packages) {
            if (err) {
                reject(err);
            } else {
                resolve(packages);
            }
        });
    });
}

async function CompareResultsWithExistingClearance(acceptedPackages, unclearedPackages, licenseCheckerOutput) {
    const codewindDataPath = path.join(root, 'resources/codewind-license-data');
    const eclipseCQPath = path.join(codewindDataPath, 'eclipse-cqs.json');
    const eclipseCQs = JSON.parse(fs.readFileSync(eclipseCQPath));
    const codewindPackageLocksPath = path.join(codewindDataPath, 'codewindPackageLocks');
    const fileNames = fs.readdirSync(codewindPackageLocksPath);

    const codewindPackageLocks = {};
    fileNames.forEach(val => {
        codewindPackageLocks[val] = JSON.parse(fs.readFileSync(path.join(codewindPackageLocksPath, val)));
    });

    for (const key in licenseCheckerOutput) {
        const lastIndex = key.lastIndexOf('@');
        const packageName = key.substr(0, lastIndex);
        const packageVersion = key.substr(lastIndex + 1);

        const packageVersionBreakdown = packageVersion.split('.', 3);
        const packageVersionRegex = `${packageVersionBreakdown[0]}\\.${packageVersionBreakdown[1]}\\.\\d{1,}`;
        let approved = false;

        eclipseCQs.forEach(element => {
            if (element.short_desc.match(packageName) && element.short_desc.match(packageVersionRegex)) {
                approved = true;
                acceptedPackages[key] = licenseCheckerOutput[key];
                acceptedPackages[key].approved = true;
                acceptedPackages[key].cw_eclipse_cq = element.bug_id;
            }
        });

        if (approved === false) {
            for (const index in codewindPackageLocks) {
                const packageLock = codewindPackageLocks[index];
                if (await RecursivelySearchDependencies(packageLock.dependencies, packageName, packageVersionRegex)) {
                    approved = true;
                    acceptedPackages[key] = licenseCheckerOutput[key];
                    acceptedPackages[key].approved = true;
                    acceptedPackages[key].codewindVersion = packageLock.version;
                }
            }
        }

        if (!approved) {
            unclearedPackages[key] = licenseCheckerOutput[key];
        }
    }
}

async function RecursivelySearchDependencies(dependenciesList, packageName, packageVersionRegex) {
    for (const dependency in dependenciesList) {
        if (packageName === dependency && dependenciesList[dependency].version.match(packageVersionRegex)) {
            return true;
        } else if (Object.keys(dependenciesList[dependency]).includes('dependencies')) {
            if (await RecursivelySearchDependencies(dependenciesList[dependency].dependencies, packageName, packageVersionRegex)) {
                return true;
            }
            continue;

        }
    }
    return false;
}

function FilterInvestigatedPackages(acceptedPackages, unclearedPackages, problemPackages) {
    const packageInvestigationsPath = path.join(root, 'resources/codewind-license-data/package-investigations.json');
    const packageInvestigations = JSON.parse(fs.readFileSync(packageInvestigationsPath));
    for (const investigation in packageInvestigations) {
        for (const nodePackage in unclearedPackages) {
            if (investigation === nodePackage) {
                unclearedPackages[nodePackage].licenses = packageInvestigations[investigation].license;
                unclearedPackages[nodePackage].investingationComment = packageInvestigations[investigation].comment;
                if (packageInvestigations[investigation].allowedToUse === true) {
                    acceptedPackages[nodePackage] = unclearedPackages[nodePackage];
                    delete unclearedPackages[nodePackage];
                } else {
                    problemPackages[nodePackage] = unclearedPackages[nodePackage];
                    delete unclearedPackages[nodePackage];
                }
            }
        }
    }
}

function CompareResultsWithApprovedLicenses(unclearedPackages, problemPackages) {
    const pathToLicenseFile = path.join(root, 'resources/codewind-license-data/approved-licenses.json');
    const approvedLicenses = JSON.parse(fs.readFileSync(pathToLicenseFile));

    for (const packageName in unclearedPackages) {
        unclearedPackages[packageName].approvedLicense = false;
        if (approvedLicenses.eclipseApprovedLicenses.indexOf(unclearedPackages[packageName].licenses) <= -1) {
            problemPackages[packageName] = unclearedPackages[packageName];
            delete unclearedPackages[packageName];
        } else {
            unclearedPackages[packageName].approvedLicense = true;
        }
    }
}

async function PerformGrep(packageDirectory) {
    const grepArguments = '-I -i -H -r -w -n';
    const grepExclude = '--exclude=package.json --exclude=package-lock.json --exclude=grepOutput.txt';
    const grepOutput = path.join(packageDirectory, 'grepOutput.txt');
    const grepSearch = 'gpl';
    const grepCommand = `grep ${grepSearch} ${grepArguments} ${packageDirectory} ${grepExclude} > ${grepOutput} | cat`;

    await exec(grepCommand).catch(function(error) {
        console.log(error);
        return {};
    });
    return ProcessGrepResults(grepOutput, {});
}

function ProcessGrepResults(grepOutputPath, grepResults) {
    readLine(grepOutputPath, 'utf8', function(line) {
        let index = line.indexOf(':');
        if (index >= 0) {
            const directory = line.substr(0, index);
            const lineNumberAndText = line.substr(index + 1);
            index = lineNumberAndText.indexOf(':');
            const lineNumber = lineNumberAndText.substr(0, index);
            const text = lineNumberAndText.substr(index + 1);
            if (grepResults[directory]) {
                grepResults[directory][lineNumber] = text;
            } else {
                grepResults[directory] = {};
                grepResults[directory][lineNumber] = text;
            }
        }
    });
    return grepResults;
}

function CompareResultsWithGPLMentions(grepResults, unclearedPackages, problemPackages, packageId) {
    for (const dir in grepResults) {
        let resultsFound = false;
        let searchString;
        const directoryTree = dir.split('/');
        const index = directoryTree.indexOf('node_modules');
        if (index > -1) {
            searchString = `${directoryTree[index + 1]}@`;
        } else {
            const index = directoryTree.indexOf(packageId);
            searchString = `${directoryTree[index]}`;
        }
        if (unclearedPackages) {
            const unclearedPackagesKeys = Object.keys(unclearedPackages);
            const foundUnclearedPakcages = unclearedPackagesKeys.filter(s => s.includes(searchString));
            if (foundUnclearedPakcages.length > 0) {
                resultsFound = true;
                const resultPackage = foundUnclearedPakcages[0];
                if (unclearedPackages[resultPackage].gplHits) {
                    unclearedPackages[resultPackage].gplHits[dir] = grepResults[dir];
                } else {
                    unclearedPackages[resultPackage].gplHits = {};
                    unclearedPackages[resultPackage].gplHits[dir] = grepResults[dir];
                }
                problemPackages[resultPackage] = unclearedPackages[resultPackage];
                delete unclearedPackages[resultPackage];
            }
        }
        if (problemPackages && !resultsFound) {
            const problemPackagesKeys = Object.keys(problemPackages);
            const foundProblemPackages = problemPackagesKeys.filter(s => s.includes(searchString));
            if (foundProblemPackages.length > 0) {
                const resultPackage = foundProblemPackages[0];
                if (problemPackages[resultPackage].gplHits) {
                    problemPackages[resultPackage].gplHits[dir] = grepResults[dir];
                } else {
                    problemPackages[resultPackage].gplHits = {};
                    problemPackages[resultPackage].gplHits[dir] = grepResults[dir];
                }
            }
        }
    }
}

exports.performCheck = async function(packageJson, packageLockJson) {
    const packageName = packageJson.name;
    const packageVersion = packageJson.version;
    const packageId = `${packageName}@${packageVersion}`;

    const packageDirectory = path.join(binDirectory, packageId);
    if (!fs.existsSync(binDirectory)) {
        fs.mkdirSync(binDirectory);
    }
    if (fs.existsSync(packageDirectory)) {
        rimraf.sync(packageDirectory);
    }
    fs.mkdirSync(packageDirectory);

    await TrimLocalPackages(packageJson);
    await NodePackageInstall(packageJson, packageDirectory, packageLockJson);
    const licenseCheckerOutput = await PerformLicenseCheck(packageDirectory);
    const acceptedPackages = {};
    const unclearedPackages = {};
    const problemPackages = {};

    await CompareResultsWithExistingClearance(acceptedPackages, unclearedPackages, licenseCheckerOutput);
    await FilterInvestigatedPackages(acceptedPackages, unclearedPackages, problemPackages);
    await CompareResultsWithApprovedLicenses(unclearedPackages, problemPackages);
    const grepResults = await PerformGrep(packageDirectory);
    await CompareResultsWithGPLMentions(grepResults, unclearedPackages, problemPackages, packageId);

    const report = {};
    report.packageId = packageId;
    report.acceptedPackages = acceptedPackages;
    report.unclearedPackages = unclearedPackages;
    report.problemPackages = problemPackages;

    rimraf.sync(packageDirectory);
    return report;
};