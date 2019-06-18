require('mocha-sinon');
const rewire = require('rewire');
const chai = require('chai');

const sinonChai = require('sinon-chai');
const errorHandler = rewire('../../../../src/pfe/portal/middleware/errorHandler');

const logError = errorHandler.__get__('logError');
const log = errorHandler.__get__('log');

chai.use(sinonChai);
chai.should();

describe('logError(err)', function() {
    it('logs the correct error info to console', function() {
        const spy = this.sinon.spy(log, 'error');
        logError(new TypeError('errMsg'));
        spy.should.have.been.calledWith({
            error: {
                name: 'TypeError',
                message: 'errMsg',
            },
        });
    });
});