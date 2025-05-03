module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      // 2) NativeWind's Babel transform must go here as a preset
      "nativewind/babel"
    ],
    plugins: [
      // Keep Reanimated plugin (order matters)
      "react-native-reanimated/plugin"
    ],
  };
};
