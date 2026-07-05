// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-01-01",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint"],
  eslint: {
    config: {
      stylistic: true,
    },
  },
});
