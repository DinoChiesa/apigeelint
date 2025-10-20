/*
  Copyright © 2019-2021,2025 Google LLC

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
/* global describe, it */

const assert = require("assert"),
  debug = require("debug")("apigeelint:TruthTableTest"),
  TruthTable = require("../../lib/package/TruthTable.js"),
  test = function (exp, expected) {
    it(`${exp} should be ${expected}`, function () {
      try {
        const tt = new TruthTable(exp),
          evaluation = tt.getEvaluation();

        debug(`evaluation: ${evaluation}`);
        assert.equal(
          evaluation,
          expected,
          JSON.stringify({
            truthTable: tt,
            evaluation,
          }),
        );
      } catch (parseExc) {
        debug(`expected: ${expected}`);
        assert.notEqual("ERR_ASSERTION", parseExc.code);
        debug(`parse Exception: ${JSON.stringify(parseExc)}`);
        debug(`parse Exception: ${parseExc.stack}`);
        assert.equal("exception", expected);
        return;
      }
    });
  };

describe("TruthTable MatchesPath", function () {
  test('!(a MatchesPath "c")', "valid");
  test('!a MatchesPath "c"', "valid");
  test('(a MatchesPath "a") and !(a MatchesPath "c")', "valid");
  test(
    '(a MatchesPath "a"or a MatchesPath "b") and !(a MatchesPath "c")',
    "valid",
  );
  test(
    '(a MatchesPath "a"or a MatchesPath "b") and !(a MatchesPath "c")',
    "valid",
  );
  test(
    '(proxy.pathsuffix MatchesPath "/{version}/products/**" or proxy.pathsuffix MatchesPath "/{version}/profile/{profile.id}/products**") and !(proxy.pathsuffix MatchesPath "/{version}/profile/{profile.id}/products/categories/**")',
    "valid",
  );
  test(
    '(proxy.pathsuffix MatchesPath "/{version}/products/**" or proxy.pathsuffix MatchesPath "/{version}/profile/{profile.id}/products**") and !(proxy.pathsuffix MatchesPath "/{version}/profile/{profile.id}/products/categories/**")',
    "valid",
  );
  test('(a MatchesPath "a") and !(a MatchesPath "a")', "absurdity");

  test(
    'proxy.pathsuffix MatchesPath "/{version}/profile/{profile.id}/paymentmethods/**" and proxy.pathsuffix !MatchesPath "**/initialize" and proxy.pathsuffix !MatchesPath "**/finalize" and request.verb = "GET"',
    "exception",
  );
  test(
    'proxy.pathsuffix !MatchesPath "/{version}/profile/{profile.id}/paymentmethods/**")',
    "exception",
  );
  test(
    'proxy.pathsuffix MatchesPath "/{version}/profile/{profile.id}/paymentmethods/**" and proxy.pathsuffix !MatchesPath "**/initialize" ',
    "exception",
  );
});
