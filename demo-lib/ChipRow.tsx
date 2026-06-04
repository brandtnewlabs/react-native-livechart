import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { demoStyles } from "./styles";

/**
 * Shared control primitives for the demo screens.
 *
 * Every demo used to hand-inline the same
 * `<Pressable style={[chip, active && chipActive]}><Text .../></Pressable>`
 * block. These four pieces replace that boilerplate:
 *
 * - `Chip`       — one pressable pill (the atom).
 * - `ChipRow`    — a labeled single-select segmented control (the common case).
 * - `ToggleChip` — one independent on/off pill.
 * - `ControlRow` — a labeled row wrapper for mixing toggles / custom chips.
 */

/** One pressable pill. */
export function Chip({
  label,
  active,
  onPress,
  disabled,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={[
        demoStyles.chip,
        active && demoStyles.chipActive,
        disabled && demoStyles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[demoStyles.chipText, active && demoStyles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A labeled row wrapper. Use it to group `ToggleChip`s or custom `Chip`s. */
export function ControlRow({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <>
      {label ? <Text style={demoStyles.sectionLabel}>{label}</Text> : null}
      <View style={demoStyles.buttonRow}>{children}</View>
    </>
  );
}

/** A single on/off pill bound to a boolean. */
export function ToggleChip({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return <Chip label={label} active={value} onPress={() => onChange(!value)} />;
}

/**
 * A labeled single-select segmented control.
 *
 * Values may be any type; selection is compared with `===` by default. Pass
 * `equals` for object values. Example:
 *
 *   <ChipRow
 *     label="Badge"
 *     options={[{ value: "on", label: "Default" }, { value: "off", label: "Off" }]}
 *     value={badgeMode}
 *     onChange={setBadgeMode}
 *   />
 */
export function ChipRow<T>({
  label,
  options,
  value,
  onChange,
  equals,
}: {
  label?: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  equals?: (a: T, b: T) => boolean;
}) {
  const eq = equals ?? ((a: T, b: T) => a === b);
  return (
    <ControlRow label={label}>
      {options.map((opt) => (
        <Chip
          key={String(opt.value)}
          label={opt.label}
          active={eq(opt.value, value)}
          onPress={() => onChange(opt.value)}
        />
      ))}
    </ControlRow>
  );
}
