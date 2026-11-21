import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../constants/theme';
import { UserRole } from '../types/database';
import { useAppStore } from '../store/useAppStore';

interface RoleSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RoleSwitcherModal: React.FC<RoleSwitcherModalProps> = ({
  visible,
  onClose,
}) => {
  const { currentRole, setRole } = useAppStore();

  const roles: Array<{
    role: UserRole;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
  }> = [
    {
      role: 'farmer',
      title: 'Farmer Persona',
      description: 'Manage farms, seasonal planting, inputs, expenses, and harvests.',
      icon: 'leaf-outline',
    },
    {
      role: 'quality_inspector',
      title: 'Quality Inspector',
      description: 'Review submitted batches, apply crop templates, record grades & decisions.',
      icon: 'shield-checkmark-outline',
    },
    {
      role: 'extension_officer',
      title: 'Extension Officer',
      description: 'Monitor assigned farmers, record GPS farm visits & pest observations.',
      icon: 'person-add-outline',
    },
    {
      role: 'cooperative_manager',
      title: 'Cooperative Manager',
      description: 'Track aggregate member production, harvest volumes, and quality ratings.',
      icon: 'people-outline',
    },
    {
      role: 'public_viewer',
      title: 'Public / Buyer QR View',
      description: 'Scan or verify approved harvest batch certificates without sensitive data.',
      icon: 'qr-code-outline',
    },
  ];

  const handleSelectRole = (role: UserRole) => {
    setRole(role);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.content}>
              <View style={styles.header}>
                <View>
                  <Text style={styles.title}>Switch FarmTori Persona</Text>
                  <Text style={styles.subtitle}>
                    Demonstrate role-based access control and specific workflows
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.list}>
                {roles.map((item) => {
                  const isSelected = currentRole === item.role;
                  return (
                    <TouchableOpacity
                      key={item.role}
                      style={[styles.roleItem, isSelected && styles.roleItemSelected]}
                      onPress={() => handleSelectRole(item.role)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.iconBox,
                          isSelected ? styles.iconBoxSelected : styles.iconBoxNormal,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={22}
                          color={isSelected ? '#FFFFFF' : Colors.primaryDark}
                        />
                      </View>
                      <View style={styles.roleInfo}>
                        <View style={styles.roleHeaderRow}>
                          <Text
                            style={[
                              styles.roleTitle,
                              isSelected && styles.roleTitleSelected,
                            ]}
                          >
                            {item.title}
                          </Text>
                          {isSelected && (
                            <View style={styles.activePill}>
                              <Text style={styles.activePillText}>ACTIVE</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.roleDesc}>{item.description}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.lg,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
    maxWidth: 240,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  list: {
    gap: Spacing.sm,
  },
  roleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceAlt,
  },
  roleItemSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#F0FDF4',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  iconBoxNormal: {
    backgroundColor: Colors.primaryLight,
  },
  iconBoxSelected: {
    backgroundColor: Colors.primary,
  },
  roleInfo: {
    flex: 1,
  },
  roleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  roleTitle: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
  },
  roleTitleSelected: {
    color: Colors.primaryDark,
  },
  activePill: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  roleDesc: {
    fontSize: Typography.sizes.xs,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
