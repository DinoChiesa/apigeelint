/*
  Copyright 2019-2025 Google LLC

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

const testID = "TD013",
  assert = require("assert"),
  fs = require("fs"),
  util = require("util"),
  path = require("path"),
  bl = require("../../lib/package/bundleLinter.js"),
  plugin = require(bl.resolvePlugin(testID)),
  Endpoint = require("../../lib/package/Endpoint.js"),
  Dom = require("@xmldom/xmldom").DOMParser,
  rootDir = path.resolve(__dirname, "../fixtures/resources/TD013"),
  debug = require("debug")(`apigeelint:${testID}-test`);

const loadEndpoint = (sourceDir, shortFileName) => {
  const fqPath = path.join(sourceDir, shortFileName),
    xml = fs.readFileSync(fqPath).toString("utf-8"),
    doc = new Dom().parseFromString(xml),
    endpoint = new Endpoint(doc.documentElement, null, "");
  endpoint.getFileName = () => shortFileName;
  return endpoint;
};

describe(`${testID} - endpoint passes ClientAuthEnabled check`, function () {
  const sourceDir = path.join(rootDir, "pass");
  const testOne = (shortFileName) => {
    it(`check ${shortFileName} passes`, () => {
      const endpoint = loadEndpoint(sourceDir, shortFileName);
      plugin.onTargetEndpoint(endpoint, (e, foundIssues) => {
        assert.equal(e, undefined, "should be undefined");
        const messages = endpoint.getReport().messages;
        debug(util.format(messages));
        assert.equal(foundIssues, false, "should be no issues");
        assert.ok(messages, "messages should exist");
        assert.equal(messages.length, 0, "unexpected number of messages");
      });
    });
  };

  it(`checks that there are tests`, () => {
    const candidates = fs
      .readdirSync(sourceDir)
      .filter((shortFileName) => shortFileName.endsWith(".xml"));
    assert.ok(candidates.length > 0, "tests should exist");
  });

  fs.readdirSync(sourceDir)
    .filter((shortFileName) => shortFileName.endsWith(".xml"))
    .forEach(testOne);
});

describe(`${testID} - endpoint does not pass ClientAuthEnabled check`, () => {
  const sourceDir = path.join(rootDir, "fail");

  const testOne = (shortFileName) => {
    it(`check ${shortFileName} throws error`, () => {
      const policy = loadEndpoint(sourceDir, shortFileName);
      plugin.onTargetEndpoint(policy, (e, foundIssues) => {
        assert.equal(undefined, e, "should be undefined");
        assert.equal(true, foundIssues, "should be issues");
        const messages = policy.getReport().messages;
        assert.ok(messages, "messages for issues should exist");
        debug(util.format(messages));
      });
    });
  };

  it(`checks that there are tests`, () => {
    const candidates = fs
      .readdirSync(sourceDir)
      .filter((shortFileName) => shortFileName.endsWith(".xml"));

    assert.ok(candidates.length > 0, "tests should exist");
  });

  fs.readdirSync(sourceDir)
    .filter((shortFileName) => shortFileName.endsWith(".xml"))
    .forEach(testOne);
});
