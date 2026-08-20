import React from 'react';
import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const isAndroid = Platform.OS === 'android';

  // Harmonized: black pill toolbar on top of beige bg (screenshot-aligned)
  const toolbarBg = isAndroid ? '#1A1A1A' : colors.background;
  const toolbarActiveBg = '#D95F3B'; // terracotta pill
  const toolbarActiveFg = '#FFFFFF';
  const toolbarInactiveFg = '#64748B'; // slate

  return (
    <Tabs
      screenOptions={{
        // Android: show app bar with brand name (matches screenshot)
        headerShown: isAndroid,
        headerTitle: 'Curtis Image Studio',
        headerStyle: { backgroundColor: '#000000' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontFamily: 'InstrumentSerif_400Regular',
          fontSize: 17,
          color: '#FFFFFF',
        },
        tabBarActiveTintColor: toolbarActiveFg,
        tabBarInactiveTintColor: toolbarInactiveFg,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: toolbarBg,
          borderTopWidth: 0,
          elevation: 0,
          // Black pill container matching screenshot's pill toolbar
          height: isWeb ? 88 : 72,
          paddingBottom: isAndroid ? 12 : 6,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Create',
          tabBarIcon: ({ color, focused }) =>
            isIOS && !focused ? (
              <SymbolView name="camera" tintColor={color} size={24} />
            ) : (
              <Feather name={focused ? 'camera' : 'camera'} size={22} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="render"
        options={{
          title: 'Render',
          tabBarIcon: ({ color }) =>
            isIOS ? (
              <SymbolView name="film" tintColor={color} size={24} />
            ) : (
              <Feather name="film" size={22} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  return <ClassicTabLayout />;
}
