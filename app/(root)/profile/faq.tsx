import type { LegalDocument } from "../../../components/constants/legal";
import { LegalDocumentScreen } from "../../../components/legal/LegalDocumentScreen";

// Same layout as the Terms & Conditions page: each question is a
// numbered, expandable section with its answer.

type Faq = { q: string; a: string };

const SECTIONS: { title: string; items: Faq[] }[] = [
  {
    title: "About Vritta",
    items: [
      {
        q: "What is Vritta and how does it work?",
        a: "Vritta is an AI-powered astrology and spiritual guidance app that brings together Vedic astrology, Tarot, and Numerology in one place. Whether you have questions about love, relationships, marriage, career, finances, or personal growth, Vritta helps you explore personalised insights through AI-powered guidance and human astrologer consultations. Our mission is to make traditional Indian spiritual practices more accessible through a modern, personalised experience.",
      },
      {
        q: "What makes Vritta different from other astrology apps?",
        a: "Vritta combines AI astrologers and human astrologer consultations with three approaches to spiritual guidance: Vedic astrology, Tarot, and Numerology. Instead of focusing only on daily horoscopes, Vritta is designed around your personal questions, helping you explore relationships, career decisions, marriage, and life challenges through interactive guidance. By bringing these experiences together, Vritta offers a modern way to explore India's rich spiritual traditions.",
      },
      {
        q: "Is Vritta free to use?",
        a: "Vritta's pricing depends on the features and prices of the chat consultations available. Certain experiences may be free, while premium AI guidance and human astrologer consultations require payment. Visit the official Vritta website or app for current pricing, subscription details, and the features included in each plan.",
      },
      {
        q: "Is Vritta based on Vedic astrology, Tarot, or Numerology?",
        a: "Vritta brings together Vedic astrology, Tarot, and Numerology to offer different perspectives on your questions. Vedic astrology explores your birth chart, rashi, nakshatra, planetary placements, and dashas. Tarot uses symbolic card interpretations to explore situations and possible perspectives, while Numerology examines the traditional significance of numbers associated with details such as your birth date or name. You can explore these approaches according to your interests and the guidance you seek.",
      },
      {
        q: "Can I talk to an AI astrologer on Vritta?",
        a: "Vritta brings AI-powered guidance into a conversational experience, helping you explore questions about love, marriage, relationships, career, money, and personal growth. Depending on the features available, you can interact with AI guides to explore traditional astrological interpretations and other spiritual perspectives tailored to your questions. AI guidance is intended to support reflection and help you consider different perspectives, not guarantee future outcomes.",
      },
      {
        q: "Can I consult a human astrologer on Vritta?",
        a: "Vritta's hybrid model brings AI-powered guidance and human astrologer consultations together on one platform. Human consultations are intended for people seeking personalized conversations about relationships, marriage, career, and other important life questions. Check Vritta for current astrologer availability, consultation options, supported languages, and pricing.",
      },
    ],
  },
  {
    title: "Kundli & Vedic astrology",
    items: [
      {
        q: "How can I generate my kundli online?",
        a: "To generate your janam kundli online, you generally need your date of birth, exact time of birth, and place of birth. These details are used to calculate your ascendant (lagna), planetary positions, zodiac houses, and other elements of your Vedic birth chart. Once Vritta's kundli feature is available, you can use it to explore your birth chart and understand the traditional interpretations associated with your planetary placements.",
      },
      {
        q: "What is kundli matching, and how does it work?",
        a: "Kundli matching, also known as guna milan, is a traditional Vedic astrology method for assessing compatibility between two birth charts, particularly before marriage. The Ashtakoota system evaluates eight factors and assigns a score out of 36 gunas. Traditionally, a score of 18 or more is often considered an acceptable starting point, although interpretations vary. Astrologers may also consider Mangal Dosha, Nadi Dosha, and Bhakoot Dosha. A guna score is only one traditional perspective and cannot determine the success of a relationship.",
      },
      {
        q: "What are Mangal Dosha and Sade Sati?",
        a: "Mangal Dosha and Sade Sati are important concepts in Vedic astrology. Mangal Dosha, also called Manglik Dosha, relates to Mars occupying certain houses in a birth chart, with interpretation depending on other planetary placements and the astrological tradition followed. Sade Sati refers to an approximately seven-and-a-half-year period during which Saturn transits the zodiac sign before your Moon sign, your Moon sign itself, and the sign after it. Vritta helps users explore these traditional concepts and understand their interpretations within Vedic astrology.",
      },
    ],
  },
  {
    title: "Guidance & accuracy",
    items: [
      {
        q: "Can Vritta help with love, marriage, and relationships?",
        a: "Vritta helps you explore questions about love, relationships, marriage, compatibility, and emotional connections through Vedic astrology, Tarot, and Numerology. Depending on the features available, you can explore compatibility themes, relationship patterns, marriage-related questions, and different perspectives on personal decisions. These insights can encourage reflection and meaningful conversations, but they cannot guarantee marriage timing, predict another person's feelings with certainty, or determine the outcome of a relationship.",
      },
      {
        q: "Can Vritta provide career and financial guidance?",
        a: "Vritta helps you explore questions about career direction, job changes, business opportunities, professional growth, and financial goals through spiritual and astrological perspectives. Depending on the guidance experience, you can use Vedic astrology, Tarot, and Numerology to reflect on your options and priorities. These insights should complement practical research and sound judgement, not replace professional career counselling or qualified financial advice.",
      },
      {
        q: "Do I need my exact birth time to use Vritta?",
        a: "An exact birth time is important for many Vedic astrology calculations, particularly the ascendant and house placements. If you do not know your birth time, some forms of guidance may still be possible using your date and place of birth, depending on the method used. However, certain birth-chart interpretations may be limited without an accurate time. Tarot and some Numerology experiences may require different information.",
      },
      {
        q: "How accurate are Vritta's predictions?",
        a: "Vritta combines AI-powered experiences with traditional approaches to Vedic astrology, Tarot, and Numerology to provide personalised interpretations. The results depend on the information provided, the method used, and the interpretation generated. Although astronomical calculations can determine planetary positions for a given time and location, astrological interpretations and predictions are not scientifically established methods for forecasting future events with certainty. Vritta is intended to support reflection and personal exploration rather than promise guaranteed outcomes.",
      },
    ],
  },
  {
    title: "Privacy & availability",
    items: [
      {
        q: "Is Vritta safe and private?",
        a: "Vritta is committed to providing a trustworthy experience for exploring personal questions and spiritual guidance. Before using the platform, review Vritta's Privacy Policy to understand how your personal information, birth details, conversations, and account data are collected and handled. Details about encryption, data retention, sharing, and account deletion should be based on Vritta's published privacy practices. Avoid sharing sensitive information that is not necessary to use the service.",
      },
      {
        q: "When will Vritta launch on iOS?",
        a: "Vritta's iOS app is coming soon. We are preparing to bring our AI-powered astrology, Tarot, Numerology, and personalised spiritual guidance experience to iPhone users. Stay tuned for the official launch announcement and App Store availability. Visit the Vritta website or follow our official channels for the latest updates on the iOS release.",
      },
    ],
  },
];

const FAQ: LegalDocument = {
  title: "FAQ",
  lastUpdated: `${SECTIONS.reduce((n, s) => n + s.items.length, 0)} answers about Vritta`,
  sections: SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ title: item.q, paragraphs: [item.a] }))
  ),
};

export default function FaqScreen() {
  return (
    <LegalDocumentScreen
      document={FAQ}
      cardTitle="Frequently asked questions"
      icon="help-circle-outline"
      accent={{ tint: "#E6DDF4", color: "#2B1A3D" }}
    />
  );
}
