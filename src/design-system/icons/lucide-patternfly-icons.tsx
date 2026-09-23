/**
 * Lucide replacements for every PatternFly icon this app imports by name.
 *
 * Resolved in place of the bare `@patternfly/react-icons` specifier by the
 * exact-match alias in vite.config.ts, so every existing
 * `import { XIcon } from '@patternfly/react-icons'` across src/ picks this
 * file up automatically — nothing to change at any call site.
 *
 * PatternFly's OWN internal icon imports (used inside
 * @patternfly/react-core, e.g. Alert's status icons) are all DEEP imports
 * like '@patternfly/react-icons/dist/esm/icons/...', which the alias's
 * `^...$` regex does not match. Those keep resolving to the real
 * @patternfly/react-icons package untouched — PatternFly still draws every
 * component exactly as before; only the icons THIS APP asks for by name
 * are swapped for Lucide.
 *
 * One rule enforced here, in this one place, for every icon in the app:
 * stroke never exceeds 1.5. strokeWidth is deliberately not read from
 * props below — every icon is hard-capped, not just defaulted, so no call
 * site can accidentally request a heavier line.
 */
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

/** MAXIMUM stroke weight any icon in this app may render at. */
const MAX_STROKE_WIDTH = 1.5;

interface PFCompatIconProps extends ComponentPropsWithoutRef<'svg'> {
  /** Accepted for API compatibility with PatternFly's icons; rendered as
   * an accessible name instead of PatternFly's inner <title> element. */
  title?: string;
  /** Lucide-specific; not a native SVG attribute, so ComponentPropsWithoutRef<'svg'> doesn't include it. */
  size?: string | number;
}

/**
 * Wraps a Lucide icon so it matches how this app's own components already
 * use PatternFly's icons (className + aria-hidden, occasionally title),
 * while forcing PatternFly's 1em/vertical-align sizing (`pf-v6-svg`, the
 * same class PatternFly's own icons carry — see base.css) so icons keep
 * lining up with surrounding text exactly as before, and locking
 * strokeWidth to MAX_STROKE_WIDTH regardless of what a caller passes.
 */
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
