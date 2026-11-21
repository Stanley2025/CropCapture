import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Typography, Radius } from '../constants/theme';

interface DatePickerFieldProps {
  label?: string;
  value: string; // Format: YYYY-MM-DD
  onChange: (date: string) => void;
  helperText?: string;
  allowFuture?: boolean;
  mode?: 'default' | 'dob';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  label,
  value,
  onChange,
  helperText,
  mode = 'default',
}) => {
  const isDob = mode === 'dob';
  const [modalVisible, setModalVisible] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Parse initial date
  const parseDate = (dStr: string) => {
    if (!dStr) {
      if (isDob) {
        // Default to year 1990 for Date of Birth
        return new Date(1990, 0, 15);
      }
      return new Date();
    }
    const parts = dStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        return new Date(year, month, day);
      }
    }
    return isDob ? new Date(1990, 0, 15) : new Date();
  };

  const currentDateObj = parseDate(value);
  const [viewYear, setViewYear] = useState(currentDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDateObj.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState(
    value || (isDob ? '1990-01-15' : new Date().toISOString().split('T')[0])
  );

  const openPicker = () => {
    const d = parseDate(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setTempSelectedDate(
      value || (isDob ? '1990-01-15' : new Date().toISOString().split('T')[0])
    );
    setShowYearPicker(false);
    setModalVisible(true);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleQuickDecadeJump = (offsetYears: number) => {
    const newYear = viewYear + offsetYears;
    const currentYear = new Date().getFullYear();
    if (isDob && newYear > currentYear) return;
    setViewYear(newYear);
    const d = parseDate(tempSelectedDate);
    const iso = formatToISO(newYear, viewMonth, Math.min(d.getDate(), 28));
    setTempSelectedDate(iso);
  };

  const handleSelectYear = (selectedYear: number) => {
    setViewYear(selectedYear);
    const d = parseDate(tempSelectedDate);
    const iso = formatToISO(selectedYear, viewMonth, Math.min(d.getDate(), 28));
    setTempSelectedDate(iso);
    setShowYearPicker(false);
  };

  const formatToISO = (year: number, monthIndex: number, day: number) => {
    const yStr = String(year);
    const mStr = String(monthIndex + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${yStr}-${mStr}-${dStr}`;
  };

  const formatDisplay = (dStr: string) => {
    if (!dStr) return isDob ? 'Tap to choose birthdate' : 'Select date';
    const d = parseDate(dStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSelectDay = (day: number) => {
    const iso = formatToISO(viewYear, viewMonth, day);
    setTempSelectedDate(iso);
  };

  const handleConfirm = () => {
    onChange(tempSelectedDate);
    setModalVisible(false);
  };

  const handleSelectToday = () => {
    const today = new Date();
    const iso = today.toISOString().split('T')[0];
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setTempSelectedDate(iso);
  };

  const handleAddDays = (days: number) => {
    const base = parseDate(tempSelectedDate);
    base.setDate(base.getDate() + days);
    const iso = base.toISOString().split('T')[0];
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setTempSelectedDate(iso);
  };

  // Generate calendar days
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const todayISO = new Date().toISOString().split('T')[0];
  const maxYear = new Date().getFullYear();

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Generate list of selectable years for DOB (1940 to current year)
  const availableYears: number[] = [];
  const startYear = isDob ? 1940 : maxYear - 20;
  const endYear = isDob ? maxYear - 10 : maxYear + 5;
  for (let y = endYear; y >= startYear; y--) {
    availableYears.push(y);
  }

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        style={styles.fieldButton}
        activeOpacity={0.7}
        onPress={openPicker}
      >
        <View style={styles.iconCircle}>
          <Ionicons name="calendar" size={18} color={Colors.primary} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.dateDisplayText}>{formatDisplay(value)}</Text>
          <Text style={styles.isoText}>{value || 'YYYY-MM-DD (Calendar Picker)'}</Text>
        </View>

        <View style={styles.changeBadge}>
          <Text style={styles.changeBadgeText}>Select</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </View>
      </TouchableOpacity>

      {helperText ? <Text style={styles.helperText}>{helperText}</Text> : null}

      {/* Calendar Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {label || (isDob ? 'Select Date of Birth' : 'Select Date')}
                </Text>
                <Text style={styles.modalSubtitle}>{formatDisplay(tempSelectedDate)}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Quick Presets / Year Shortcuts */}
            {isDob ? (
              <View style={styles.presetsRow}>
                <TouchableOpacity
                  style={[styles.presetChip, showYearPicker && styles.presetChipActive]}
                  onPress={() => setShowYearPicker(!showYearPicker)}
                >
                  <Ionicons name="calendar-outline" size={12} color={showYearPicker ? '#FFFFFF' : Colors.primary} />
                  <Text style={[styles.presetText, showYearPicker && styles.presetTextActive]}>
                    {showYearPicker ? 'Close Year List' : 'Pick Year'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleQuickDecadeJump(-10)}
                >
                  <Text style={styles.presetText}>-10 Yrs</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleQuickDecadeJump(-1)}
                >
                  <Text style={styles.presetText}>-1 Yr</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleQuickDecadeJump(1)}
                >
                  <Text style={styles.presetText}>+1 Yr</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => handleQuickDecadeJump(10)}
                >
                  <Text style={styles.presetText}>+10 Yrs</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.presetsRow}>
                <TouchableOpacity style={styles.presetChip} onPress={handleSelectToday}>
                  <Text style={styles.presetText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => handleAddDays(7)}>
                  <Text style={styles.presetText}>+1 Wk</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => handleAddDays(30)}>
                  <Text style={styles.presetText}>+1 Mo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.presetChip} onPress={() => handleAddDays(90)}>
                  <Text style={styles.presetText}>+3 Mo (Harvest)</Text>
                </TouchableOpacity>
              </View>
            )}

            {showYearPicker ? (
              /* Fast Year Selection Grid */
              <View style={styles.yearPickerContainer}>
                <Text style={styles.yearPickerHeading}>Select Birth Year</Text>
                <ScrollView style={styles.yearScrollView} contentContainerStyle={styles.yearGrid}>
                  {availableYears.map((yr) => {
                    const isYearSelected = yr === viewYear;
                    return (
                      <TouchableOpacity
                        key={yr}
                        style={[
                          styles.yearGridItem,
                          isYearSelected && styles.yearGridItemSelected,
                        ]}
                        onPress={() => handleSelectYear(yr)}
                      >
                        <Text
                          style={[
                            styles.yearGridText,
                            isYearSelected && styles.yearGridTextSelected,
                          ]}
                        >
                          {yr}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <>
                {/* Month & Year Navigation */}
                <View style={styles.monthNavRow}>
                  <TouchableOpacity
                    style={styles.navArrow}
                    onPress={handlePrevMonth}
                  >
                    <Ionicons name="chevron-back" size={20} color={Colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.monthYearTitleButton}
                    onPress={() => setShowYearPicker(true)}
                  >
                    <Text style={styles.monthYearTitle}>
                      {MONTH_NAMES[viewMonth]} {viewYear}
                    </Text>
                    <Ionicons name="caret-down" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.navArrow}
                    onPress={handleNextMonth}
                  >
                    <Ionicons name="chevron-forward" size={20} color={Colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Day of Week Headers */}
                <View style={styles.daysHeaderRow}>
                  {DAYS_OF_WEEK.map((day) => (
                    <Text key={day} style={styles.dayHeaderCell}>{day}</Text>
                  ))}
                </View>

                {/* Calendar Grid */}
                <View style={styles.gridContainer}>
                  {calendarCells.map((day, idx) => {
                    if (day === null) {
                      return <View key={`empty-${idx}`} style={styles.dayCell} />;
                    }

                    const cellISO = formatToISO(viewYear, viewMonth, day);
                    const isSelected = cellISO === tempSelectedDate;
                    const isToday = cellISO === todayISO;

                    return (
                      <TouchableOpacity
                        key={`day-${day}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                        onPress={() => handleSelectDay(day)}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            isSelected && styles.dayCellTextSelected,
                            isToday && !isSelected && styles.dayCellTextToday,
                          ]}
                        >
                          {day}
                        </Text>
                        {isToday && !isSelected && <View style={styles.todayDot} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
              >
                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Set Date</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
  },
  fieldButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DDE2D9',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  dateDisplayText: {
    fontSize: Typography.sizes.md,
    fontWeight: '600',
    color: Colors.text,
  },
  isoText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    gap: 4,
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  helperText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.lg,
    width: '100%',
    maxWidth: 380,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginVertical: Spacing.sm,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  presetTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  monthNavRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  monthYearTitleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
  },
  navArrow: {
    padding: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
  },
  monthYearTitle: {
    fontSize: Typography.sizes.md,
    fontWeight: '700',
    color: Colors.text,
  },
  yearPickerContainer: {
    maxHeight: 240,
    marginVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  yearPickerHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 8,
    textAlign: 'center',
  },
  yearScrollView: {
    maxHeight: 180,
  },
  yearGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  yearGridItem: {
    width: '22%',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  yearGridItemSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearGridText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  yearGridTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayHeaderCell: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: Spacing.xs,
  },
  dayCell: {
    width: `${100 / 7}%`,
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
    borderRadius: 19,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  dayCellText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
  },
  dayCellTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dayCellTextToday: {
    color: Colors.primary,
    fontWeight: '700',
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    position: 'absolute',
    bottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  cancelButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
  },
  confirmButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
