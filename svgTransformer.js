/**
 * Metro transformer that turns an imported .svg file into a component
 * (react-native-svg), then hands everything to Expo's normal transformer.
 *
 * Same idea as react-native-svg-transformer, which can't find Expo's
 * transformer in this Expo version (it's nested under expo/node_modules).
 */
const path = require('path');
const {transform: svgr} = require('@svgr/core');

const expoTransformer = require(
  require.resolve('@expo/metro-config/babel-transformer', {
    paths: [path.dirname(require.resolve('expo/metro-config'))],
  }),
);

const svgrConfig = {
  native: true,
  plugins: ['@svgr/plugin-svgo', '@svgr/plugin-jsx'],
  svgoConfig: {
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            // Keep the files' viewBox and colors exactly as exported from Figma.
            removeViewBox: false,
            removeUnknownsAndDefaults: false,
            convertColors: false,
            inlineStyles: {onlyMatchedOnce: false},
          },
        },
      },
      // Figma exports style="display: block", which React Native doesn't
      // support (only flex/none).
      {name: 'removeAttrs', params: {attrs: 'svg:style'}},
    ],
  },
};

module.exports.transform = async ({src, filename, ...rest}) => {
  if (filename.endsWith('.svg')) {
    const code = await svgr(src, svgrConfig, {filePath: filename});
    return expoTransformer.transform({src: code, filename, ...rest});
  }
  return expoTransformer.transform({src, filename, ...rest});
};
