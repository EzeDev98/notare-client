import {
  CircleCheck,
  Download,
  Ellipsis,
  Mic,
  Pen,
  Plus,
  Share,
  WifiOff,
} from 'lucide-react';

/** Every word on the onboarding screens, in one place (master 6.2). */

export const INTRO = {
  title: 'Write it. Say it. Keep it.',
  description: 'Notes that live on your device first.',
  demo: 'Ideas for the Lagos trip',
  saved: 'Saved on this device',
  notSynced: 'Not synced',
  synced: 'Synced',
  cta: 'Get started',
  features: [
    {
      icon: Pen,
      title: 'Write the way you think',
      text: 'The first line becomes the title. Type - and it formats as you go.',
    },
    {
      icon: Mic,
      title: 'Speak a note',
      text: 'Record a voice clip right where your cursor is, and turn it into text. It stays with the note.',
    },
    {
      icon: WifiOff,
      title: 'Works without a connection',
      text: 'Every note is saved on this device first, and syncs when you are back online.',
    },
  ],
} as const;

export const INSTALL = {
  title: 'Install Notare',
  description:
    'Notare runs as an installed app, so your notes live on this device and open without a connection. Install it to use Notare offline.',
  cta: 'Install Notare',
  skip: 'Continue in browser',
} as const;

export const BROWSER = {
  title: 'Continuing in the browser',
  description:
    'Notare works in this tab. Your notes are saved on this device first, but a browser can clear stored notes, so installing is safer.',
  cta: 'Continue',
  install: 'Install Notare',
} as const;

export const INSTALLING = {
  title: 'Installing Notare…',
  description:
    'Notare is being added to your device. Find the Notare icon on your home screen, open the app from there, and sign in to continue.',
  /** `failed` is what the line says if its check does not pass. */
  checks: [
    {
      key: 'precache',
      label: 'Notare saved for offline use',
      failed: 'Notare could not be saved for offline use',
    },
    {
      key: 'storage',
      label: 'Storage reserved on this device',
      failed: 'Storage could not be reserved on this device',
    },
    {
      key: 'offline',
      label: 'Checked: Notare opens without a connection',
      failed: 'Checked: Notare does not open without a connection yet',
    },
  ],
  /** Spoken only: a screen reader needs the state the icon shows. */
  states: { pending: 'In progress', passed: 'Done', failed: 'Did not pass' },
  storage:
    'This browser does not promise to keep stored notes. Open Notare from your home screen often so notes sync, and keep it installed.',
  tab: 'This browser tab is no longer needed. Use the Notare app from your home screen from now on, not this browser.',
  cta: 'Continue',
} as const;

export const DONE = {
  title: "You're all set!",
  description:
    'Notare is on your device. Find the Notare icon on your home screen, open the app from there, and sign in to continue.',
  offline: 'Your notes stay on this device, even without a connection.',
  close: 'You can now close this browser tab.',
} as const;

export const MANUAL = {
  title: 'Install Notare',
  description: 'Notare runs as an installed app. Follow these steps to add it.',
  step: 'Step',
  android: [
    { icon: Ellipsis, text: 'Open the browser menu (the three dots).' },
    { icon: Download, text: 'Tap Install app or Add to Home screen.' },
    { icon: CircleCheck, text: 'Confirm, then open Notare from your home screen.' },
  ],
  ios: [
    { icon: Share, text: 'Tap the Share button in the browser toolbar.' },
    { icon: Plus, text: 'Choose Add to Home Screen.' },
    { icon: CircleCheck, text: 'Tap Add, then open Notare from your home screen.' },
  ],
} as const;
