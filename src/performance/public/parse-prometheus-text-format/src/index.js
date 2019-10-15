import { shallowEqualObjects } from 'shallow-equal';
import InvalidLineError from './InvalidLineError';
import parseSampleLine from './parse-sample-line';

/*
Notes:
* Empty line handling is slightly looser than the original implementation.
* Everything else should be similarly strict.
*/
const SUMMARY_TYPE = 'SUMMARY';
const HISTOGRAM_TYPE = 'HISTOGRAM';

export default function parsePrometheusTextFormat(metrics) {
    const lines = metrics.split('\n'); // Prometheus format defines LF endings
    const converted = [];

    let metric;
    let help;
    let type;
    let samples = [];

    for (let i = 0; i < lines.length; ++i) {
        const line = lines[i].trim();
        let lineMetric = null;
        let lineHelp = null;
        let lineType = null;
        let lineSample = null;
        if (line.length === 0) {
            // ignore blank lines
        } else if (line.startsWith('# ')) {
            // process metadata lines
            let lineData = line.substring(2);
            let instr = null;
            if (lineData.startsWith('HELP ')) {
                instr = 1;
            } else if (lineData.startsWith('TYPE ')) {
                instr = 2;
            }
            if (instr) {
                lineData = lineData.substring(5);
                const spaceIndex = lineData.indexOf(' ');
                if (spaceIndex !== -1) {
                    // expect another token
                    lineMetric = lineData.substring(0, spaceIndex);
                    const remain = lineData.substring(spaceIndex + 1);
                    if (instr === 1) {
                        // HELP
                        lineHelp = unescapeHelp(remain); // remain could be empty
                    } else {
                        // TYPE
                        if (remain.includes(' ')) {
                            throw new InvalidLineError(line);
                        }
                        lineType = remain.toUpperCase();
                    }
                } else {
                    throw new InvalidLineError(line);
                }
            }
            // 100% pure comment line, ignore
        } else {
            // process sample lines
            lineSample = parseSampleLine(line);
            lineMetric = lineSample.name;
        }

        if (lineMetric === metric) {
            // metadata always has same name
            if (!help && lineHelp) {
                help = lineHelp;
            } else if (!type && lineType) {
                type = lineType;
            }
        }

        // different types allow different suffixes
        const suffixedCount = `${metric}_count`;
        const suffixedSum = `${metric}_sum`;
        const suffixedBucket = `${metric}_bucket`;
        const allowedNames = [metric];
        if (type === SUMMARY_TYPE || type === HISTOGRAM_TYPE) {
            allowedNames.push(suffixedCount);
            allowedNames.push(suffixedSum);
        }
        if (type === HISTOGRAM_TYPE) {
            allowedNames.push(suffixedBucket);
        }

        // encountered new metric family or end of input
        if (
            i + 1 === lines.length ||
            (lineMetric && !allowedNames.includes(lineMetric))
        ) {
            // write current
            if (metric) {
                if (type === SUMMARY_TYPE) {
                    samples = flattenMetrics(
                        samples,
                        'quantiles',
                        'quantile',
                        'value'
                    );
                } else if (type === HISTOGRAM_TYPE) {
                    samples = flattenMetrics(
                        samples,
                        'buckets',
                        'le',
                        'bucket'
                    );
                }
                converted.push({
                    name: metric,
                    help: help ? help : '',
                    type: type ? type : 'UNTYPED',
                    metrics: samples
                });
            }
            // reset for new metric family
            metric = lineMetric;
            help = lineHelp ? lineHelp : null;
            type = lineType ? lineType : null;
            samples = [];
        }
        if (lineSample) {
            // key is not called value in official implementation if suffixed count, sum, or bucket
            if (lineSample.name !== metric) {
                if (type === SUMMARY_TYPE || type === HISTOGRAM_TYPE) {
                    if (lineSample.name === suffixedCount) {
                        lineSample.count = lineSample.value;
                    } else if (lineSample.name === suffixedSum) {
                        lineSample.sum = lineSample.value;
                    }
                }
                if (
                    type === HISTOGRAM_TYPE &&
                    lineSample.name === suffixedBucket
                ) {
                    lineSample.bucket = lineSample.value;
                }
                delete lineSample.value;
            }
            delete lineSample.name;
            // merge into existing sample if labels are deep equal
            const samplesLen = samples.length;
            const lastSample =
                samplesLen === 0 ? null : samples[samplesLen - 1];
            if (
                lastSample &&
                shallowEqualObjects(lineSample.labels, lastSample.labels)
            ) {
                delete lineSample.labels;
                for (const key in lineSample) {
                    lastSample[key] = lineSample[key];
                }
            } else {
                samples.push(lineSample);
            }
        }
    }

    return converted;
}

function flattenMetrics(metrics, groupName, keyName, valueName) {
    let flattened = null;
    for (let i = 0; i < metrics.length; ++i) {
        const sample = metrics[i];
        if (sample.labels && sample.labels[keyName] && sample[valueName]) {
            if (!flattened) {
                flattened = {};
                flattened[groupName] = {};
            }
            flattened[groupName][sample.labels[keyName]] = sample[valueName];
        } else if (!sample.labels) {
            if (!flattened) {
                flattened = {};
            }
            if (sample.count !== undefined) {
                flattened.count = sample.count;
            }
            if (sample.sum !== undefined) {
                flattened.sum = sample.sum;
            }
        }
    }
    if (flattened) {
        return [flattened];
    } else {
        return metrics;
    }
}

// adapted from https://github.com/prometheus/client_python/blob/0.0.19/prometheus_client/parser.py
function unescapeHelp(line) {
    let result = '';
    let slash = false;

    for (let c = 0; c < line.length; ++c) {
        const char = line.charAt(c);
        if (slash) {
            if (char === '\\') {
                result += '\\';
            } else if (char === 'n') {
                result += '\n';
            } else {
                result += `\\${char}`;
            }
            slash = false;
        } else {
            if (char === '\\') {
                slash = true;
            } else {
                result += char;
            }
        }
    }

    if (slash) {
        result += '\\';
    }

    return result;
}
