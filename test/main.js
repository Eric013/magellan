/* eslint no-undef: 0, no-unused-expressions: 0 */
"use strict";
var expect = require("chai").expect;
var main = require("../src/main");

describe("main", function () {
  it("should have stuff", function () {
    expect(main.Reporter).to.not.be.null;
    expect(main.portUtil).to.not.be.null;
  });
});
