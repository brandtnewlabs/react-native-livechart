import { render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";

import { ChartOverlayLayer } from "../../src/components/ChartOverlayLayer";
import type { ChartOverlayContext } from "../../src/types";

// ChartOverlayLayer only forwards the context to `render`; a minimal stub is fine.
const context = {
  scale: {
    value: {
      min: 0,
      max: 100,
      window: 30,
      now: 0,
      plot: { left: 12, top: 12, right: 320, bottom: 272, width: 400, height: 300 },
    },
  },
  priceToY: () => 0,
  yToPrice: () => 0,
  timeToX: () => 0,
  xToTime: () => 0,
} as unknown as ChartOverlayContext;

describe("ChartOverlayLayer", () => {
  it("mounts the element the consumer returns", () => {
    const { getByTestId } = render(
      <ChartOverlayLayer
        context={context}
        render={() => <Text testID="overlay">tag</Text>}
      />,
    );
    expect(getByTestId("overlay")).toBeTruthy();
  });

  it("passes the bridge context to the render callback", () => {
    const render_ = jest.fn(() => null);
    render(<ChartOverlayLayer context={context} render={render_} />);
    expect(render_).toHaveBeenCalledWith(context);
  });

  it("renders nothing when the callback returns null", () => {
    const { toJSON } = render(
      <ChartOverlayLayer context={context} render={() => null} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("renders nothing when the callback returns undefined", () => {
    const { toJSON } = render(
      <ChartOverlayLayer context={context} render={() => undefined} />,
    );
    expect(toJSON()).toBeNull();
  });
});
