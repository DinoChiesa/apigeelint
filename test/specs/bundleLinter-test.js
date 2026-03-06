/*
  Copyright © 2026 Google LLC

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

const assert = require("node:assert"),
  path = require("node:path"),
  fs = require("node:fs"),
  tmp = require("tmp"),
  bl = require("../../lib/package/bundleLinter.js");

describe("bundleLinter unit tests", function () {
  it("contains should handle various inputs", function () {
    assert.equal(bl.contains(null, "foo"), false);
    assert.equal(bl.contains([], "foo"), false);
    assert.equal(bl.contains(["a", "b"], "a"), "a");
    assert.equal(bl.contains(["a", "b"], "c"), false);
    const objList = [{ id: 1 }, { id: 2 }];
    assert.deepEqual(
      bl.contains(objList, 2, (a, b) => a.id === b),
      { id: 2 },
    );
    assert.equal(bl.contains([0, 1, 2], 0), true);
    assert.equal(bl.contains(["", "a"], ""), true);
  });

  it("getFormatter should handle non-string inputs", function () {
    assert.equal(typeof bl.getFormatter(null), "function");
    assert.equal(bl.getFormatter(123), null);
  });

  it("getFormatter should handle file paths", function () {
    const tmpFile = tmp.fileSync({ postfix: ".js" });
    fs.writeFileSync(tmpFile.name, "module.exports = (report) => 'formatted';");
    const formatter = bl.getFormatter(tmpFile.name);
    assert.equal(typeof formatter, "function");
    assert.equal(formatter({}), "formatted");
    tmpFile.removeCallback();
  });

  it("getFormatter should throw on invalid paths", function () {
    assert.throws(() => {
      bl.getFormatter("./non-existent-formatter.js");
    }, /There was a problem loading formatter/);
  });

  it("lint should handle maxWarnings and setExitCode", function (done) {
    const config = {
      source: {
        type: "filesystem",
        path: path.resolve(
          __dirname,
          "../fixtures/resources/sampleProxy/24Solver/apiproxy",
        ),
        bundleType: "apiproxy",
      },
      maxWarnings: 0,
      setExitCode: true,
      output: () => {},
    };
    bl.lint(config, (bundle, error) => {
      assert.equal(error, null);
      assert.equal(bundle.lintExitCode, 1);
      done();
    });
  });

  it("lint should handle default console output", function (done) {
    const config = {
      source: {
        type: "filesystem",
        path: path.resolve(
          __dirname,
          "../fixtures/resources/sampleProxy/24Solver/apiproxy",
        ),
        bundleType: "apiproxy",
      },
      plugins: ["BN001"], // limit plugins for speed
    };
    const oldLog = console.log;
    let logged = false;
    console.log = () => {
      logged = true;
    };
    bl.lint(config, (bundle, error) => {
      console.log = oldLog;
      assert.equal(logged, true, "Should have logged to console");
      done();
    });
  });

  it("lint should export report to file and handle errors", function (done) {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const writePath = path.join(tmpDir.name, "report.json");
    const config = {
      source: {
        type: "filesystem",
        path: path.resolve(
          __dirname,
          "../fixtures/resources/sampleProxy/24Solver/apiproxy",
        ),
        bundleType: "apiproxy",
      },
      writePath,
      output: () => {},
    };
    bl.lint(config, (bundle) => {
      assert.ok(fs.existsSync(writePath));
      // Trigger export error by providing a directory where a file should be
      const configErr = { ...config, writePath: tmpDir.name };
      bl.lint(configErr, () => {
        tmpDir.removeCallback();
        done();
      });
    });
  });

  it("lint should handle external plugins and unexpected files", function (done) {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    // Valid external plugin
    fs.writeFileSync(
      path.join(tmpDir.name, "EX-ST001-test.js"),
      "module.exports = { plugin: { enabled: true, ruleId: 'EX-ST001', nodeType: 'Bundle' }, onBundle: (b, cb) => cb(null, false) };",
    );
    // Unexpected file
    fs.writeFileSync(
      path.join(tmpDir.name, "unexpected.js"),
      "console.log('hi');",
    );
    // Hidden file (should be ignored)
    fs.writeFileSync(path.join(tmpDir.name, "_ignored.js"), "...");

    const config = {
      source: {
        type: "filesystem",
        path: path.resolve(
          __dirname,
          "../fixtures/resources/sampleProxy/24Solver/apiproxy",
        ),
        bundleType: "apiproxy",
      },
      externalPluginsDirectory: tmpDir.name,
      output: () => {},
    };

    const oldWarn = console.warn;
    let warned = false;
    console.warn = () => {
      warned = true;
    };

    bl.lint(config, (bundle) => {
      console.warn = oldWarn;
      assert.equal(warned, true, "Should have warned about unexpected file");
      tmpDir.removeCallback();
      done();
    });
  });

  it("lint should catch and log plugin errors", function (done) {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    fs.writeFileSync(
      path.join(tmpDir.name, "EX-ER001-error.js"),
      "module.exports = { plugin: { enabled: true, ruleId: 'EX-ER001', nodeType: 'Bundle' }, onBundle: () => { throw new Error('Plugin Crash'); } };",
    );

    const config = {
      source: {
        type: "filesystem",
        path: path.resolve(
          __dirname,
          "../fixtures/resources/sampleProxy/24Solver/apiproxy",
        ),
        bundleType: "apiproxy",
      },
      externalPluginsDirectory: tmpDir.name,
      output: () => {},
    };

    const oldError = console.error;
    let errorLogged = false;
    console.error = () => {
      errorLogged = true;
    };

    bl.lint(config, (bundle) => {
      console.error = oldError;
      assert.equal(errorLogged, true, "Should have logged plugin error");
      tmpDir.removeCallback();
      done();
    });
  });

  it("listFormatters should return a list of js files", function () {
    const formatters = bl.listFormatters();
    assert.ok(Array.isArray(formatters));
    assert.ok(formatters.includes("json.js"));
  });

  it("executePlugin should handle various states", function () {
    const bundle = { excluded: { XX001: true }, onBundle: () => {} };
    // Non-existent file
    bl.executePlugin("/tmp/non-existent-plugin.js", bundle);

    // Disabled plugin
    const tmpFile = tmp.fileSync({ postfix: ".js" });
    fs.writeFileSync(
      tmpFile.name,
      "module.exports = { plugin: { enabled: false, ruleId: 'XX001' } };",
    );
    bl.executePlugin(tmpFile.name, bundle);
    tmpFile.removeCallback();
  });

  it("resolvePlugin should throw on conflict", function () {
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    // Create two files with same ID prefix to trigger conflict
    fs.writeFileSync(path.join(tmpDir.name, "XX001-a.js"), "...");
    fs.writeFileSync(path.join(tmpDir.name, "XX001-b.js"), "...");

    const resolver = bl.getPluginResolver(tmpDir.name, true);
    assert.throws(() => {
      resolver("XX001");
    }, /plugin conflict/);

    assert.equal(resolver("NONEXISTENT"), null);
    tmpDir.removeCallback();
  });

  it("lint should handle bundle initialization errors", function (done) {
    // Provide a config that is known to fail bundle initialization
    // For example, an invalid bundle type or missing source path.
    const config = {
      source: {
        type: "filesystem",
        path: "/dev/null/invalid", // This should trigger an error in Bundle.js
        bundleType: "apiproxy",
      },
      output: () => {},
    };

    bl.lint(config, (bundle, error) => {
      assert.ok(error, "Expected an error in callback");
      done();
    });
  });

  it("exportReport should log error on failure", function () {
    const oldError = console.error;
    let logged = false;
    console.error = () => {
      logged = true;
    };

    // Create a read-only directory to trigger write failure
    const tmpDir = tmp.dirSync({ unsafeCleanup: true });
    const readOnlyPath = path.join(tmpDir.name, "readonly");
    fs.mkdirSync(readOnlyPath, { mode: 0o444 });

    const targetFile = path.join(readOnlyPath, "out.txt");
    bl.exportReport(targetFile, "some data");

    console.error = oldError;
    assert.equal(logged, true, "Should have logged error to console");
    tmpDir.removeCallback();
  });
});
