/* global jest */
const reactNative = require("react-native");

if (reactNative.TurboModuleRegistry == null) {
  Object.defineProperty(reactNative, "TurboModuleRegistry", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: {
      get: () => ({
        installTurboModule: () => { },
      }),
    },
  });
}

const serializableStub = () => ({});
global.__workletsModuleProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      const key = String(prop);
      return (...args) => {
        if (key === "getStaticFeatureFlag") {
          return false;
        }
        if (
          key === "setDynamicFeatureFlag" ||
          key === "registerCustomSerializable"
        ) {
          return undefined;
        }
        if (key.startsWith("synchronizable")) {
          return args[1];
        }
        if (
          key.startsWith("create") ||
          key === "scheduleOnUI" ||
          key === "executeOnUIRuntimeSync" ||
          key === "scheduleOnRuntime"
        ) {
          return serializableStub();
        }
        if (key === "reportFatalErrorOnJS") {
          return undefined;
        }
        return undefined;
      };
    },
  },
);

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
    addRect: jest.fn(),
    reset: jest.fn(),
    rewind: jest.fn(),
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
    DashPathEffect: View,
    LinearGradient: View,
    vec: (x, y) => ({ x, y }),
    matchFont: jest.fn(() => mockFont),
    useFont: jest.fn(() => mockFont),
    useFonts: jest.fn(() => null),
    Skia: {
      Path: {
        Make: jest.fn(() => createPath()),
      },
      FontMgr: {
        System: jest.fn(() => ({})),
      },
    },
  };
});
