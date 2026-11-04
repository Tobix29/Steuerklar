import { Children, Fragment, isValidElement, useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { formatMoneyInput, parseMoney } from "~/lib/format";
import { font, radius, useColors } from "~/lib/theme";

const tap = () => {
  if (Platform.OS !== "web") void Haptics.selectionAsync().catch(() => {});
};

/* ---------- Layout ---------- */

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  title,
  webTitle,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Großer Titel im Inhalt (für Screens ohne nativen Header, z. B. Login) */
  title?: string;
  /** Titel nur in der Web-Vorschau (nativ übernimmt der Large-Title-Header) */
  webTitle?: string;
}) {
  const c = useColors();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={styles.screen}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} /> : undefined}
    >
      {(title ?? (Platform.OS === "web" ? webTitle : undefined)) && (
        <Text style={[styles.largeTitle, { color: c.text }]} accessibilityRole="header">
          {title ?? webTitle}
        </Text>
      )}
      {children}
    </ScrollView>
  );
}

export function Section({ title, footer, children, style }: { title?: string; footer?: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={[styles.section, style]}>
      {title && <Text style={[styles.sectionTitle, { color: c.muted }]}>{title.toUpperCase()}</Text>}
      <View style={[styles.group, { backgroundColor: c.surface }]}>
        {items.map((child, i) => (
          <Fragment key={isValidElement(child) && child.key != null ? child.key : i}>
            {i > 0 && <View style={[styles.sep, { backgroundColor: c.hairline }]} />}
            {child}
          </Fragment>
        ))}
      </View>
      {footer && <Text style={[styles.sectionFooter, { color: c.muted }]}>{footer}</Text>}
    </View>
  );
}

export function Row({
  label,
  sublabel,
  value,
  right,
  onPress,
  chevron,
  icon,
  strong,
  valueColor,
  destructive,
}: {
  label: string;
  sublabel?: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  icon?: string;
  strong?: boolean;
  valueColor?: string;
  destructive?: boolean;
}) {
  const c = useColors();
  const content = (
    <View style={styles.row}>
      {icon && (
        <View style={[styles.iconTile, { backgroundColor: c.surface2 }]}>
          <Text style={{ fontSize: 17 }}>{icon}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: destructive ? c.red : c.text, fontWeight: strong ? "600" : "400" }]} numberOfLines={2}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={3}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      {value !== undefined && (
        <Text style={[styles.rowValue, { color: valueColor ?? (strong ? c.text : c.muted), fontWeight: strong ? "600" : "400" }]}>{value}</Text>
      )}
      {right}
      {chevron && <Text style={[styles.chevron, { color: c.muted }]}>›</Text>}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => (pressed ? { backgroundColor: c.hairline } : undefined)}>
      {content}
    </Pressable>
  );
}

/* ---------- Eingaben ---------- */

export function TextRow({ label, value, onChangeText, ...rest }: { label: string; value: string; onChangeText: (t: string) => void } & TextInputProps) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: c.text, flexShrink: 0, minWidth: 96 }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={c.muted}
        style={[styles.inlineInput, { color: c.text }]}
        accessibilityLabel={label}
        {...rest}
      />
    </View>
  );
}

export function MoneyRow({ label, sublabel, value, onChange, editable = true }: { label: string; sublabel?: string; value: number; onChange: (v: number) => void; editable?: boolean }) {
  const c = useColors();
  const [text, setText] = useState(formatMoneyInput(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setText(formatMoneyInput(value));
  }, [value, focus]);
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.rowSub, { color: c.muted }]}>{sublabel}</Text> : null}
      </View>
      <TextInput
        value={text}
        editable={editable}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          setText(formatMoneyInput(value));
        }}
        onChangeText={(t) => {
          setText(t);
          onChange(parseMoney(t));
        }}
        keyboardType="decimal-pad"
        placeholder="0,00"
        placeholderTextColor={c.muted}
        style={[styles.inlineInput, styles.num, { color: editable ? c.text : c.muted, maxWidth: 150 }]}
        accessibilityLabel={label}
      />
      <Text style={{ color: c.muted, fontSize: 17 }}>€</Text>
    </View>
  );
}

export function NumberRow({ label, sublabel, value, onChange, max = 366, suffix, editable = true }: { label: string; sublabel?: string; value: number; onChange: (v: number) => void; max?: number; suffix?: string; editable?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.rowSub, { color: c.muted }]}>{sublabel}</Text> : null}
      </View>
      <TextInput
        value={value ? String(value) : ""}
        onChangeText={(t) => {
          const n = Number(t.replace(/[^\d]/g, ""));
          onChange(Math.min(max, Number.isFinite(n) ? n : 0));
        }}
        keyboardType="number-pad"
        editable={editable}
        placeholder="0"
        placeholderTextColor={c.muted}
        style={[styles.inlineInput, styles.num, { color: editable ? c.text : c.muted, maxWidth: 90 }]}
        accessibilityLabel={label}
      />
      {suffix && <Text style={{ color: c.muted, fontSize: 17 }}>{suffix}</Text>}
    </View>
  );
}

export function SwitchRow({ label, sublabel, value, onValueChange, disabled }: { label: string; sublabel?: string; value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: c.text }]}>{label}</Text>
        {sublabel ? <Text style={[styles.rowSub, { color: c.muted }]}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          tap();
          onValueChange(v);
        }}
        trackColor={{ true: "#34c759", false: c.hairline }}
        thumbColor={Platform.OS === "ios" ? undefined : "#ffffff"}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Segmented<T extends string | number>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surface2 }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: c.surface, ...shadow }]}
          >
            <Text style={{ color: c.text, fontSize: 14, fontWeight: on ? "600" : "500" }} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({ label, help, ...props }: { label: string; help?: string } & TextInputProps) {
  const c = useColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: c.text2, fontSize: 14, fontWeight: "500" }}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted}
        style={[styles.field, { backgroundColor: c.surface, color: c.text, borderColor: c.hairline }]}
        accessibilityLabel={label}
        {...props}
      />
      {help && <Text style={{ color: c.muted, fontSize: 13 }}>{help}</Text>}
    </View>
  );
}

/* ---------- Aktionen & Status ---------- */

type Variant = "primary" | "secondary" | "danger" | "ghost";

export function Button({ title, onPress, variant = "primary", loading, disabled, style }: { title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg: Record<Variant, string> = { primary: c.accent, secondary: c.surface2, danger: c.redSoft, ghost: "transparent" };
  const fg: Record<Variant, string> = { primary: c.onAccent, secondary: c.text, danger: c.red, ghost: c.accent };
  const off = disabled || loading;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [styles.button, { backgroundColor: bg[variant], opacity: off ? 0.45 : pressed ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg[variant]} /> : <Text style={[styles.buttonText, { color: fg[variant] }]}>{title}</Text>}
    </Pressable>
  );
}

export function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "green" | "orange" | "red" | "blue" }) {
  const c = useColors();
  const map = {
    neutral: [c.surface2, c.text2],
    green: [c.greenSoft, c.green],
    orange: [c.orangeSoft, c.orange],
    red: [c.redSoft, c.red],
    blue: [c.accentSoft, c.accent],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "600" }}>{text}</Text>
    </View>
  );
}

export function Notice({ text, tone = "neutral", icon }: { text: string; tone?: "neutral" | "orange" | "red" | "blue" | "green"; icon?: string }) {
  const c = useColors();
  const bg = { neutral: c.surface, orange: c.orangeSoft, red: c.redSoft, blue: c.accentSoft, green: c.greenSoft }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole={tone === "red" ? "alert" : undefined}>
      {icon && <Text style={{ fontSize: 15 }}>{icon}</Text>}
      <Text style={{ flex: 1, color: tone === "red" ? c.red : c.text, fontSize: 15, lineHeight: 21 }}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface }, style]}>{children}</View>;
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: 40 }}>
      <ActivityIndicator color={c.muted} />
    </View>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        tap();
        onChange(!checked);
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}
    >
      <View style={[styles.checkbox, { borderColor: checked ? c.accent : c.hairline, backgroundColor: checked ? c.accent : "transparent" }]}>
        {checked && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}
      </View>
      <Text style={{ flex: 1, color: c.text2, fontSize: 14, lineHeight: 20 }}>{label}</Text>
    </Pressable>
  );
}

export function useTextStyles() {
  const c = useColors();
  return {
    eyebrow: { color: c.accent, fontSize: 13, fontWeight: "600" as const },
    title2: { color: c.text, fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
    body: { color: c.text, fontSize: 17, lineHeight: 23 },
    muted: { color: c.muted, fontSize: 15, lineHeight: 21 },
    big: { fontSize: 52, fontWeight: "700" as const, letterSpacing: -1.5, fontVariant: ["tabular-nums" as const] },
  };
}

const shadow = Platform.select<ViewStyle>({
  ios: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  android: { elevation: 2 },
  default: { boxShadow: "0 2px 6px rgba(0,0,0,0.12)" } as ViewStyle,
});

const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, gap: 22 },
  largeTitle: { fontSize: 34, fontWeight: "700", letterSpacing: -0.8, marginTop: 8, fontFamily: font.family },
  section: { gap: 6 },
  sectionTitle: { fontSize: 13, marginLeft: 16, letterSpacing: 0.2 },
  sectionFooter: { fontSize: 13, marginHorizontal: 16, lineHeight: 18 },
  group: { borderRadius: radius.md, overflow: "hidden" },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48 },
  rowLabel: { fontSize: 17, letterSpacing: -0.2 },
  rowSub: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  rowValue: { fontSize: 17, fontVariant: ["tabular-nums"], textAlign: "right" },
  chevron: { fontSize: 22, marginLeft: -4 },
  iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  inlineInput: { flex: 1, fontSize: 17, textAlign: "right", paddingVertical: 4, minWidth: 60 },
  num: { fontVariant: ["tabular-nums"] },
  segmented: { flexDirection: "row", borderRadius: 9, padding: 2, gap: 2 },
  segment: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 7 },
  field: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, fontSize: 17 },
  button: { minHeight: 50, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 22 },
  buttonText: { fontSize: 17, fontWeight: "600" },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, alignSelf: "center" },
  notice: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14 },
  card: { borderRadius: radius.lg, padding: 22 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 1 },
});

/** Auswahl-Zeile im Einstellungen-Stil: tippen klappt die Optionen auf. */
export function ChoiceRow<T extends string>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "–";
  return (
    <View>
      <Row label={label} value={current} chevron={!disabled} onPress={disabled ? undefined : () => setOpen((o) => !o)} />
      {open &&
        options.map((o) => (
          <Pressable
            key={o.value}
            onPress={() => {
              tap();
              onChange(o.value);
              setOpen(false);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: o.value === value }}
            style={({ pressed }) => [{ flexDirection: "row", alignItems: "center", paddingVertical: 11, paddingLeft: 32, paddingRight: 16 }, pressed && { backgroundColor: c.hairline }]}
          >
            <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{o.label}</Text>
            {o.value === value && <Text style={{ color: c.accent, fontSize: 17, fontWeight: "600" }}>✓</Text>}
          </Pressable>
        ))}
    </View>
  );
}
