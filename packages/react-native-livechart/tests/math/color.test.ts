import { hexToRgb, lerpColor } from "../../src/math/color";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#3b82f6")).toEqual([59, 130, 246]);
  });

  it("parses 3-digit hex", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
  });

  it("parses black", () => {
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("returns fallback for invalid input", () => {
    expect(hexToRgb("")).toEqual([128, 128, 128]);
  });
});

describe("lerpColor", () => {
  it("returns a at t=0", () => {
    expect(lerpColor([0, 0, 0], [255, 255, 255], 0)).toBe("rgb(0,0,0)");
  });

  it("returns b at t=1", () => {
    expect(lerpColor([0, 0, 0], [255, 255, 255], 1)).toBe("rgb(255,255,255)");
  });

  it("interpolates at t=0.5", () => {
    expect(lerpColor([0, 0, 0], [200, 100, 50], 0.5)).toBe("rgb(100,50,25)");
  });
});
