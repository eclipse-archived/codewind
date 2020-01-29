const rewire = require('rewire');
const chai = require('chai');

const errorHandler = rewire('../../../../src/pfe/portal/middleware/errorHandler');

const generateLogMsg = errorHandler.__get__('generateLogMsg');

chai.should();

describe('logError(err)', function() {
    it('returns the correct log message', function() {
        const err = new TypeError('errMsg');
        const output = generateLogMsg(err);
        output.should.deep.equal(err);
    });
});
