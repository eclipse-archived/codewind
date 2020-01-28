import { expect } from "chai";
import Filewatcher from "../../../src/index";
import * as generic from "../../functional-test/lib/generic";
import * as project from "../../functional-test/lib/project";

export function indexTestModule(): void {
    describe("validate functions in index.ts", () => {
        const filewatcher = new Filewatcher();
        const functionsInIndex = Object.keys(filewatcher);
        const functionsTested = Object.keys(generic).concat(Object.keys(project));

        for (const indexFunc of functionsInIndex) {
            it(`validated ${indexFunc} in functional test`, () => {
                expect(functionsTested.includes(indexFunc)).to.be.true;
            });
        }
    });
}
