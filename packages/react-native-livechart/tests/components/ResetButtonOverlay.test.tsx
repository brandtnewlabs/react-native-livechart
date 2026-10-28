import { act, fireEvent, render } from "@testing-library/react-native";
import React from "react";
import { View } from "react-native";
import { useSharedValue, type SharedValue } from "react-native-reanimated";

import { ResetButtonOverlay } from "../../src/components/ResetButtonOverlay";
import { resolveResetButton } from "../../src/core/resolveConfig";
import type { ResetButtonRect } from "../../src/hooks/resetButtonLayout";
import { resolveTheme } from "../../src/theme";
import type { ResetButtonRenderProps } from "../../src/types";
import { getAllByHostType } from "../rntl14";

/** Flush the `scheduleOnRN` microtask behind the visibility mirror inside `act`. */
function flushScheduleOnRN() {
  return act(async () => {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

/** JS-side writes don't round-trip through real shared values under Jest. */
function shared<T>(value: T) {
  return {
    value,
    get() {
      return this.value;
    },
    set(next: T) {
      this.value = next;
    },
  } as SharedValue<T>;
}

const hidden = { includeHiddenElements: true };

function Harness({
  config = resolveResetButton({ accessibilityLabel: "Reset chart" })!,
  visible = true,
  reset = () => {},
  render: renderButton,
  measuredWidth = shared(0),
  measuredHeight = shared(0),
}: {
  config?: NonNullable<ReturnType<typeof resolveResetButton>>;
  visible?: boolean;
  reset?: () => void;
  render?: (props: ResetButtonRenderProps) => React.ReactElement;
  measuredWidth?: SharedValue<number>;
  measuredHeight?: SharedValue<number>;
}) {
  const visibleSV = useSharedValue(visible);
  const rect = useSharedValue<ResetButtonRect>({ x: 154, y: 192, width: 36, height: 36 });
  return (
    <ResetButtonOverlay
      config={config}
      visible={visibleSV}
      rect={rect}
      measuredWidth={measuredWidth}
      measuredHeight={measuredHeight}
      reset={reset}
      render={renderButton}
      palette={resolveTheme("#3b82f6", "dark")}
      fontFamily="monospace"
    />
  );
}

describe("ResetButtonOverlay", () => {
  it("renders the built-in glyph button with its accessibility label and reset", async () => {
    const reset = jest.fn();
    const screen = await render(<Harness reset={reset} />);
    await flushScheduleOnRN();
    expect(screen.getByText("↺", hidden)).toBeTruthy();
    const button = screen.getByLabelText("Reset chart", hidden);
    await fireEvent(button, "accessibilityTap");
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("applies the configured look to the built-in button", async () => {
    const config = resolveResetButton({
      icon: "R",
      size: 48,
      color: "#111111",
      iconColor: "#eeeeee",
      accessibilityLabel: "Reset chart",
    })!;
    const screen = await render(<Harness config={config} />);
    await flushScheduleOnRN();
    const glyph = screen.getByText("R", hidden);
    expect(glyph.props.style).toEqual(
      expect.objectContaining({ color: "#eeeeee", fontSize: 24, fontFamily: "monospace" }),
    );
    const button = screen.getByLabelText("Reset chart", hidden);
    expect(button.props.style).toEqual(
      expect.objectContaining({ width: 48, height: 48, borderRadius: 24, backgroundColor: "#111111" }),
    );
  });

  it("hands a custom visual the visibility and reset, and measures it", async () => {
    const reset = jest.fn();
    const renderButton = jest.fn((props: ResetButtonRenderProps) => (
      <View testID="custom-reset" onAccessibilityTap={props.reset} />
    ));
    const measuredWidth = shared(0);
    const measuredHeight = shared(0);
    const screen = await render(
      <Harness
        reset={reset}
        render={renderButton}
        measuredWidth={measuredWidth}
        measuredHeight={measuredHeight}
      />,
    );
    await flushScheduleOnRN();
    expect(screen.getByTestId("custom-reset", hidden)).toBeTruthy();
    expect(screen.queryByText("↺", hidden)).toBeNull();
    expect(renderButton).toHaveBeenCalledWith(
      expect.objectContaining({ reset: expect.any(Function), visible: expect.anything() }),
    );
    await fireEvent(screen.getByTestId("custom-reset", hidden), "accessibilityTap");
    expect(reset).toHaveBeenCalledTimes(1);

    const wrapper = getAllByHostType(screen, View)[0];
    await fireEvent(wrapper, "layout", { nativeEvent: { layout: { width: 44, height: 40 } } });
    expect(measuredWidth.get()).toBe(44);
    expect(measuredHeight.get()).toBe(40);
  });

  it("takes a hidden button out of the touch and accessibility trees", async () => {
    const screen = await render(<Harness visible={false} />);
    await flushScheduleOnRN();
    const wrapper = getAllByHostType(screen, View)[0];
    expect(wrapper.props.pointerEvents).toBe("none");
    expect(wrapper.props.accessibilityElementsHidden).toBe(true);
    expect(wrapper.props.importantForAccessibility).toBe("no-hide-descendants");

    const shown = await render(<Harness visible />);
    await flushScheduleOnRN();
    const shownWrapper = getAllByHostType(shown, View)[0];
    expect(shownWrapper.props.pointerEvents).toBe("box-none");
    expect(shownWrapper.props.accessibilityElementsHidden).toBe(false);
  });
});
