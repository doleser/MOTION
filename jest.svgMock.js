// Jest doesn't run the SVG transformer; draw nothing in its place.
module.exports = function SvgMock() {
  return null;
};
