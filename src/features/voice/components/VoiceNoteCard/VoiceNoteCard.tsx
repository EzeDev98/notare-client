import { useState } from 'react';
import { Link } from 'react-router';

import type { VoiceNoteResponse } from '@/features/voice/types';
import { formatServerDateTimeRelative } from '@/lib/time';
import { Button } from '@/design-system/components/Button/Button';
import { Modal } from '@/design-system/components/Modal/Modal';
import { Trash2 } from 'lucide-react';
import './VoiceNoteCard.css';

interface VoiceNoteCardProps {
  voiceNote: VoiceNoteResponse;
  onDelete?: (id: number) => void;
  deleting?: boolean;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins)}:${String(secs).padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${String(Math.round(bytes / 1024))} KB`;
}

/** A compact row — used by both `/voice` and the note detail's inline list. */
export function VoiceNoteCard({ voiceNote, onDelete, deleting = false }: VoiceNoteCardProps) {
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  return (
    <li className="voice-note-card">
      <Link to={`/voice/${String(voiceNote.id)}`} className="voice-note-card__link">
        <span className="voice-note-card__duration">{formatDuration(voiceNote.durationSeconds)}</span>
        <span className="voice-note-card__meta">
          {formatSize(voiceNote.sizeBytes)} ·{' '}
          <time dateTime={voiceNote.createdAt}>
            {formatServerDateTimeRelative(voiceNote.createdAt)}
          </time>
        </span>
      </Link>
      {onDelete ? (
        <Button
          variant="ghost"
          size="sm"
          loading={deleting}
          disabled={deleting}
          onClick={() => {
            setDeleteModalOpen(true);
          }}
        >
          Delete
        </Button>
      ) : null}

      {deleteModalOpen ? (
        <Modal
          icon={<Trash2 aria-hidden="true" />}
          title="Delete this voice note?"
          description="This recording will be permanently deleted. This action cannot be undone."
          secondaryAction={{
            label: 'Cancel',
            onClick: () => {
              setDeleteModalOpen(false);
            },
          }}
          primaryAction={{
            label: 'Delete',
            onClick: () => {
              setDeleteModalOpen(false);
              onDelete?.(voiceNote.id);
            },
          }}
          destructive
          onClose={() => {
            setDeleteModalOpen(false);
          }}
        />
      ) : null}
    </li>
  );
}
