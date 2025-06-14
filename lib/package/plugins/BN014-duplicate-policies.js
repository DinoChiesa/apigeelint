/*
  Copyright 2019-2020,2025 Google LLC

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

const ruleId = require("../lintUtil.js").getRuleId(),
  debug = require("debug")("apigeelint:" + ruleId),
  xpath = require("xpath");

const ELEMENT_NODE = 1;
//const ATTRIBUTE_NODE = 2;
const TEXT_NODE = 3;
const CDATA_SECTION_NODE = 4;

const plugin = {
  ruleId,
  name: "Check for duplicate policies",
  message: "Multiple identically configured policies.",
  fatal: false,
  severity: 1, // 1=warning, 2=error
  nodeType: "Endpoint",
  enabled: true,
};

const onBundle = function (bundle, cb) {
  debug("onBundle");
  const flagged = check(bundle);
  if (typeof cb == "function") {
    cb(null, flagged);
  }
};

const _markPolicy = (policy, msg) =>
  policy.addMessage({
    ruleId: plugin.ruleId,
    severity: plugin.severity,
    source: policy.getSource(),
    line: policy.getElement().lineNumber,
    column: policy.getElement().columnNumber,
    nodeType: "Policy",
    message: msg,
  });

/*
 * Recursive fn that returns true if XML elements are different. Ignores any intervening whitespace or indents.
 *
 **/
const _diffXmlNode = (isTopLevel) => (indent, elt1, elt2) => {
  debug(`${indent}elt1: TYPE(${elt1.nodeType}) tag(${elt1.tagName})`);
  debug(`${indent}elt2: TYPE(${elt2.nodeType}) tag(${elt2.tagName})`);
  if (elt1.nodeType != elt2.nodeType) {
    debug(`${indent}different nodeType`);
    return true;
  }

  if (elt1.nodeType == TEXT_NODE) {
    debug(
      `${indent}test '${elt1.nodeValue.trim()}' ==? '${elt2.nodeValue.trim()}'`,
    );
    return elt1.nodeValue.trim() != elt2.nodeValue.trim();
  }

  if (elt1.nodeType == CDATA_SECTION_NODE) {
    debug(`${indent}test '${elt1.data}' ==? '${elt2.data}'`);
    return elt1.data != elt2.data;
  }

  if (elt1.nodeType == ELEMENT_NODE) {
    // compare tagname on element nodes
    debug(`${indent}both elements`);
    debug(`${indent}test tagName '${elt1.tagName}' ==? '${elt2.tagName}'`);
    if (elt1.tagName != elt2.tagName) {
      return true;
    }

    // select attrs to compare, excepting name on root node
    const attrsToCompare = (elt) => {
      let attrs = xpath.select("@*", elt);
      if (isTopLevel) {
        attrs = attrs.filter((attr) => attr.name != "name");
      }
      return attrs;
    };

    // compare attrs without respect to ordering
    const attrs1 = attrsToCompare(elt1);
    const attrs2 = attrsToCompare(elt2);
    let diff =
      attrs1.length != attrs2.length ||
      !!attrs1.find(
        (attr1, _i) =>
          !attrs2.find(
            (attr2) => attr2.name == attr1.name && attr2.value == attr1.value,
          ),
      );

    // compare the child nodesets
    if (!diff) {
      // This will strip comments
      const childrenToCompare = (elt) =>
        xpath
          .select("node()|text()", elt)
          .filter(
            (node) =>
              node.nodeType == ELEMENT_NODE ||
              node.nodeType == TEXT_NODE ||
              node.nodeType == CDATA_SECTION_NODE,
          );
      let children1 = childrenToCompare(elt1);
      let children2 = childrenToCompare(elt2);

      debug(`${indent}found ${children1.length} children on e1`);
      debug(`${indent}found ${children2.length} children on e2`);
      if (
        children1.length == children2.length &&
        children2.length == 1 &&
        children2[0].nodeType == TEXT_NODE
      ) {
        diff = children1[0].nodeValue.trim() != children2[0].nodeValue.trim();
      } else {
        debug(`${indent}recurse`);
        /*
         * It is too simplistic to use the lengths of the node sets as a basis
         * of difference.  If there is an empty line in one of the documents, and
         * not in the other, it results in multiple text nodes in one of the
         * nodesets and just one in the other, resulting in different numbers of
         * children, though the effective infoset may be the same.  Instead,
         * this comparison must ignore direct children that are text in either
         * document. This is ok, as there are no cases in which Apigee uses
         * complex XML in which a child nodeset includes both significant TEXT
         * nodes and elements.  In other words, in all valid Apigee
         * configuration, if the node is an element, it either has a single TEXT
         * child, or it has one or more element children. Never both.
         **/

        const filterFn = (elt) => elt.nodeType != TEXT_NODE;
        children1 = children1.filter(filterFn);
        children2 = children2.filter(filterFn);
        debug(
          `${indent} after filtering, children1.length=${children1.length}`,
        );
        debug(
          `${indent} after filtering, children2.length=${children2.length}`,
        );

        diff =
          children1.length != children2.length ||
          // compare in order
          children1.some((elt, ix) =>
            _diffXmlNode(false)(indent + "  ", elt, children2[ix]),
          );
      }
    }
    return diff;
  }
  throw new Error("unhandled node type");
};

/*
 * Returns true if XML elements are different. This ignores the toplevel name attribute,
 * and any intervening whitespace or indents.
 *
 **/
const diffXml = (elt1, elt2) => _diffXmlNode(true)("", elt1, elt2);

const _checkForDuplicatePolicies = (policies) => {
  const xpath = "/*/*";
  let flagged = false;
  /**
   * Check each policy for duplicates.
   *
   * An ideal comparison would compare the digests of the XML, where "digest"
   * represents exactly what the Apigee configstore renders the XML as. That is
   * not quite possible, in a totally different implementation.  This is an
   * approximation. There are no known diversions, but testing is incomplete.
   *
   **/
  const previouslyDetected = [];

  policies.slice(0, -1).forEach((policy1, i, a) => {
    if (!previouslyDetected.includes(i)) {
      try {
        //const p1 = policy1.select(xpath).toString().trim();
        debug(
          `looking at index ${i}: type(${policy1.getType()}) name(${policy1.getName()})`,
        );
        const dupesForI = [];
        a.slice(i + 1).forEach((c, j) => {
          debug(`  comparing to ${c.getName()}`);
          if (!diffXml(policy1.getElement(), c.getElement())) {
            const actualIndex = j + i + 1;
            debug(`    duplicate found at index ${actualIndex}`);
            dupesForI.push(actualIndex);
          }
        });

        if (dupesForI.length) {
          debug(`    dupes found for ${i}: ${dupesForI}`);
          dupesForI.forEach((ix) =>
            _markPolicy(
              policies[ix],
              `Policy ${policies[ix].getName()} is a duplicate of Policy ${policies[i].getName()}. Eliminate duplicates and attach a single policy in multiple places.`,
            ),
          );
          flagged = true;
          previouslyDetected.push(...dupesForI);
          debug(`\n  dupes found so far: ${previouslyDetected}`);
        }
      } catch (e) {
        console.log(e.stack);
        _markPolicy(
          policy1,
          `Error processing Policy ${policy1.getName()}: ${e.message}.`,
        );
        flagged = true;
      }
    }
  });
  return flagged;
};

const check = (bundle) => {
  let flagged = false;
  if (bundle.policies) {
    debug("number of policies: " + bundle.policies.length);
    if (bundle.policies.length > 1) {
      flagged = _checkForDuplicatePolicies(
        bundle.policies.toSorted((a, b) =>
          a.getName().localeCompare(b.getName()),
        ),
      );
    }
  }
  return flagged;
};

module.exports = {
  plugin,
  onBundle,
};
