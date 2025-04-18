/*
  Copyright 2019,2024 Google LLC

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

var xpath = require("xpath");

function HTTPProxyConnection(element, parent) {
  this.parent = parent;
  this.element = element;
}

HTTPProxyConnection.prototype.getName = function () {
  if (!this.name) {
    var attr = xpath.select("//@name", this.element);
    this.name = (attr[0] && attr[0].value) || "";
  }
  return this.name;
};

HTTPProxyConnection.prototype.getMessages = function () {
  return this.parent.getMessages();
};

HTTPProxyConnection.prototype.getLines = function (start, stop) {
  return this.parent.getLines(start, stop);
};

HTTPProxyConnection.prototype.getSource = function () {
  if (!this.source) {
    var start = this.element.lineNumber - 1,
      stop = this.element.nextSibling.lineNumber - 1;
    this.source = this.getLines(start, stop);
  }
  return this.source;
};

HTTPProxyConnection.prototype.getType = function () {
  return this.element.tagName;
};

HTTPProxyConnection.prototype.getBasePath = function () {
  if (!this.basePath) {
    var doc = xpath.select("./BasePath", this.element);
    if (doc && doc[0]) {
      this.basePath = (doc && doc[0] && doc[0].childNodes[0].nodeValue) || "";
    }
  }
  return this.basePath;
};

HTTPProxyConnection.prototype.getElement = function () {
  return this.element;
};

HTTPProxyConnection.prototype.getParent = function () {
  return this.parent;
};

HTTPProxyConnection.prototype.addMessage = function (msg) {
  if (!msg.hasOwnProperty("entity")) {
    msg.entity = this;
  }
  this.parent.addMessage(msg);
};

HTTPProxyConnection.prototype.getProperties = function () {
  if (this.properties == undefined) {
    let props = {};
    this.properties = props;
    let propsNodeList = xpath.select("./Properties", this.element);
    if (propsNodeList && propsNodeList[0]) {
      Array.from(propsNodeList[0].childNodes).forEach((prop) => {
        if (prop.childNodes && prop.attributes[0] && prop.childNodes[0]) {
          props[prop.attributes[0].nodeValue] = prop.childNodes[0].nodeValue;
        }
      });
    }
  }
  return this.properties;
};

HTTPProxyConnection.prototype.summarize = function () {
  // not sure this is ever used
  return {
    name: this.getName(),
    basePath: this.getBasePath(),
  };
};

//Public
module.exports = HTTPProxyConnection;
