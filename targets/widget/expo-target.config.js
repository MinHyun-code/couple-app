/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'widget',
  displayName: '함께한 날',
  deploymentTarget: '16.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  entitlements: {
    // 메인 앱과 동일한 App Group을 사용해 UserDefaults를 공유한다
    'com.apple.security.application-groups':
      config.ios.entitlements['com.apple.security.application-groups'],
  },
})
