import {
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

export interface LiveChartTransitionProps {
  /** Key of the active child to show. Must match a child's `key`. */
  active: string;
  /** Chart elements, each with a unique `key`. */
  children: ReactNode;
  /** Cross-fade duration in ms. Default `300`. */
  duration?: number;
  /**
   * Keep every child mounted for the lifetime of the transition (only the
   * opacity animates). Each chart's engine then settles its y-range once, up
   * front, so switching is a pure cross-fade with no reveal/range re-animation.
   * Costs more (all engines run continuously). Default `false` (mount the
   * active child + unmount the outgoing one after the fade).
   */
  keepMounted?: boolean;
  /** Container style. */
  style?: ViewStyle;
}

function FadeLayer({
  visible,
  duration,
  children,
}: {
  visible: boolean;
  duration: number;
  children: ReactNode;
}) {
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.set(withTiming(visible ? 1 : 0, { duration }));
  }, [visible, duration, opacity]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[StyleSheet.absoluteFill, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Cross-fades between chart instances by `key` (e.g. line ↔ candle). Mounts the
 * active child plus any outgoing child still fading out; unmounts the outgoing
 * child once the fade completes. RN/Reanimated analogue of liveline's
 * `LivelineTransition`.
 */
export function LiveChartTransition({
  active,
  children,
  duration = 300,
  keepMounted = false,
  style,
}: LiveChartTransitionProps) {
  // Use the raw children (not Children.toArray, which rewrites keys to ".$key").
  const childArray = (
    Array.isArray(children) ? children : [children]
  ).filter(isValidElement) as ReactElement[];

  const [mounted, setMounted] = useState<Set<string>>(() => new Set([active]));
  const prevRef = useRef(active);

  useEffect(() => {
    if (keepMounted) return;
    if (active === prevRef.current) return;
    const outgoing = prevRef.current;
    prevRef.current = active;
    setMounted((prev) => new Set([...prev, active]));
    const timer = setTimeout(() => {
      setMounted((prev) => {
        const next = new Set(prev);
        next.delete(outgoing);
        return next;
      });
    }, duration + 50);
    return () => clearTimeout(timer);
  }, [active, duration, keepMounted]);

  return (
    <View style={[styles.root, style]}>
      {childArray.map((child) => {
        const key = String(child.key ?? "");
        if (!keepMounted && !mounted.has(key)) return null;
        return (
          <FadeLayer key={key} visible={key === active} duration={duration}>
            {child}
          </FadeLayer>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, position: "relative" },
});
