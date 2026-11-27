/** The Terms of use and Privacy text. */
export const LEGAL_DOCS = {
  terms: {
    title: 'Terms of use',
    body: [
      'These terms apply when you use Notare, provided by BuildingWithEze (BWE). By creating an account or using the app you agree to them. If you do not agree, please do not use Notare.',
      'Notare lets you write notes, record voice clips, and turn clips into text. Your notes are kept on your device and in your account so you can use them offline and on more than one device.',
      'You must be 18 or older. You are responsible for keeping your username and password private, and for what happens under your account. Tell us at once if you think someone else has used it.',
      'Your notes are yours. You allow us to store, sync and transcribe them so that Notare can work. You are responsible for what you write and record. Do not use Notare to break the law, to harm or harass other people, or to try to break, overload or misuse the service or anyone else\u2019s account.',
      'Transcripts are made by software, which can make mistakes. Please check a transcript before you rely on it.',
      'When you delete a note it is removed for good, together with its voice clips. Deleting your account removes your notes and voice clips from every device.',
      'We work to keep Notare available and your notes safe, but we cannot promise it will always be free of errors or interruptions. Keep a copy of anything you cannot afford to lose. As far as the law allows, BuildingWithEze is not liable for losses that come from the service being unavailable or from relying on a transcript.',
      'We may update these terms or the app. If a change matters to you, we will tell you in the app. Using Notare after a change means you accept it.',
      'You can stop using Notare at any time. We may suspend an account that breaks these terms. These terms are governed by the laws of the Federal Republic of Nigeria. Questions: [support email]. In effect from [release date].',
    ],
  },
  privacy: {
    title: 'Privacy',
    body: [
      'This notice explains what Notare collects, why, and what you can do about it. It follows the Nigeria Data Protection Act 2023. The data controller is BuildingWithEze (BWE).',
      'What we collect: your name, username and email address when you register; the notes you write, with the voice clips you record and their transcripts; the devices signed in to your account, with the browser, the device name and when each was last used; and the details needed to keep your session secure, such as when you signed in.',
      'Your password is handled by our sign-in service.',
      'Why we use it: to run your account, to sync your notes between your devices, to turn your voice clips into text when you ask, and to keep Notare secure. We do not sell your data and we do not use it for advertising.',
      'Transcription: when you ask for a transcript, the audio of that clip is sent to a speech-to-text service provider [provider name] so it can be turned into text. We send only what is needed for that and choose providers who are bound to protect it.',
      'AI tidy: only if you turn it on in Settings, Notare tidies a note after you have left it for a while. Spelling and punctuation are checked on our own server. To suggest a title, the note\u2019s text is sent to an AI service provider [provider name], which returns a short summary. Turn it off at any time; Restore original in a note\u2019s menu puts back the text from before.',
      'Where it is kept: your notes are kept in your browser\u2019s storage on each device you use, and on servers we run or rent from hosting providers, which may be outside Nigeria. We keep your data while your account is active. Notes you delete are removed for good at once, and deleting your account removes your data, except what the law requires us to keep.',
      'Your rights: you can ask to see, correct or delete your data, to object to how it is used, or to receive a copy. Write to [support email]. You may also complain to the Nigeria Data Protection Commission. We will post changes to this notice in the app. In effect from [release date].',
    ],
  },
} as const;

export type LegalKey = keyof typeof LEGAL_DOCS;
