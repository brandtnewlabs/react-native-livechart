describe("MONO_FONT_FAMILY", () => {
  const load = (os: string) => {
    jest.resetModules();
    jest.doMock("react-native", () => ({
      Platform: {
        OS: os,
        select: (spec: { ios?: string; default?: string }) =>
          spec.ios !== undefined && os === "ios" ? spec.ios : spec.default,
      },
    }));
    return require("../src/lib/monoFontFamily").MONO_FONT_FAMILY as string;
  };

  it("uses Menlo on iOS", () => {
    expect(load("ios")).toBe("Menlo");
  });

  it("uses monospace on non-iOS", () => {
    expect(load("android")).toBe("monospace");
  });
});
