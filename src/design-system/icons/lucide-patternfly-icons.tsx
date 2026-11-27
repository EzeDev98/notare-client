/** Lucide icons standing in for the PatternFly icons the app uses. */
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import {
  Archive,
  Bell,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  FileText,
  Handshake,
  LogOut,
  Mail,
  Mic,
  Monitor,
  MonitorSmartphone,
  Moon,
  NotebookPen,
  NotebookText,
  PanelLeft,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  Share,
  Sparkles,
  SquarePen,
  Sun,
  Trash2,
  TriangleAlert,
  User,
  UserX,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';

const MAX_STROKE_WIDTH = 1.5;

interface PFCompatIconProps extends ComponentPropsWithoutRef<'svg'> {
  title?: string;
  size?: string | number;
}

function createIcon(Lucide: LucideIcon, displayName: string) {
  const Icon = forwardRef<SVGSVGElement, PFCompatIconProps>(function Icon(
    { className, title, strokeWidth: _ignoredStrokeWidth, size, 'aria-hidden': ariaHidden, ...rest },
    ref,
  ) {
    return (
      <Lucide
        ref={ref}
        size={size ?? '1em'}
        strokeWidth={MAX_STROKE_WIDTH}
        className={['pf-v6-svg', className].filter(Boolean).join(' ')}
        aria-label={title}
        aria-hidden={ariaHidden ?? (title ? undefined : true)}
        {...rest}
      />
    );
  });
  Icon.displayName = displayName;
  return Icon;
}

export const ArchiveIcon = createIcon(Archive, 'ArchiveIcon');
export const AngleLeftIcon = createIcon(ChevronLeft, 'AngleLeftIcon');
export const BarsIcon = createIcon(PanelLeft, 'BarsIcon');
export const BellIcon = createIcon(Bell, 'BellIcon');
export const BookIcon = createIcon(NotebookText, 'BookIcon');
export const CheckIcon = createIcon(Check, 'CheckIcon');
export const CogIcon = createIcon(Settings, 'CogIcon');
export const DesktopIcon = createIcon(Monitor, 'DesktopIcon');
export const DeviceIcon = createIcon(MonitorSmartphone, 'DeviceIcon');
export const EditIcon = createIcon(SquarePen, 'EditIcon');
export const EnvelopeIcon = createIcon(Mail, 'EnvelopeIcon');
export const ExclamationTriangleIcon = createIcon(TriangleAlert, 'ExclamationTriangleIcon');
export const EyeIcon = createIcon(Eye, 'EyeIcon');
export const EyeSlashIcon = createIcon(EyeOff, 'EyeSlashIcon');
export const FileAltIcon = createIcon(FileText, 'FileAltIcon');
export const HandshakeIcon = createIcon(Handshake, 'HandshakeIcon');
export const MagicIcon = createIcon(Sparkles, 'MagicIcon');
export const MicrophoneIcon = createIcon(Mic, 'MicrophoneIcon');
export const MoonIcon = createIcon(Moon, 'MoonIcon');
export const PaperPlaneIcon = createIcon(Send, 'PaperPlaneIcon');
export const PauseIcon = createIcon(Pause, 'PauseIcon');
export const PencilAltIcon = createIcon(NotebookPen, 'PencilAltIcon');
export const PlayIcon = createIcon(Play, 'PlayIcon');
export const PlusIcon = createIcon(Plus, 'PlusIcon');
export const SearchIcon = createIcon(Search, 'SearchIcon');
export const ShareSquareIcon = createIcon(Share, 'ShareSquareIcon');
export const SignOutAltIcon = createIcon(LogOut, 'SignOutAltIcon');
export const SunIcon = createIcon(Sun, 'SunIcon');
export const TimesIcon = createIcon(X, 'TimesIcon');
export const TrashIcon = createIcon(Trash2, 'TrashIcon');
export const UndoIcon = createIcon(RotateCcw, 'UndoIcon');
export const UserIcon = createIcon(User, 'UserIcon');
export const UserMinusIcon = createIcon(UserX, 'UserMinusIcon');
export const UsersIcon = createIcon(Users, 'UsersIcon');
