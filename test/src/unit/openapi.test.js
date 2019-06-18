const chai = require('chai');

const { validateOpenapiSpec, getOpenApiSpec } = require('../../modules/openapi.service');

chai.should();

describe('Validate OpenAPI spec', function() {
    it('checks that our OpenAPI spec is valid', async function() {
        const spec = getOpenApiSpec();
        await validateOpenapiSpec(spec);
    });
});