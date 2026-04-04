import { fireEvent, render } from "@testing-library/react-native";

import { Liveline } from "./Liveline";
import React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

function Harness(props: Partial<React.ComponentProps<typeof Liveline>>) {
  const data = useSharedValue([{ time: 1700000000, value: 50 }]);
  const value = useSharedValue(50);
  return <Liveline data={data} value={value} {...props} />;
}

describe("Liveline", () => {
  it("renders with defaults", () => {
    const screen = render(<Harness />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("supports fill off and overlays off", () => {
    render(<Harness fill={false} grid={false} badge={false} />);
  });

  it("uses custom background and padding", () => {
    render(
      <Harness
        backgroundColor="#111111"
        padding={{ top: 4, bottom: 4 }}
        referenceLine={{ value: 40 }}
      />,
    );
  });

  it("accepts custom formatters", () => {
    render(
      <Harness formatValue={(v) => v.toFixed(4)} formatTime={() => "x"} />,
    );
  });

  it("renders with scrub enabled", () => {
    const screen = render(<Harness scrub scrubTooltip />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders in loading state", () => {
    const screen = render(<Harness loading />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("renders loading state without layout (zero canvas size)", () => {
    render(<Harness loading />);
  });

  it("renders with paused=true", () => {
    render(<Harness paused />);
  });

  it("renders with valueLine enabled", () => {
    render(<Harness valueLine />);
  });
});
