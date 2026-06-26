import type { Locale } from "@/lib/locale";

export const messages = {
  en: {
    chrome: {
      online: "ONLINE",
    },
    work: {
      categories: {
        PORTRAIT: "PORTRAIT",
        INTERIOR: "INTERIOR",
      },
    },
    info: {
      bio: [
        "SKMNG, born in Hong Kong, now based in Tokyo, centres his photography on composition, silhouette, and, above all, emotional resonance.",
        "It began at fourteen, with his mother's camera. Since then, photography has become a lifelong devotion: a way of suspending time, of finding meaning in the fleeting.",
        "working exclusively with prime lenses: 28mm and 43mm, their demands sharpen awareness, compel movement rather than zoom, and uncover new perspectives with each step.",
      ],
      role: "PHOTOGRAPHER/artist/graphic designer",
      contact: "CONTACT",
      emailLabel: "EMAIL:",
      instagramLabel: "Instagram:",
      siteCredit: "SITE MADE BY KAI",
      copyright: "© 2026 SKMNG / ALL RIGHTS RESERVED",
      copied: "COPIED",
    },
    a11y: {
      switchToJapanese: "Switch to Japanese",
      switchToEnglish: "Switch to English",
      copyEmail: "Copy email address",
      live: "Live",
    },
  },
  ja: {
    chrome: {
      online: "オンライン",
    },
    work: {
      categories: {
        PORTRAIT: "ポートレート",
        INTERIOR: "インテリア",
      },
    },
    info: {
      bio: [
        "香港生まれ、東京を拠点とするSKMNG。構図とシルエット、そして何より感情の共鳴を中心に写真を制作している。",
        "十四歳、母のカメラから始まった。以来、写真は生涯の志業となり、時間を止め、一瞬の中に意味を見出す手段となった。",
        "撮影には28mmと43mmの単焦点レンズのみを使用。その制約が感覚を研ぎ澄まし、ズームではなく歩みによって新たな視点を開いていく。",
      ],
      role: "フォトグラファー／アーティスト／グラフィックデザイナー",
      contact: "コンタクト",
      emailLabel: "メール：",
      instagramLabel: "Instagram：",
      siteCredit: "SITE MADE BY KAI",
      copyright: "© 2026 SKMNG / ALL RIGHTS RESERVED",
      copied: "コピーしました",
    },
    a11y: {
      switchToJapanese: "日本語に切り替え",
      switchToEnglish: "英語に切り替え",
      copyEmail: "メールアドレスをコピー",
      live: "オンライン",
    },
  },
} as const satisfies Record<Locale, unknown>;

export type Messages = (typeof messages)[Locale];

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
