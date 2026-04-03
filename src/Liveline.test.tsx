import { fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { Liveline } from "./Liveline";

function Harness(
  props: Partial<React.ComponentProps<typeof Liveline>>,
) {
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
      <Harness
        formatValue={(v) => v.toFixed(4)}
        formatTime={() => "x"}
      />,
    );
  });
});
