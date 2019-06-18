const rewire = require('rewire');
const chai = require('chai');

chai.should();

const reqValidator = rewire('../../../../src/pfe/portal/middleware/reqValidator');
const getRouteInOpenapiFormat = reqValidator.__get__('getRouteInOpenapiFormat');

describe('reqValidator.test.js', function() {
    describe('getRouteInOpenapiFormat(req)', function() {
        describe('valid args', function() {
            describe('empty req.route.path', function() {
                it(' \'\' returns an empty string', function() {
                    const req = {
                        route: {
                            path: '',
                        },
                    };
                    const output = getRouteInOpenapiFormat(req);
                    output.should.equal('');
                });
                it(' \'/\' returns \'/\'', function() {
                    const req = {
                        route: {
                            path: '/',
                        },
                    };
                    const output = getRouteInOpenapiFormat(req);
                    output.should.equal('/');
                });
            });
            describe('req.route.path with parameters', function() {
                it('req.route.path = \'/:id\' returns /{id}', function() {
                    const req = {
                        route: {
                            path: '/:id',
                        },
                    };
                    const output = getRouteInOpenapiFormat(req);
                    output.should.equal('/{id}');
                });
                it('req.route.path = \'/:id/:paramA/foo/:paramB\' returns \'/{id}/{paramA}/foo/{paramB}\'', function() {
                    const req = {
                        route: {
                            path: '/:id/:paramA/foo/:paramB',
                        },
                    };
                    const output = getRouteInOpenapiFormat(req);
                    output.should.equal('/{id}/{paramA}/foo/{paramB}');
                });
            });
            describe('req.route.path with no parameters', function() {
                it('req.route.path = \'/hello\' returns /hello', function() {
                    const req = {
                        route: {
                            path: '/hello',
                        },
                    };
                    const output = getRouteInOpenapiFormat(req);
                    output.should.equal('/hello');
                });
                it('req.route.path = \'/hello/world/foo/bar\' returns \'/hello/world/foo/bar\'', function() {
                    const req = {
                        route: {
                            path: '/hello/world/foo/bar',
                        },
                    };
                    const output = getRouteInOpenapiFormat(req);
                    output.should.equal('/hello/world/foo/bar');
                });
            });
        });
        // Don't test invalid args because req comes from Express
    });
});