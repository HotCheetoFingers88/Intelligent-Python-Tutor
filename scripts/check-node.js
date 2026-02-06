#!/usr/bin/env node

var required = { major: 20, minor: 9, patch: 0 };
var current = process.versions.node.split('.').map(function (n) {
  return parseInt(n, 10);
});

function isLowerThan(a, b) {
  if (a[0] !== b[0]) return a[0] < b[0];
  if (a[1] !== b[1]) return a[1] < b[1];
  return a[2] < b[2];
}

if (isLowerThan(current, [required.major, required.minor, required.patch])) {
  console.error("");
  console.error(
    "Error: Node.js " +
      required.major +
      "." +
      required.minor +
      "." +
      required.patch +
      " or newer is required."
  );
  console.error("You are using Node.js " + process.versions.node + ".");
  console.error("Please upgrade Node.js, then reinstall dependencies.");
  process.exit(1);
}
