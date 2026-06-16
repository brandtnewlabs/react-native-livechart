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

  // Mutable builder → immutable SkPath (build/detach return a mock path).
  const createPathBuilder = () => {
    const b = {
      moveTo: jest.fn(() => b),
      lineTo: jest.fn(() => b),
      quadTo: jest.fn(() => b),
      conicTo: jest.fn(() => b),
      cubicTo: jest.fn(() => b),
      close: jest.fn(() => b),
      addRect: jest.fn(() => b),
      addRRect: jest.fn(() => b),
      addOval: jest.fn(() => b),
      addCircle: jest.fn(() => b),
      addPath: jest.fn(() => b),
      addPoly: jest.fn(() => b),
      arcToOval: jest.fn(() => b),
      setFillType: jest.fn(() => b),
      setIsVolatile: jest.fn(() => b),
      offset: jest.fn(() => b),
      transform: jest.fn(() => b),
      reset: jest.fn(() => b),
      computeBounds: jest.fn(() => ({ x: 0, y: 0, width: 0, height: 0 })),
      isEmpty: jest.fn(() => true),
      countPoints: jest.fn(() => 0),
      build: jest.fn(() => createPath()),
      detach: jest.fn(() => createPath()),
    };
    return b;
  };

  const createCanvas = () => ({
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    drawCircle: jest.fn(),
    drawText: jest.fn(),
    drawPath: jest.fn(),
    drawImageRect: jest.fn(),
    drawImage: jest.fn(),
    clear: jest.fn(),
  });

  const createMockPaint = () => ({
    setAntiAlias: jest.fn(),
    setColor: jest.fn(),
    setStyle: jest.fn(),
    setStrokeWidth: jest.fn(),
    setStrokeCap: jest.fn(),
    setStrokeJoin: jest.fn(),
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
    Points: View,
    Shader: View,
    DashPathEffect: View,
    Blur: View,
    Image: View,
    Atlas: View,
    LinearGradient: View,
    vec: (x, y) => ({ x, y }),
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0, Round: 1, Square: 2 },
    StrokeJoin: { Miter: 0, Round: 1, Bevel: 2 },
    drawAsImageFromPicture: jest.fn(() => ({})),
    matchFont: jest.fn(() => mockFont),
    useFont: jest.fn(() => mockFont),
    useFonts: jest.fn(() => null),
    Skia: {
      Path: {
        Make: jest.fn(() => createPath()),
      },
      PathBuilder: {
        Make: jest.fn(() => createPathBuilder()),
        MakeFromPath: jest.fn(() => createPathBuilder()),
      },
      FontMgr: {
        System: jest.fn(() => ({})),
      },
      PictureRecorder: jest.fn(() => ({
        beginRecording: jest.fn(() => createCanvas()),
        finishRecordingAsPicture: jest.fn(() => ({})),
      })),
      RSXform: jest.fn((scos, ssin, tx, ty) => ({ scos, ssin, tx, ty })),
      XYWHRect: jest.fn((x, y, width, height) => ({ x, y, width, height })),
      Color: jest.fn((c) => c),
      Paint: jest.fn(() => createMockPaint()),
      RuntimeEffect: {
        Make: jest.fn(() => ({ source: jest.fn() })),
      },
    },
  };
});
