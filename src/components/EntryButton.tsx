import { Eye, Star } from 'lucide-react';
import type { Site } from '../domain/rules';
import { IconButton } from './IconButton';

type Props = {
  site: Site;
  favorite: boolean;
  disabled: boolean;
  onOpen: () => void;
  onPreview: () => void;
  onFavorite: () => void;
};

export function EntryButton({ site, favorite, disabled, onOpen, onPreview, onFavorite }: Props) {
  return <div className="entry-button" role="group" aria-label={site.name}>
    <button type="button" className="entry-open" disabled={disabled} onClick={onOpen} aria-label={`打开${site.name}官网`} title={`${site.name} · 仅打开官网，不携带检索词`}><span className={`entry-mark color-${site.id}`} aria-hidden="true">{site.name[0]}</span><span className="entry-name">{site.name}</span></button>
    <div className="entry-tools"><IconButton label={`预览${site.name}链接`} disabled={disabled} onClick={onPreview}><Eye size={13}/></IconButton>
    <IconButton label={`${favorite ? '取消收藏' : '收藏'}${site.name}`} disabled={disabled} onClick={onFavorite} aria-pressed={favorite}><Star size={12} fill={favorite ? 'currentColor' : 'none'}/></IconButton></div>
  </div>;
}
