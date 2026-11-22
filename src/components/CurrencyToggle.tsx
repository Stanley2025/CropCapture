import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';
import { CURRENCIES, symbolOf, Currency } from '../shared/money';

/** Choose the currency of an amount: US dollars or Liberian dollars. */
export const CurrencyToggle: React.FC<{ value: Currency; onChange: (c: Currency) => void }> = ({ value, onChange }) => (
  <View style={styles.row} accessibilityRole="radiogroup">
    {CURRENCIES.map((c) => {
      const on = value === c;
      return (
        <TouchableOpacity
          key={c}
          style={[styles.btn, on && styles.btnOn]}
          onPress={() => onChange(c)}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          accessibilityLabel={c === 'USD' ? 'US dollars' : 'Liberian dollars'}
        >
          <Text style={[styles.text, on && styles.textOn]}>{`${c} (${symbolOf(c)})`}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  text: { fontSize: 13, fontWeight: '700', color: Colors.text },
  textOn: { color: '#FFFFFF' },
});
