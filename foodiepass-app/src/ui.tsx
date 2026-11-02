import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { C, T } from './theme';

type BtnProps = { title: string; onPress?: () => void; kind?: 'primary' | 'dark' | 'ghost' | 'ghostLight'; disabled?: boolean; busy?: boolean; style?: ViewStyle; accessibilityLabel?: string };

export function Button({ title, onPress, kind = 'primary', disabled, busy, style, accessibilityLabel }: BtnProps) {
  const bg = kind === 'primary' ? C.chili : kind === 'dark' ? C.bayou : 'transparent';
  const fg = kind === 'dark' || kind === 'ghostLight' ? C.linen : C.bayou;
  const border = kind === 'ghost' ? C.bayou : kind === 'ghostLight' ? C.mint : bg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!(disabled || busy) }}
      onPress={disabled || busy ? undefined : onPress}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.btnText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export const H1 = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => <Text accessibilityRole="header" style={[T.display, { fontSize: 34, lineHeight: 38 }, style]}>{children}</Text>;
export const Eyebrow = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => <Text style={[T.eyebrow, style]}>{children}</Text>;
export const Body = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => <Text style={[T.body, style]}>{children}</Text>;
export const Small = ({ children, style }: { children: React.ReactNode; style?: TextStyle }) => <Text style={[T.small, style]}>{children}</Text>;

export function Note({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'ok' | 'err' }) {
  const bg = tone === 'ok' ? C.okBg : tone === 'err' ? C.errBg : C.sand;
  const fg = tone === 'ok' ? '#1F4D35' : tone === 'err' ? C.err : C.ink2;
  return <View accessibilityRole={tone === 'err' ? 'alert' : undefined} style={[s.note, { backgroundColor: bg }]}><Text style={{ color: fg, fontSize: 15, lineHeight: 21 }}>{children}</Text></View>;
}

export const Card = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[s.card, style]}>{children}</View>;

const s = StyleSheet.create({
  btn: { minHeight: 52, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  btnText: { fontSize: 17, fontWeight: '700' },
  note: { borderRadius: 14, padding: 14 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 20, padding: 20, gap: 10 },
});
