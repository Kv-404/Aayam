// Metro must see ../shared and the site's pure helpers, which live outside this app folder.
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../shared"), path.resolve(__dirname, "../client/src/lib")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];

module.exports = config;
