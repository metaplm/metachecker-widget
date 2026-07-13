import { createI18n } from "vue-i18n";

import en from "./i18n/en.json";
import tr from "./i18n/tr.json";

// vue-i18n v9 (Vue 3). Composition API kullanımı için legacy:false;
// template'lerde $t / setup'larda useI18n() çalışsın diye globalInjection:true.
const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: "en", // açılışta /lang sonucu ile setLocale() üzerinden güncellenir
  fallbackLocale: "en",
  messages: { en, tr }
});

/**
 * Tek dil değiştirme noktası. Sadece desteklenen diller (tr/en); diğerleri en'e düşer.
 * i18n.global.locale bir ref (legacy:false) → reaktif, reload gerekmez.
 * @returns {"en"|"tr"} ayarlanan dil
 */
export function setLocale(lang) {
  const next = lang === "tr" ? "tr" : "en";
  i18n.global.locale.value = next;
  return next;
}

export default i18n;
