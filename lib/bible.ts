export type BibleVersion = {
  id: string;
  name: string;
  language: "pt-BR" | "en";
  source: "db" | "api";
  default?: boolean;
};

export const bibleVersions: BibleVersion[] = [
  {
    id: "ave-maria",
    name: "Ave Maria",
    language: "pt-BR",
    source: "db",
    default: true,
  },
  {
    id: "douay-rheims",
    name: "Douay-Rheims",
    language: "en",
    source: "db",
  },
];

export const oldTestamentBooks = [
  "Gênesis",
  "Êxodo",
  "Levítico",
  "Números",
  "Deuteronômio",
  "Josué",
  "Juízes",
  "Rute",
  "1 Samuel",
  "2 Samuel",
];

export const newTestamentBooks = [
  "Mateus",
  "Marcos",
  "Lucas",
  "João",
  "Atos",
  "Romanos",
  "1 Coríntios",
  "2 Coríntios",
];
