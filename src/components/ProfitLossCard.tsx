import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/theme';
import { t } from '../i18n/en';
import type { ProfitAndLoss } from '../shared/farmFinance';

const usd = (n: number) => `$${Math.abs(n).toFixed(2)}`;

/** Profit or loss in words, an icon and a colour (never colour alone). */
export const ProfitLossCard: React.FC<{ pl: ProfitAndLoss; title?: string }> = ({ pl, title }) => {
  const good = pl.isProfit;
  const tint = good ? Colors.primary : Colors.danger;
  const label = good ? t('plProfit') : t('plLoss');
  return (
    <View style={styles.card} accessible accessibilityLabel={pl.hasData ? `${label} ${usd(pl.result)}` : t('plEmpty')}>
      <Text style={styles.title}>{title || t('plTitle')}</Text>
      {!pl.hasData ? (
        <Text style={styles.muted}>{t('plEmpty')}</Text>
      ) : (
        <>
          <View style={styles.resultRow}>
            <Ionicons name={good ? 'trending-up' : 'trending-down'} size={26} color={tint} />
            <Text style={[styles.label, { color: tint }]}>{label}</Text>
            <Text style={[styles.amount, { color: tint }]}>{usd(pl.result)}</Text>
          </View>
          <View style={styles.row}><Text style={styles.rowLabel}>{t('plMoneyIn')}</Text><Text style={styles.rowValue}>{usd(pl.moneyIn)}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>{t('plMoneyOut')}</Text><Text style={styles.rowValue}>{usd(pl.moneyOut)}</Text></View>
          {pl.estimatedCount > 0 ? <Text style={styles.note}>{t('plEstimate', { count: pl.estimatedCount, amount: pl.estimatedIn.toFixed(2) })}</Text> : null}
          {pl.otherCurrencyEntries > 0 ? <Text style={styles.note}>{t('plOtherCurrency', { count: pl.otherCurrencyEntries })}</Text> : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 14, color: Colors.textMuted, marginTop: 6 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: Spacing.sm },
  label: { fontSize: 18, fontWeight: '800' },
  amount: { fontSize: 26, fontWeight: '800', marginLeft: 'auto' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: Colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  note: { fontSize: 12, color: Colors.textMuted, marginTop: 6, lineHeight: 17 },
});
