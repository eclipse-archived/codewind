// TODO: use real test framework
import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import parsePrometheusTextFormat from '../src/index';

const inputStr = fs.readFileSync(path.join(__dirname, 'input.txt'), 'utf8');
const expectedStr = fs.readFileSync(
    path.join(__dirname, 'expected-output.json'),
    'utf8'
);

if (process.argv[2] === 'bench') {
    console.time('parse 50000 times');
    for (let i = 0; i < 50000; ++i) {
        parsePrometheusTextFormat(inputStr);
    }
    console.timeEnd('parse 50000 times');
} else {
    const expected = sortPromJSON(
        normalizeNumberValues(JSON.parse(expectedStr))
    );
    const actual = sortPromJSON(
        normalizeNumberValues(parsePrometheusTextFormat(inputStr))
    );
    assert.deepEqual(expected, actual);
    console.log('Test OK');
}

/**
 * Normalizes the "value", "count", and "sum" prop of metric fields by converting to Number type.
 *
 * Since all numbers are string encoded (such as "3851.0" or
 * "1.458255915e9"), it is necessary to normalize all number values before
 * comparing against the prom2json CLI output, to ensure that "3851.0" equals
 * "3851" and "1.458255915e+09" equals "1.458255915e9" in tests.
 *
 * @param promJSON - the JSON array that is the result of parsing prometheus text
 */
function normalizeNumberValues(promJSON) {
    return promJSON.map(family => ({
        ...family,
        metrics: family.metrics.map(metric => ({
            ...metric,
            value: Number(metric.value),
            count: Number(metric.count),
            sum: Number(metric.sum)
        }))
    }));
}

/**
 * Sorts the promJSON array by metric family name.
 *
 * Sorting is necessary for testing against the prom2json CLI because the
 * prom2json CLI outputs the metrics in a non-deterministic order.
 *
 * @param promJSON - the JSON that is the result of parsing prometheus text
 */
function sortPromJSON(promJSON) {
    return promJSON.sort((family1, family2) => {
        if (family1.name < family2.name) {
            return -1;
        }
        if (family1.name > family2.name) {
            return 1;
        }
        return 0;
    });
}
