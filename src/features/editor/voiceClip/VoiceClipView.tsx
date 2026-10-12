import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useContext, useEffect } from 'react';

import { ClipBlock } from './ClipBlock';
import { RecordingBlock } from './RecordingBlock';
import { isLiveRecording, isRecordingId } from './recordingIds';
import { VoiceClipContext } from './VoiceClipContext';

/** The ProseMirror node view for a voice clip. */
export function VoiceClipView({ node, editor, getPos, deleteNode, updateAttributes }: NodeViewProps) {
  const context = useContext(VoiceClipContext);
  const clipId = typeof node.attrs['clipId'] === 'string' ? node.attrs['clipId'] : null;

  // A recording block left in the body by a closed tab has nothing behind it.
  const orphan = clipId === null || (isRecordingId(clipId) && !isLiveRecording(clipId));
  const canEdit = context?.canEdit ?? false;
  useEffect(() => {
    if (orphan && canEdit) deleteNode();
  }, [orphan, canEdit, deleteNode]);

  return (
    <NodeViewWrapper className="voice-clip" contentEditable={false}>
      {orphan || context === null ? null : isRecordingId(clipId) ? (
        <RecordingBlock
          recordingId={clipId}
          noteId={context.noteId}
          onSaved={(savedId) => {
            updateAttributes({ clipId: savedId });
          }}
          onRemove={deleteNode}
        />
      ) : (
        <ClipBlock
          clipId={clipId}
          editor={editor}
          getPos={getPos}
          nodeSize={node.nodeSize}
          canEdit={context.canEdit}
          canTranscribe={context.canTranscribe}
        />
      )}
    </NodeViewWrapper>
  );
}
