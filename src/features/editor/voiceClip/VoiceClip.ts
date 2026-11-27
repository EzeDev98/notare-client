/** The voice clip node in the editor. */
import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

import { VoiceClipView } from './VoiceClipView';

export const VoiceClip = Node.create({
  name: 'voiceClip',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      clipId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-clip-id'),
        renderHTML: (attributes) =>
          typeof attributes['clipId'] === 'string' ? { 'data-clip-id': attributes['clipId'] } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-voice-clip]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-voice-clip': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VoiceClipView);
  },
});
