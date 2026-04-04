const { jest } = require("@jest/globals");
const reanimated = require("react-native-reanimated");
if (typeof reanimated.setUpTests === "function") {
  reanimated.setUpTests();
}

jest.mock("@shopify/react-native-skia", () => {
  const React = require("react");
  const { View } = require("react-native");

  const createPath = () => ({
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    cubicTo: jest.fn(),
    close: jest.fn(),
    arcToOval: jest.fn(),
    addRRect: jest.fn(),
  });

  const mockFont = {
    getSize: () => 12,
    measureText: (text) => ({
      x: 0,
      y: 0,
      width: String(text).length * 7,
      height: 12,
    }),
    getMetrics: () => ({ ascent: -9.6, descent: 2.4, leading: 0 }),
  };

  return {
    __esModule: true,
    Canvas: View,
    Circle: View,
    Group: View,
    Line: View,
    Rect: View,
    RoundedRect: View,
    Text: View,
    Path: ({ children, ...props }) =>
      React.createElement(View, props, children),
    LinearGradient: View,
    vec: (x, y) => ({ x, y }),
    matchFont: jest.fn(() => mockFont),
    Skia: {
      Path: {
        Make: jest.fn(() => createPath()),
      },
    },
  };
});
