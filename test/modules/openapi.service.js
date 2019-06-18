const chai = require('chai');
const fs = require('fs-extra');
const yaml = require('js-yaml');
const SwaggerParser = require('swagger-parser');

const { pathToApiSpec } = require('../config');

chai.should();

function getOpenApiSpec() {
    return yaml.safeLoad(fs.readFileSync(pathToApiSpec));
}

async function validateOpenapiSpec(spec) {
    spec.openapi.should.equal('3.0.0');
    const validatedSpec = await SwaggerParser.validate(spec);
    validatedSpec.openapi.should.equal('3.0.0');
}

module.exports = {
    validateOpenapiSpec,
    getOpenApiSpec,
};
