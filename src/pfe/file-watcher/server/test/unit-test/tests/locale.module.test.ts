import { expect } from "chai";
import * as locale from "../../../../server/src/utils/locale";

export function localeTestModule(): void {

    it("test getTranslation without NLS initialized", async () => {
        const actualResult = await locale.getTranslation("filewatcherUtil.fwNLSInitSuccess");
        expect(actualResult).to.equal("Turbine NLS has been initialized successfully");
    });

    describe("combinational testing of setLocale function", () => {

        const combinations: any = {
            "combo1": {
                "localeRequested": undefined,
                "result": 400
            },
            "combo2": {
                "localeRequested": "en",
                "result": 400
            },
            "combo3": {
                "localeRequested": ["en"],
                "result": 200
            },
        };

        for (const combo of Object.keys(combinations)) {
            const localeRequested = combinations[combo]["localeRequested"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => localeRequested: " + localeRequested , async() => {
                try {
                    const actualResult = await locale.setLocale(localeRequested);
                    expect(actualResult.statusCode).to.equal(expectedResult);
                    if ( actualResult.statusCode === 200 ) {
                        const fwlocale = await locale.getLocale();
                        expect(fwlocale).to.equal("en");
                    }
                } catch (err) {
                    expect(err.code).to.equal(expectedResult);
                }
            });
        }
    });

    describe("combinational testing of getMessageFromFile function", () => {

        const combinations: any = {
            "combo1": {
                "key": undefined,
                "result": undefined
            },
            "combo2": {
                "key": "nonExistMessage",
                "result": "nonExistMessage"
            },
            "combo3": {
                "key": "filewatcherUtil.fwNLSInitSuccess",
                "result": "Turbine NLS has been initialized successfully"
            },
        };

        for (const combo of Object.keys(combinations)) {
            const key = combinations[combo]["key"];
            const expectedResult = combinations[combo]["result"];

            it(combo + " => key: " + key , async() => {
                try {
                    const actualResult = await locale.getMessageFromFile(key);
                    expect(actualResult).to.equal(expectedResult);
                } catch (err) {
                    expect(err.code).to.equal(expectedResult);
                }
            });

            it("test getTranslation with NLS initialized", async () => {
                const actualResult = await locale.getTranslation("filewatcherUtil.fwNLSInitSuccess");
                expect(actualResult).to.equal("Turbine NLS has been initialized successfully");
            });
        }
    });

}