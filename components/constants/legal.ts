// Content for the Privacy Policy and Terms & Conditions screens.
// Each section: a title and one or more paragraphs (shown in order).

export type LegalSection = {
  title: string;
  paragraphs: string[];
};

export type LegalDocument = {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
};

export const PRIVACY_POLICY: LegalDocument = {
  title: "Privacy Policy",
  lastUpdated: "10 October 2026",
  sections: [
    {
      title: "Introduction",
      paragraphs: [
        "This Privacy Policy explains how Slideoo Global Private Limited (“Vritta”, “we”, “us”, or “our”) collects, uses, stores, discloses, and otherwise processes personal information when you visit https://vritta.app, use Vritta’s mobile applications or services, or contact us (together, the “Platform”).",
        "Vritta may offer astrology and spiritual-guidance experiences, including Vedic astrology, kundli or birth-chart features, Tarot, Numerology, AI-powered guides, content, and consultations with human astrologers. The features available to you may vary.",
        "Please read this Policy with our Terms & Conditions. This Policy describes the intended categories and purposes of processing; the specific data collected depends on the features you choose and the permissions you grant.",
      ],
    },
    {
      title: "Personal Information We May Process",
      paragraphs: [
        "Depending on how you use the Platform, we may process:",
        "•  Account and contact information: such as your name, email address, phone number, account identifier, and account preferences.",
        "•  Birth and profile information: such as date, time, and place of birth, and details you provide to create or interpret an astrological chart or personalise a feature.",
        "•  Messages and consultation information: questions, prompts, conversation history, reports, feedback, and communications with AI features, human astrologers, or customer support. These may reveal personal matters that you choose to discuss.",
        "•  Device and usage information: such as device type, operating system, app version, browser, IP address, diagnostic logs, crash reports, language settings, and interactions with features. Precise location is processed only if a feature requires it and you grant the relevant permission.",
        "•  Purchase and subscription information: such as transaction identifiers, amount, currency, purchase status, and subscription status. App stores and payment providers generally process full payment-card details under their own terms.",
        "•  Support and communication preferences: such as messages sent to us, survey responses, and preferences about optional promotional communications.",
        "•  Information derived from use: such as chart calculations, selected preferences, and service-related outputs needed to provide the features you request.",
        "Please provide only information relevant to the feature you are using. Do not submit passwords, full payment-card details, government identification numbers, medical records, or other highly sensitive information unless a feature specifically requires it and we explain the reason.",
        "If you provide another person’s birth details or other personal information, you must have a lawful basis and any permission required to share it.",
      ],
    },
    {
      title: "How We Use Personal Information",
      paragraphs: [
        "We may use personal information to:",
        "•  create, authenticate, and manage accounts;",
        "•  provide astrology, Tarot, Numerology, AI, content, and consultation features;",
        "•  generate requested charts, reports, and personalised responses;",
        "•  process purchases, subscriptions, and customer-service requests;",
        "•  communicate service, account, security, policy, and transaction information;",
        "•  respond to feedback and provide support;",
        "•  maintain, troubleshoot, secure, and improve the Platform;",
        "•  detect fraud, abuse, technical problems, or violations of our Terms;",
        "•  send optional marketing communications where permitted and consistent with your choices; and",
        "•  comply with legal obligations and establish, exercise, or defend legal claims.",
        "Where applicable law requires consent or additional notice for a purpose, we will provide it before processing for that purpose.",
      ],
    },
    {
      title: "AI Features and Conversation Data",
      paragraphs: [
        "When you use an AI feature, the prompt and information needed to respond may be processed by Vritta’s systems and by technology providers acting on our behalf. Depending on the feature, this may include birth details, chart information, preferences, and relevant conversation context.",
        "We may retain AI responses and conversation history to make features work, display previous conversations, provide support, maintain security, and meet legal obligations. Access should be limited to authorised personnel and providers who need it for legitimate service purposes.",
        "AI technology providers may process prompts and outputs under their own terms and privacy practices, which can vary by provider and configuration. Where applicable, information about relevant providers and their handling of data will be made available through the Platform or the provider’s privacy materials. We do not make a blanket promise that all providers never retain data, use it to improve models, or permit human review; these practices depend on the provider and the configuration used for the feature.",
      ],
    },
    {
      title: "Human Astrologer Consultations",
      paragraphs: [
        "If you choose to consult a human astrologer through Vritta, information you submit for the consultation may be shared with that astrologer to provide the service. This may include your messages, birth details, chart information, and the profile information you choose to provide.",
        "Consultation records may be processed to facilitate the consultation, provide support, address complaints or disputes, prevent misuse, and comply with law. Any recording, transcription, or additional use of consultation content should be disclosed in the relevant feature before it occurs where required by law.",
        "Please avoid sharing information that is not necessary for your consultation.",
      ],
    },
    {
      title: "Legal Grounds and Choices",
      paragraphs: [
        "Depending on the law applicable to you, we process personal information on grounds such as providing a service you request, taking steps before entering into a contract, complying with legal obligations, protecting the Platform and users, pursuing legitimate business purposes where permitted, or obtaining your consent where required.",
        "Where processing is based on consent, you may withdraw it as permitted by law. Withdrawal does not affect processing already carried out lawfully before withdrawal, and some features may no longer work if the information is necessary to provide them.",
      ],
    },
    {
      title: "Cookies, Analytics, and Similar Technologies",
      paragraphs: [
        "Our website or app may use cookies, software development kits (SDKs), local storage, and similar technologies for functions such as login, security, preferences, diagnostics, and performance measurement. If optional analytics or advertising technologies are used, we will provide notices and choices required by applicable law.",
        "You can manage cookies through your browser settings and certain app permissions through your device settings. Disabling some technologies may affect Platform functionality.",
      ],
    },
    {
      title: "How We Share Personal Information",
      paragraphs: [
        "We may disclose personal information, as necessary and subject to applicable law, to:",
        "•  Service providers: including cloud hosting, AI technology, analytics, security, customer support, communications, and technical service providers.",
        "•  Payment and distribution providers: including app stores and payment processors that handle purchases and subscriptions.",
        "•  Human astrologers: when you choose a consultation and sharing is needed to provide it.",
        "•  Professional advisers: such as lawyers, auditors, and accountants who are subject to appropriate confidentiality duties.",
        "•  Authorities or other parties: where disclosure is required by law or reasonably necessary to protect rights, safety, security, or to investigate fraud or enforce our Terms.",
        "•  Business transaction participants: in connection with a proposed or completed merger, investment, restructuring, financing, or sale of all or part of the business, subject to applicable law and appropriate safeguards.",
        "•  Parties you direct us to share with: where you request or consent to a disclosure, or where we explain another purpose at the time information is collected.",
        "We do not sell personal information in exchange for money. If we use advertising or analytics technologies that trigger a legally defined opt-out right or other disclosure obligation, we will provide the notices and choices required by applicable law.",
      ],
    },
    {
      title: "International Processing",
      paragraphs: [
        "Slideoo Global Private Limited is based in India. Our service providers may process information in India or other countries where they operate. Laws in those countries may differ from the laws where you live. Where required, we will apply appropriate safeguards and comply with applicable restrictions on international transfers.",
      ],
    },
    {
      title: "Retention and Deletion",
      paragraphs: [
        "We retain personal information for as long as reasonably necessary for the purposes described in this Policy, including providing the Platform, maintaining account and transaction records, meeting legal or accounting obligations, resolving disputes, enforcing agreements, and protecting security. Retention depends on the type of information, the feature involved, and applicable legal requirements.",
        "When information is no longer required, we will take reasonable steps to delete it, anonymise it, or securely dispose of it, subject to legal obligations and technical limitations. Backup copies may remain for a limited period until they are overwritten or removed through ordinary backup cycles.",
        "You may request account or data deletion by using any deletion controls provided in the Platform or emailing support@vritta.app. We may need to verify your identity. Deleting an account may not automatically cancel an app-store subscription; cancel it separately through the relevant store if applicable.",
      ],
    },
    {
      title: "Security",
      paragraphs: [
        "We use reasonable technical and organisational measures intended to protect personal information against unauthorised access, loss, misuse, alteration, or disclosure. No online service or storage method can be guaranteed completely secure.",
        "You are responsible for protecting your account credentials. If you believe your account or information has been accessed without authorisation, contact support@vritta.app promptly.",
      ],
    },
    {
      title: "Your Rights and Privacy Requests",
      paragraphs: [
        "Your rights depend on the laws that apply to you and may include requesting access to, correction of, or deletion of personal information; withdrawing consent; raising a grievance; or exercising other rights provided by law.",
        "To make a privacy request or raise a concern, email support@vritta.app from your account email address where possible. Explain the request and include enough information for us to identify the relevant account. We may ask for reasonable verification before acting. We will respond within the time required by applicable law.",
        "We may decline or limit a request where the law permits or requires us to do so, and we will explain the reason where required. Some information may need to be retained for legal, security, accounting, or dispute-resolution purposes.",
        "You may opt out of optional promotional emails using the unsubscribe method provided in the message. We may still send essential account, security, legal, and transaction communications.",
      ],
    },
    {
      title: "Children’s Privacy",
      paragraphs: [
        "Vritta is intended for adults aged 18 and over and is not designed for children to use independently. We do not knowingly permit children under 18 to create accounts. If you believe a child has provided personal information to us, contact support@vritta.app so we can assess the request and take appropriate steps under applicable law.",
      ],
    },
    {
      title: "Third-Party Services and Links",
      paragraphs: [
        "The Platform may contain links to third-party websites or integrate with third-party services. Their privacy practices are governed by their own policies, not this Policy. Please review those policies before providing information to a third party.",
      ],
    },
    {
      title: "Changes to This Policy",
      paragraphs: [
        "We may update this Policy to reflect changes to the Platform, our data practices, or legal requirements. We will update the “Last updated” date and provide additional notice where required. Please review this page periodically.",
      ],
    },
    {
      title: "Contact Us",
      paragraphs: [
        "For privacy questions, requests, or grievances, contact:",
        "Slideoo Global Private Limited\nBrand: Vritta\nEmail: support@vritta.app\nWebsite: https://vritta.app",
      ],
    },
  ],
};

export const TERMS_AND_CONDITIONS: LegalDocument = {
  title: "Terms & Conditions",
  lastUpdated: "10 October 2026",
  sections: [
    {
      title: "About These Terms",
      paragraphs: [
        "These Terms & Conditions (“Terms”) govern your access to and use of the Vritta website, mobile applications, and related features and services (collectively, the “Platform”), operated by Slideoo Global Private Limited (“Vritta”, “we”, “us”, or “our”).",
        "Vritta offer astrology and spiritual-guidance experiences, including Vedic astrology, kundli or birth-chart features, Tarot, Numerology, AI-powered guides, educational content, and consultations with human astrologers. Available features may change over time or vary by location, device, or plan.",
        "By accessing or using the Platform, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Platform.",
      ],
    },
    {
      title: "Eligibility and Your Account",
      paragraphs: [
        "Vritta is intended for people aged 18 or older. By using the Platform, you confirm that you are at least 18 and legally able to enter into these Terms. Do not use the Platform if you do not meet these requirements.",
        "Some features may require an account. You agree to provide accurate information, keep it reasonably up to date, and protect your sign-in credentials. You are responsible for activity carried out through your account, except where unauthorised activity results from circumstances for which you are not responsible under applicable law. Contact support@vritta.app promptly if you suspect unauthorised access.",
        "Do not create accounts or use promotions to evade limits, restrictions, or payment obligations. We may take proportionate action if reasonably necessary to protect the Platform, users, or our legal rights.",
      ],
    },
    {
      title: "Vritta Services",
      paragraphs: [
        "Depending on availability, the Platform may provide astrological charts and interpretations, Vedic astrology content, Tarot and Numerology guidance, AI-generated responses, educational or spiritual content, and access to human astrologers. Specific features, prices, availability, and usage limits will be shown in the Platform or at checkout where applicable.",
        "Vritta may add, change, suspend, or discontinue a feature. Where a change materially affects a paid service, we will provide notice or any remedy required by applicable law.",
      ],
    },
    {
      title: "Nature of Astrology and Spiritual Guidance",
      paragraphs: [
        "Astrology, Tarot, Numerology, and related spiritual practices involve belief, tradition, and interpretation. They are not scientifically established methods for predicting events with certainty. Vritta provides content for informational, cultural, entertainment, and personal-reflection purposes.",
        "Readings, reports, and responses whether generated by AI or provided by a human astrologer may be subjective, incomplete, inaccurate, or unsuitable for your circumstances. No result or consultation guarantees a particular outcome.",
        "Vritta is not a substitute for professional medical, mental-health, legal, tax, financial, investment, or other regulated advice. Do not rely on the Platform for emergencies or decisions requiring a qualified professional. You remain responsible for your choices and actions.",
      ],
    },
    {
      title: "AI Features and Human Astrologers",
      paragraphs: [
        "Some features use artificial intelligence to generate answers, reports, interpretations, or suggestions. AI outputs can be incorrect or misleading and may not reflect Vritta’s views. Unless the Platform expressly says otherwise, do not assume that an AI-generated response has been reviewed by a human.",
        "If consultations with human astrologers are available, the Platform may facilitate discovery, communication, scheduling, or payment. Details about the astrologer, scope, price, and format will be displayed where applicable. The content of a consultation reflects the individual astrologer’s interpretation and is not a guarantee of any result.",
        "Do not use AI responses or consultations as a basis for decisions that require qualified professional advice.",
      ],
    },
    {
      title: "Subscriptions, Purchases, and Payments",
      paragraphs: [
        "Certain features may be free; others may require a subscription, one-time payment, credits, or another fee. Before you confirm a purchase, the applicable price, currency, billing period, included features, limits, renewal terms, and taxes (where applicable) will be presented through the relevant checkout flow.",
        "If a subscription renews automatically, the checkout flow or purchasing platform will explain its renewal terms and how to cancel. You authorise the applicable payment provider to charge the selected payment method in accordance with the purchase terms.",
        "Purchases made through Apple App Store, Google Play, or another third-party platform may be governed by that platform’s payment and subscription terms. You may need to manage or cancel the subscription through the platform where you purchased it. Deleting your Vritta account does not necessarily cancel a subscription.",
        "Refunds and cancellations are handled in accordance with applicable law, the purchase terms displayed at checkout, and the relevant app-store or payment-provider rules. Where the law permits, a partially used subscription period may not be refundable. Nothing in these Terms removes a refund or cancellation right that cannot lawfully be excluded. For help, contact support@vritta.app; app-store purchases may need to be referred to the relevant store.",
      ],
    },
    {
      title: "Acceptable Use",
      paragraphs: [
        "You agree to use the Platform lawfully and respectfully. You must not:",
        "•  violate applicable law or another person’s rights;",
        "•  harass, threaten, exploit, defraud, or impersonate another person;",
        "•  submit unlawful, infringing, abusive, deceptive, or malicious content;",
        "•  access another person’s account or information without permission;",
        "•  disrupt the Platform, introduce malware, or interfere with its security;",
        "•  scrape, reverse engineer, copy, or commercially exploit the Platform except where applicable law permits;",
        "•  bypass payment systems, access controls, or usage limits;",
        "•  conduct security testing without our prior written permission; or",
        "•  use the Platform to make unlawful or harmful decisions about another person.",
        "We may investigate reported misuse and take proportionate steps, including removing content, limiting features, suspending access, or reporting conduct to authorities where required or permitted by law.",
      ],
    },
    {
      title: "Your Content and Feedback",
      paragraphs: [
        "You retain any rights you have in content you submit, such as questions, messages, feedback, or other material (“User Content”). You grant Vritta a limited, non-exclusive permission to host, store, process, transmit, and display User Content only as reasonably necessary to operate the features you choose, provide support, protect the Platform, and comply with law, subject to our Privacy Policy.",
        "You are responsible for ensuring you have the rights and permissions needed to submit User Content. Do not submit another person’s personal information unless you have a lawful basis and any required permission.",
        "If you provide suggestions or feedback, we may use them to improve the Platform without compensation to you, subject to applicable law.",
      ],
    },
    {
      title: "Intellectual Property",
      paragraphs: [
        "The Platform and its software, design, branding, text, graphics, and other materials are owned by or licensed to Slideoo Global Private Limited and are protected by intellectual-property laws. You may use the Platform for your personal, lawful use in accordance with these Terms.",
        "Except as permitted by law or with our prior written permission, you may not copy, distribute, modify, sell, commercially exploit, or create derivative works from the Platform or its materials. These Terms do not transfer ownership of Vritta’s intellectual property to you.",
      ],
    },
    {
      title: "Third-Party Services",
      paragraphs: [
        "The Platform may integrate with or link to third-party services, including app stores, payment processors, cloud hosting, AI technology providers, analytics tools, and communication services. Those providers may have separate terms and privacy policies. Their independent services are governed by their own terms, subject to rights and responsibilities that cannot be excluded under applicable law.",
      ],
    },
    {
      title: "Availability, Suspension, and Account Closure",
      paragraphs: [
        "We aim to keep the Platform available, but do not guarantee uninterrupted or error-free operation. We may carry out maintenance or change features for operational, safety, legal, or business reasons.",
        "You may stop using Vritta at any time and may request account deletion using the available account controls or by contacting support@vritta.app. Account deletion may not automatically cancel a third-party subscription.",
        "We may restrict or suspend access where reasonably necessary to address a breach of these Terms, suspected fraud, a security risk, misuse, or a legal obligation. We will act in accordance with applicable law and provide any notice or remedy required.",
      ],
    },
    {
      title: "Disclaimers",
      paragraphs: [
        "To the maximum extent permitted by applicable law, the Platform is provided on an “as available” basis. We do not warrant that it will always be available, error-free, secure, or suitable for every purpose, or that any reading, prediction, AI output, report, or consultation will be accurate or lead to a particular result.",
        "Nothing in these Terms excludes any consumer right, warranty, or liability that cannot lawfully be excluded or limited.",
      ],
    },
    {
      title: "Limitation of Liability",
      paragraphs: [
        "To the maximum extent permitted by applicable law, Slideoo Global Private Limited will not be liable for indirect, incidental, special, consequential, or punitive losses, loss of profits, or loss of data arising from use of the Platform. This does not exclude liability for losses that cannot lawfully be excluded, or for liability arising from our fraud, wilful misconduct, or other conduct where limitation is prohibited by law.",
        "To the extent a financial limit is permitted by law, our aggregate liability for a claim relating to a paid feature will not exceed the amount you paid to Vritta for that feature during the three months before the event giving rise to the claim. This limit does not apply where prohibited by applicable law.",
      ],
    },
    {
      title: "Indemnity",
      paragraphs: [
        "To the extent permitted by law, you are responsible for claims and reasonable costs arising directly from your unlawful use of the Platform, your material breach of these Terms, or your infringement of another person’s rights. This section does not apply to the extent a claim results from our own unlawful conduct or where the obligation is prohibited by applicable law.",
      ],
    },
    {
      title: "Privacy",
      paragraphs: [
        "Our Privacy Policy explains how we collect and process personal information. Please read it before providing birth details, messages, or other personal information. It forms part of these Terms.",
      ],
    },
    {
      title: "Governing Law and Disputes",
      paragraphs: [
        "These Terms are governed by the laws of India, subject to mandatory consumer-protection and other laws that apply to you. Disputes will be handled by courts or other forums with jurisdiction under applicable law.",
        "If you have a concern, please contact support@vritta.app first so we can try to resolve it. Nothing in this section limits any non-waivable right or remedy available to you under applicable law.",
      ],
    },
    {
      title: "Changes to These Terms",
      paragraphs: [
        "We may update these Terms to reflect changes to the Platform, our practices, or legal requirements. We will update the “Last updated” date and provide additional notice where required by law. Revised Terms apply from the stated effective date, subject to applicable law.",
      ],
    },
    {
      title: "Contact",
      paragraphs: [
        "For questions about these Terms, the Platform, or purchases, contact:",
        "Slideoo Global Private Limited\nBrand: Vritta\nEmail: support@vritta.app\nWebsite: https://vritta.app",
      ],
    },
  ],
};
