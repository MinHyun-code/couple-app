// 공개 저장소에 올리지 않을 설정 값은 app.json 대신 환경 변수에서 읽는다
// - 로컬: 프로젝트 루트 .env (git 제외, .env.example 참고)
// - EAS 빌드: EAS 환경 변수 (eas env:create)
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  },
})
