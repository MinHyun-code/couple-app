import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useCoupleStore, useThemeStore } from '../../src/store'
import { FONT_HEADING, THEMES } from '../../src/theme'

export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const themeKey = useThemeStore(s => s.themeKey)
  const theme = THEMES[themeKey]
  const menuSettings = useCoupleStore(s => s.couple?.menu_settings)
  const showBucketList = menuSettings?.showBucketList ?? true
  const showChat = menuSettings?.showChat ?? true
  const showMap = menuSettings?.showMap ?? true

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.color,
        tabBarInactiveTintColor: '#C9BDB8',
        tabBarStyle: {
          backgroundColor: '#FFFDFB',
          borderTopWidth: 1,
          borderTopColor: '#F1E7E2',
          paddingBottom: insets.bottom + 4,
          height: 60 + insets.bottom,
        },
        tabBarLabelStyle: { fontFamily: FONT_HEADING, fontSize: 12 },
        headerStyle: { backgroundColor: theme.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: FONT_HEADING, color: '#3D2C3B', fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '캘린더',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="dates"
        options={{
          title: '버킷리스트',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
          ),
          headerTitle: '우리의 버킷리스트',
          href: showBucketList ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: '대화',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={24} color={color} />
          ),
          headerTitle: '우리의 대화',
          href: showChat ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={24} color={color} />
          ),
          headerTitle: '우리의 지도',
          href: showMap ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="character"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  )
}
