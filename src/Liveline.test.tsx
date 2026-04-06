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

  it("supports gradient off and overlays off", () => {
    render(<Harness gradient={false} yAxis={false} badge={false} />);
  });

  it("uses custom insets and referenceLine", () => {
    render(
      <Harness
        style={{ backgroundColor: "#111111" }}
        insets={{ top: 4, bottom: 4 }}
        referenceLine={{ value: 40 }}
      />,
    );
  });

  it("accepts custom formatters", () => {
    render(
      <Harness formatValue={(v) => v.toFixed(4)} formatTime={() => "x"} />,
    );
  });

  it("renders with scrub enabled (default tooltip)", () => {
    const screen = render(<Harness scrub />);
    const views = screen.UNSAFE_getAllByType(View);
    fireEvent(views[0], "layout", {
      nativeEvent: { layout: { width: 400, height: 300 } },
    });
  });

  it("accepts config objects for badge, grid, scrub, valueLine", () => {
    render(
      <Harness
        badge={{ variant: "minimal", tail: false }}
        yAxis={{ minGap: 48 }}
        scrub={{ tooltip: false }}
        valueLine={{ strokeWidth: 2, intervals: [6, 3] }}
      />,
    );
  });

  it("accepts left-position badge", () => {
    render(<Harness badge={{ position: "left" }} yAxis={false} />);
  });

  it("accepts GradientConfig with custom opacities", () => {
    render(<Harness gradient={{ topOpacity: 0.3, bottomOpacity: 0.02 }} />);
  });

  it("accepts LineConfig with width and color override", () => {
    render(<Harness line={{ width: 3, color: "#ff0000" }} />);
  });

  it("accepts PulseConfig", () => {
    render(<Harness pulse={{ interval: 2000, maxRadius: 30 }} />);
  });

  it("disables timeAxis", () => {
    render(<Harness xAxis={false} />);
  });

  it("accepts visual config on referenceLine", () => {
    render(
      <Harness
        referenceLine={{ value: 40, strokeWidth: 2, color: "#ff0000" }}
      />,
    );
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

  it("accepts a custom font config", () => {
    render(
      <Harness
        font={{ fontFamily: "Courier", fontSize: 13, fontWeight: "700" }}
      />,
    );
  });
});
