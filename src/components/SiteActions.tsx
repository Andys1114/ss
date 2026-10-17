import { useState } from 'react';
import { ExternalLink, Eye, SlidersHorizontal, Star } from 'lucide-react';
import type { SearchRule, Site } from '../domain/rules';
import { sharedTextField } from '../domain/shared-search';
import { IconButton } from './IconButton';

type Props = {
  site: Site; rule?: SearchRule; favorite: boolean; previewing: boolean; disabled: boolean;
  values: Record<string, string>;
  onOpen: () => void; onPreview: () => void; onFavorite: () => void;
  onRule: (ruleId: string) => void; onField: (fieldId: string, value: string) => void;
};

export function SiteActions({ site, rule, favorite, previewing, disabled, values, onOpen, onPreview, onFavorite, onRule, onField }: Props) {
  const [expanded, setExpanded] = useState(false);
  const primary = rule && sharedTextField(rule);
  const extra = rule?.fields.filter(field => field.id !== primary?.id) ?? [];
  return <article className={`destination ${previewing ? 'previewing' : ''} ${expanded && extra.length ? 'expanded' : ''}`}>
    <div className="destination-main">
      <button type="button" className="destination-open" disabled={disabled} onClick={onOpen} aria-label={rule ? `在${site.name}检索` : `打开${site.name}官网`} title={site.name}>
        <span className={`site-monogram color-${site.id}`}>{site.id === 'cnki' ? '知' : site.id === 'wanfang' ? '万' : site.id === 'cqvip' ? '维' : site.name[0]}</span>
        <span className="destination-label"><strong>{site.name}</strong></span>
      </button>
    </div>
    <div className="destination-meta">
      <span className={`destination-kind ${rule ? 'searchable' : ''}`} title={`${site.category} · ${rule ? '使用上方内容检索' : '仅打开官网，不携带检索词'}`}><ExternalLink size={11}/>{rule ? '关键词检索' : '官网入口'}</span>
      <div className="destination-tools">
        <IconButton label={`预览${site.name}链接`} onClick={onPreview} aria-pressed={previewing}><Eye size={15}/></IconButton>
        <IconButton label={`${favorite ? '取消收藏' : '收藏'}${site.name}`} onClick={onFavorite} disabled={disabled} aria-pressed={favorite}><Star size={14} fill={favorite ? 'currentColor' : 'none'}/></IconButton>
      </div>
    </div>
    {site.searchRules.length > 1 && <div className="destination-rule"><label htmlFor={`rule-${site.id}`}>检索方式</label><select id={`rule-${site.id}`} value={rule?.id ?? ''} onChange={event => onRule(event.target.value)}>{site.searchRules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>}
    {extra.length > 0 && <details className="destination-options" onToggle={event => setExpanded(event.currentTarget.open)}><summary><SlidersHorizontal size={13}/>其他条件 <span>{extra.length}</span></summary><div className="options-fields">{extra.map(field => <div className="field" key={`${rule!.id}-${field.id}`}><label htmlFor={`option-${site.id}-${rule!.id}-${field.id}`}>{field.label}<span className="optional">{field.required ? '必填' : '可选'}</span></label>{field.type === 'select' ? <select id={`option-${site.id}-${rule!.id}-${field.id}`} value={values[field.id] ?? field.defaultValue ?? ''} onChange={event => onField(field.id,event.target.value)}><option value="">不指定</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input id={`option-${site.id}-${rule!.id}-${field.id}`} type={field.type === 'date' ? 'date' : 'text'} value={values[field.id] ?? field.defaultValue ?? ''} placeholder={field.placeholder} onChange={event => onField(field.id,event.target.value)}/>}</div>)}</div></details>}
    {rule?.verification.status === 'unverified' && <p className="destination-warning" title="请在目标网站核对检索条件是否生效">规则未经验证</p>}
  </article>;
}
