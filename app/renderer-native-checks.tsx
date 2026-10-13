/** Internal checks for ordered atlas caching and imperative recording replay. */
import { useMemo, useRef, useState } from "react";
import { Button, Platform, StyleSheet, Text, View } from "react-native";
import {
  Canvas,
  Circle,
  matchFont,
  Skia,
  SkiaGraphiteView,
  Text as SkiaText,
  useCanvasRef,
  type SkGraphiteContext,
  type SkGraphiteRecording,
  type SkiaGraphiteViewRef,
} from "react-native-skia";
import {
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
} from "react-native-reanimated";

export default function RendererNativeChecksScreen() {
  const font = useMemo(
    () =>
      matchFont({
        fontSize: 16,
        fontFamily: Platform.OS === "android" ? "sans-serif" : "System",
      }),
    [],
  );
  const elapsed = useSharedValue(0);
  useFrameCallback((frame) => elapsed.set(frame.timeSinceFirstFrame / 1000));
  const cx = useDerivedValue(() => 140 + 50 * Math.sin(elapsed.get()));
  const label = useDerivedValue(
    () => `CACHED ${(100 + elapsed.get()).toFixed(1)}`,
  );
  const canvas = useCanvasRef();
  const imperative = useRef<SkiaGraphiteViewRef>(null);
  const context = useRef<SkGraphiteContext | null>(null);
  const first = useRef<SkGraphiteRecording | null>(null);
  const [highBitDepth, setHighBitDepth] = useState(false);
  const [large, setLarge] = useState(false);
  const [snapshot, setSnapshot] = useState("Snapshot not taken");
  const [replay, setReplay] = useState("No imperative recording");

  const draw = (initial: boolean) => {
    if (!imperative.current) return;
    const ctx = context.current ?? imperative.current.getContext();
    context.current = ctx;
    const target = ctx.beginRecording();
    target.clear(Skia.Color("#111827"));
    const paint = Skia.Paint();
    paint.setColor(Skia.Color(initial ? "#22c55e" : "#f97316"));
    target.drawCircle(140, 60, 24, paint);
    target.drawText(initial ? "FIRST 123" : "SECOND 456", 16, 120, paint, font);
    const recording = ctx.finishRecording();
    if (initial) first.current = recording;
    ctx.submit(recording);
    setReplay(initial ? "First submitted" : "Second submitted");
  };

  return (
    <View style={styles.root}>
      <Text style={styles.text}>NATIVE RECORDER CHECKS</Text>
      <Text style={styles.text}>
        Font glyphs:{" "}
        {font.getGlyphIDs("CACHED123").filter((glyph) => glyph !== 0).length}/9
      </Text>
      <Text style={styles.text}>
        Format: {highBitDepth ? "high" : "standard"}; size:{" "}
        {large ? "large" : "small"}
      </Text>
      <Canvas
        ref={canvas}
        style={{ height: large ? 220 : 160 }}
        opaque
        highBitDepth={highBitDepth}
      >
        <Circle cx={cx} cy={90} r={8} color="#22c55e" />
        <SkiaText x={16} y={40} text={label} font={font} color="white" />
      </Canvas>
      <Button
        title="Toggle format"
        onPress={() => setHighBitDepth((v) => !v)}
      />
      <Button title="Toggle size" onPress={() => setLarge((v) => !v)} />
      <Button
        title="Take snapshot"
        onPress={() => {
          const image = canvas.current?.makeImageSnapshot();
          if (image) setSnapshot(`Snapshot ${image.width()}x${image.height()}`);
        }}
      />
      <Text style={styles.text}>{snapshot}</Text>
      <SkiaGraphiteView ref={imperative} style={styles.imperative} />
      <Button title="Draw first" onPress={() => draw(true)} />
      <Button title="Draw second" onPress={() => draw(false)} />
      <Button
        title="Replay first"
        onPress={() => {
          if (context.current && first.current) {
            context.current.submit(first.current);
            setReplay("First replayed");
          }
        }}
      />
      <Text style={styles.text}>{replay}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 70,
    paddingHorizontal: 16,
    backgroundColor: "#0b0b12",
  },
  text: { color: "white", paddingVertical: 6 },
  imperative: { height: 140 },
});
