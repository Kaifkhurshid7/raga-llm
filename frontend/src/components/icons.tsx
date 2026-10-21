import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Info,
  Menu,
  Moon,
  MoreHorizontal,
  Music,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Settings,
  Share,
  ShieldCheck,
  Sun,
  Target,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

interface IconProps {
  className?: string;
}

/** One place that sets the size and stroke for every icon in the app. */
function icon(Glyph: LucideIcon) {
  return function AppIcon({ className = "h-5 w-5" }: IconProps) {
    return <Glyph className={className} strokeWidth={1.75} aria-hidden="true" />;
  };
}

export const MenuIcon = icon(Menu);
export const SidebarIcon = icon(PanelLeft);
export const PlusIcon = icon(Plus);
export const SearchIcon = icon(Search);
export const InfoIcon = icon(Info);
export const SunIcon = icon(Sun);
export const MoonIcon = icon(Moon);
export const ArrowUpIcon = icon(ArrowUp);
export const ArrowLeftIcon = icon(ArrowLeft);
export const ArrowRightIcon = icon(ArrowRight);
export const CloseIcon = icon(X);
export const GearIcon = icon(Settings);
export const ChevronRightIcon = icon(ChevronRight);
export const NoteIcon = icon(Music);
export const ScaleIcon = icon(Scale);
export const TargetIcon = icon(Target);
export const DocumentIcon = icon(FileText);
export const ShieldIcon = icon(ShieldCheck);
export const CopyIcon = icon(Copy);
export const CheckIcon = icon(Check);
export const MoreIcon = icon(MoreHorizontal);
export const PencilIcon = icon(Pencil);
export const TrashIcon = icon(Trash2);
export const RefreshIcon = icon(RefreshCw);
export const PinIcon = icon(Pin);
export const PinOffIcon = icon(PinOff);
export const ShareIcon = icon(Share);
