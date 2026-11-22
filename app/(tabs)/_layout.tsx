import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Map, Calendar, Leaf, User } from 'lucide-react-native';
import { Colors, FontFamily, Typography } from '../../src/constants/theme';
import { useAppStore } from '../../src/store/useAppStore';

interface TabBarIconWrapperProps {
  focused: boolean;
  IconComponent: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
}

function TabBarIconWrapper({ focused, IconComponent }: TabBarIconWrapperProps) {
  return (
    <View style={[styles.iconPill, focused && styles.iconPillFocused]}>
      <IconComponent
        size={20}
        color={focused ? Colors.primary : Colors.textMuted}
        strokeWidth={focused ? 2.4 : 1.9}
      />
    </View>
  );
}

interface TabBarLabelProps {
  focused: boolean;
  title: string;
}

function TabBarLabel({ focused, title }: TabBarLabelProps) {
  return (
    <Text
      numberOfLines={1}
      style={[styles.label, focused && styles.labelFocused]}
    >
      {title}
    </Text>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { currentRole } = useAppStore();

  const getFarmsTitle = () => {
    if (currentRole === 'extension_officer') return 'Assigned';
    if (currentRole === 'quality_inspector') return 'Parcels';
    if (currentRole === 'cooperative_manager') return 'Coop land';
    return 'Farms';
  };

  const getActivitiesTitle = () => {
    if (currentRole === 'extension_officer') return 'Visits';
    if (currentRole === 'quality_inspector') return 'Operations';
    if (currentRole === 'cooperative_manager') return 'Union logs';
    return 'Activity';
  };

  const getHarvestsTitle = () => {
    if (currentRole === 'quality_inspector') return 'Queue';
    if (currentRole === 'extension_officer') return 'Batches';
    if (currentRole === 'cooperative_manager') return 'Harvests';
    return 'Harvests';
  };

  const getHomeTitle = () => {
    return currentRole === 'farmer' ? 'Home' : 'Command';
  };

  if (currentRole === 'buyer') return <Redirect href={"/buyer" as any} />;

  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 10 : 16);
  const tabHeight = 64 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: tabHeight,
          paddingTop: 8,
          paddingBottom: bottomInset,
          elevation: 4,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIconWrapper focused={focused} IconComponent={Home} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} title={getHomeTitle()} />
          ),
        }}
      />
      <Tabs.Screen
        name="farms"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIconWrapper focused={focused} IconComponent={Map} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} title={getFarmsTitle()} />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIconWrapper focused={focused} IconComponent={Calendar} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} title={getActivitiesTitle()} />
          ),
        }}
      />
      <Tabs.Screen
        name="harvests"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIconWrapper focused={focused} IconComponent={Leaf} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} title={getHarvestsTitle()} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabBarIconWrapper focused={focused} IconComponent={User} />
          ),
          tabBarLabel: ({ focused }) => (
            <TabBarLabel focused={focused} title="Profile" />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconPill: {
    width: 58,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconPillFocused: {
    backgroundColor: Colors.tint, // #DDF0D8
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: Typography.sizes.xs, // 12
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.1,
  },
  labelFocused: {
    fontFamily: FontFamily.bold,
    color: Colors.primary,
  },
});
