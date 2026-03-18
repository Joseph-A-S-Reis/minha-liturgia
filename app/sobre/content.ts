export type AboutSection = {
  title: string;
  paragraphs: string[];
  highlights?: string[];
};

export type DonationMethod = {
  id: "pix" | "ted" | "paypal";
  label: string;
  summary: string;
  details: Array<{
    label: string;
    value: string;
  }>;
};

export type PublicDonationRecord = {
  donorName: string;
  donationDate: string;
  amountLabel: string;
  offeringDate: string;
  note?: string;
};

export const creatorSection: AboutSection = {
  title: "Sobre o criador",
  paragraphs: [
    "Olá.",
    "O aplicativo 'Minha Liturgia' foi criado com o objetivo de ajudar pessoas a viverem com mais constância a oração, a leitura bíblica e a vida sacramental em uma interface simples e intuitiva.",
    "Essa aplicação foi desenvolvida por mim, Joseph Reis, nascido na cidade de Worcester, no estado de Massachusetts, EUA, e atualmente residindo no Brasil. Minha vontade de desenvolver esse aplicativo veio da premissa de proporcionar uma experiência espiritual mais acessível e significativa para todos, principalmente em uma era digital onde tudo funciona por aparelho.",
    "A crescente digitalização da vida cotidiana trouxe desafios e oportunidades para a prática da fé, e o 'Minha Liturgia' busca ser uma ferramenta que auxilie os fiéis a manterem sua rotina espiritual de forma consistente e significativa, visto que hoje é tão fácil se distrair com o constante fluxo de informações e entretenimento digital.",
    "Atualmente, estou seguindo um caminho de devoção e espiritualidade no meio católico, e tenho intenções de me formar teólogo e defender as raízes da Santa Igreja, e junto a isso, desenvolver soluções práticas que ajudam na vida de outros devotos também."
  ],
  highlights: [
    "Em Março de 2025, inicio minha jornada catequética na Paróquia Santa Catarina.",
    "Em Fevereiro de 2026, inicio o desenvolvimento da aplicação 'Minha Liturgia'.",
    "Na Páscoa de 2026, me batizo na mesma paróquia da catequese, iniciando oficialmente minha vida sacramental.",
    "Na Paixão de Cristo de 2026, recebo a Primeira Comunhão e Crisma, aprofundando e confirmando minha participação nos sacramentos da Igreja.",
  ],
};

export const purposeSection: AboutSection = {
  title: "Propósito",
  paragraphs: [
    "'Minha Liturgia' foi criado com o objetivo de ajudar pessoas a viverem com mais constância a oração, a leitura bíblica e a vida sacramental em uma interface simples e intuitiva.",
    "A visão deste projeto é ser um companheiro simples, leve e fiel para a rotina católica do dia a dia, e ajudar as pessoas a manterem sua fé de forma consistente e significativa.",
    "A aplicação está sendo desenvolvida apenas pela minha pessoa, não utilizo de nenhum serviço pago para manter, tudo é feito de forma gratuita e voluntária.",
    "Além do propósito espiritual, o projeto também busca promover a educação e a formação religiosa de forma acessível e inclusiva, com uma biblioteca de conteúdos educativos e recursos para aprofundar o conhecimento da fé.",
    "A pretensão da aplicação é migrar para um servidor mais robusto e confiável no futuro, garantindo maior estabilidade, velocidade e segurança para os usuários.",
    "Futuramente estarei aceitando candidaturas para colaboradores de conteúdo dentro da aplicação, ajudando a ampliar a variedade e a qualidade dos materiais disponíveis."
  ],
};

export const donationIntro = {
  title: "Doação voluntária",
  paragraphs: [
    "A sua contribuição pode me ajudar a continuar evoluindo o 'Minha Liturgia' como uma ferramenta útil e acessível para todos.",
    "Este valor não precisa ser grande; cada contribuição é valiosa e apreciada. Metade do valor será retido para oferta mensal à minha Paróquia, como forma de fazer manutenção da casa do Senhor.",
  ],
};

export const donationMethods: DonationMethod[] = [
  {
    id: "pix",
    label: "PIX",
    summary: "Simples e rápido. O valor é creditado na hora.",
    details: [
      { label: "Chave PIX", value: "012.551.279-10" },
      { label: "Favorecido", value: "Joseph Anthony Schwarzer Reis" },
      { label: "Observação", value: "Sua doação será destinada à manutenção da paróquia. Para ver se ela foi confirmada, acesse a página de doações públicas." },
    ],
  },
  {
    id: "ted",
    label: "TED",
    summary: "Transferência bancária. Sujeito a confirmação pelo banco.",
    details: [
      { label: "Banco", value: "260 - Nu Pagamentos S.A. - Instituição de Pagamento." },
      { label: "Agência", value: "0001." },
      { label: "Conta", value: "29798296-3." },
      { label: "Titular", value: "Joseph Anthony Schwarzer Reis" },
    ],
  },
  {
    id: "paypal",
    label: "PayPal",
    summary: "Método alternativo.",
    details: [
      { label: "E-mail PayPal", value: "josephasreis2511@gmail.com" },
    ],
  },
];

export const publicDonations: PublicDonationRecord[] = [];
