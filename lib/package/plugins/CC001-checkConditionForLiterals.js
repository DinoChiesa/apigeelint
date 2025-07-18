/*
  Copyright 2019-2023 Google LLC

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
  debug = require("debug")("apigeelint:" + ruleId);

const plugin = {
  ruleId,
  name: "Literals in Conditionals",
  message:
    "Single term literals statically evaluate to True or False and needlessly complicate a conditional at best, at worst they create dead code or are misleading in implying condtional execution.",
  fatal: false,
  severity: 1, //warning
  nodeType: "Condition",
  enabled: true,
};

const onCondition = function (condition, cb) {
  debug(`onCondition (${condition.getExpression()})`);
  let hasLiteral = false;
  try {
    const ast = condition.getTruthTable().getAST();

    debug(`AST: ${JSON.stringify(ast, null, 2)}`);
    const nodes = [ast],
      actions = [{ action: "root", parent: undefined }];

    while (nodes[0] && !hasLiteral) {
      const node = nodes.pop(),
        parentAction = actions.pop();

      debug(`node (${JSON.stringify(node)})`);
      if (
        node.type === "constant" &&
        (!parentAction.parent ||
          (parentAction.parent &&
            parentAction.parent.match(
              /^(root|conjunction|disjunction|negation|implication)$/,
            )))
      ) {
        hasLiteral = true;
        //write error

        condition.addMessage({
          source: condition.getExpression(),
          line: condition.getElement().lineNumber,
          column: condition.getElement().columnNumber,
          plugin,
          message: "Condition contains literal outside of comparator.",
        });
      } else if (node.args) {
        //lets also capture the prior action
        const act = { action: node.action, parent: undefined };
        if (parentAction && parentAction.action) {
          act.parent = parentAction.action;
        }

        actions.push(act);
        Array.prototype.push.apply(nodes, node.args);
      }
    }
  } catch (exc) {
    debug(`exception parsing (${exc})`);
  }

  if (typeof cb == "function") {
    cb(null, hasLiteral);
  }
  return hasLiteral;
};

module.exports = {
  plugin,
  onCondition,
};

//CC001 | Literals in Conditionals
