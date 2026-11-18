import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../../src/constants/theme';
import { Platform } from 'react-native';
import { useAppStore } from '../../src/store/useAppStore';

export default function TabLayout() {
  const { currentRole } = useAppStore();

  const getFarmsTitle = () => {
    if (currentRole === 'extension_officer') return 'Assigned Farms';
    if (currentRole === 'quality_inspector') return 'Parcels';
    if (currentRole === 'cooperative_manager') return 'Coop Land';
    return 'My Farms';
  };

  const getActivitiesTitle = () => {
    if (currentRole === 'extension_officer') return 'Field Visits';
    if (currentRole === 'quality_inspector') return 'Operations';
    if (currentRole === 'cooperative_manager') return 'Union Logs';
    return 'Activities';
  };

  const getHarvestsTitle = () => {
    if (currentRole === 'quality_inspector') return 'Inspection Queue';
    if (currentRole === 'extension_officer') return 'Yield Batches';
    if (currentRole === 'cooperative_manager') return 'Harvests';
    return 'Harvests';
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: Typography.sizes.xs,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: currentRole === 'farmer' ? 'Home' : 'Command',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="farms"
        options={{
          title: getFarmsTitle(),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'map' : 'map-outline'}
              size={size}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="activities"
        options={{
          title: getActivitiesTitle(),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'calendar' : 'calendar-outline'}
              size={size}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="harvests"
        options={{
          title: getHarvestsTitle(),
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'leaf' : 'leaf-outline'}
              size={size}
              color={color as any}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color as any}
            />
          ),
        }}
      />
    </Tabs>
  );
}
