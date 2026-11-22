import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing } from '../constants/theme';
import { t, StringKey } from '../i18n/en';
import { formatMoney, Currency } from '../shared/money';
import type { ProfitAndLoss, CurrencyTotals } from '../shared/farmFinance';

const KIND_KEY: Record<string, StringKey> = { expense: 'plKindExpense', input: 'plKindInput', activity: 'plKindActivity' };

const Block: React.FC<{ totals: CurrencyTotals; currency: Currency; showHeading: boolean; estimate?: React.ReactNode }> = ({ totals, currency, showHeading, estimate }) => {
  const good = totals.isProfit;
  const tint = good ? Colors.primary : Colors.danger;
  const label = good ? t('plProfit') : t('plLoss');
  return (
    <View style={styles.block} accessible accessibilityLabel={`${currency}. ${label} ${formatMoney(Math.abs(totals.result), currency)}`}>
      {showHeading ? <Text style={styles.currency}>{currency === 'USD' ? 'US dollars (USD)' : 'Liberian dollars (LRD)'}</Text> : null}
      <View style={styles.resultRow}>
        <Ionicons name={good ? 'trending-up' : 'trending-down'} size={26} color={tint} />
        <Text style={[styles.label, { color: tint }]}>{label}</Text>
        <Text style={[styles.amount, { color: tint }]}>{formatMoney(Math.abs(totals.result), currency)}</Text>
      </View>
      <View style={styles.row}><Text style={styles.rowLabel}>{t('plMoneyIn')}</Text><Text style={styles.rowValue}>{formatMoney(totals.moneyIn, currency)}</Text></View>
      <View style={styles.row}><Text style={styles.rowLabel}>{t('plMoneyOut')}</Text><Text style={styles.rowValue}>{formatMoney(totals.moneyOut, currency)}</Text></View>
      {estimate}
    </View>
  );
};

/** One line of a breakdown: what it is, when and where, and the amount in its own currency. */
const Line: React.FC<{ title: string; sub: string; amount: string; tag?: string; negative?: boolean }> = ({ title, sub, amount, tag, negative }) => (
  <View style={styles.line} accessible accessibilityLabel={`${title}. ${sub}. ${amount}${tag ? `. ${tag}` : ''}`}>
    <View style={{ flex: 1 }}>
      <Text style={styles.lineTitle}>{title}</Text>
      <Text style={styles.lineSub}>{sub}</Text>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={[styles.lineAmount, negative && { color: Colors.danger }]}>{amount}</Text>
      {tag ? <Text style={styles.lineTag}>{tag}</Text> : null}
    </View>
  </View>
);

/**
 * Profit or loss in words, an icon and a colour (never colour alone). US dollars and Liberian dollars are
 * shown one under the other, each with its own total; they are never added together. "Show details" lists
 * each farm, each harvest that makes up the money in, and each cost that makes up the money out.
 */
export const ProfitLossCard: React.FC<{ pl: ProfitAndLoss; title?: string; farmNames?: Record<string, string> }> = ({ pl, title, farmNames = {} }) => {
  const [open, setOpen] = useState(false);
  const both = pl.usd.hasData && pl.lrd.hasData;
  const lrdOnly = !pl.usd.hasData && pl.lrd.hasData;
  const farmName = (id: string) => farmNames[id] || t('plUnknownFarm');
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title || t('plTitle')}</Text>
      {!pl.hasData ? (
        <Text style={styles.muted}>{t('plEmpty')}</Text>
      ) : (
        <>
          {!lrdOnly ? (
            <Block
              totals={pl.usd}
              currency="USD"
              showHeading={both}
              estimate={pl.estimatedCount > 0 ? <Text style={styles.note}>{t('plEstimate', { count: pl.estimatedCount, amount: pl.usd.estimatedIn.toFixed(2) })}</Text> : null}
            />
          ) : null}
          {pl.lrd.hasData ? <Block totals={pl.lrd} currency="LRD" showHeading={both || lrdOnly} /> : null}
          {both ? <Text style={styles.note}>{t('plTwoCurrencies')}</Text> : null}

          <TouchableOpacity style={styles.toggle} onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }}>
            <Text style={styles.toggleText}>{open ? t('plHideDetails') : t('plShowDetails')}</Text>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.primary} />
          </TouchableOpacity>

          {open ? (
            <View>
              {pl.farms.length > 1 ? (
                <>
                  <Text style={styles.section}>{t('plByFarm')}</Text>
                  {pl.farms.map((f) =>
                    (['usd', 'lrd'] as const)
                      .filter((c) => f[c].hasData)
                      .map((c) => (
                        <Line
                          key={`${f.farmId}-${c}`}
                          title={farmName(f.farmId)}
                          sub={`${t('plMoneyIn')}: ${formatMoney(f[c].moneyIn, c.toUpperCase() as Currency)} · ${t('plMoneyOut')}: ${formatMoney(f[c].moneyOut, c.toUpperCase() as Currency)}`}
                          amount={`${f[c].isProfit ? t('plProfit') : t('plLoss')} ${formatMoney(Math.abs(f[c].result), c.toUpperCase() as Currency)}`}
                          negative={!f[c].isProfit}
                        />
                      ))
                  )}
                </>
              ) : null}

              <Text style={styles.section}>{t('plHarvestsIn')}</Text>
              {pl.harvestLines.length === 0 ? <Text style={styles.muted}>{t('plNoHarvests')}</Text> : null}
              {pl.harvestLines.map((h) => (
                <Line
                  key={h.id}
                  title={[h.crop, h.reference].filter(Boolean).join(' · ') || t('plHarvestsIn')}
                  sub={[h.date, `${h.quantity.toLocaleString()} ${h.unit || ''}`.trim(), farmName(h.farmId)].filter(Boolean).join(' · ')}
                  amount={formatMoney(h.amount, h.currency)}
                  tag={h.estimated ? t('plEstimatedTag') : undefined}
                />
              ))}

              <Text style={styles.section}>{t('plCostsOut')}</Text>
              {pl.costLines.length === 0 ? <Text style={styles.muted}>{t('plNoCosts')}</Text> : null}
              {pl.costLines.map((c) => (
                <Line
                  key={`${c.kind}-${c.id}`}
                  title={c.detail ? `${c.label} · ${c.detail}` : c.label}
                  sub={[c.date, t(KIND_KEY[c.kind]), farmName(c.farmId)].filter(Boolean).join(' · ')}
                  amount={formatMoney(c.amount, c.currency)}
                />
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.card, borderRadius: Radius.card, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginTop: Spacing.lg },
  title: { fontSize: 18, fontWeight: '800', color: Colors.text },
  muted: { fontSize: 14, color: Colors.textMuted, marginTop: 6 },
  block: { marginTop: Spacing.sm },
  currency: { fontSize: 13, fontWeight: '800', color: Colors.primaryDark, marginTop: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: Spacing.sm },
  label: { fontSize: 18, fontWeight: '800' },
  amount: { fontSize: 24, fontWeight: '800', marginLeft: 'auto' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  rowLabel: { fontSize: 14, color: Colors.textMuted },
  rowValue: { fontSize: 14, fontWeight: '700', color: Colors.text },
  note: { fontSize: 12, color: Colors.textMuted, marginTop: 6, lineHeight: 17 },
  toggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  toggleText: { fontSize: 14, fontWeight: '800', color: Colors.primary, flex: 1 },
  section: { fontSize: 15, fontWeight: '800', color: Colors.text, marginTop: Spacing.md, marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  lineTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  lineSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  lineAmount: { fontSize: 14, fontWeight: '800', color: Colors.text },
  lineTag: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
});
