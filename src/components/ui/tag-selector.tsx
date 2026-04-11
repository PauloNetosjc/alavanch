import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { X, Tags } from 'lucide-react';

interface TagOption {
  id: string;
  name: string;
  color: string;
  type: string;
}

interface TagSelectorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Filter by tag type e.g. 'orcamento', 'pedido', 'cliente' */
  types?: string[];
}

export function TagSelector({ value, onChange, types }: TagSelectorProps) {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      let query = supabase.from('tags_config').select('id, name, color, type').eq('active', true).order('name');
      const { data } = await query;
      let list = (data ?? []).map(t => ({ id: t.id, name: t.name, color: t.color ?? '#6b7280', type: t.type }));
      if (types && types.length > 0) {
        list = list.filter(t => types.includes(t.type) || t.type === 'geral');
      }
      setTags(list);
    };
    fetch();
  }, [types?.join(',')]);

  const toggle = (tagName: string) => {
    if (value.includes(tagName)) {
      onChange(value.filter(t => t !== tagName));
    } else {
      onChange([...value, tagName]);
    }
  };

  const remove = (tagName: string) => {
    onChange(value.filter(t => t !== tagName));
  };

  const getTagConfig = (name: string) => tags.find(t => t.name === name);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {value.map(tag => {
          const cfg = getTagConfig(tag);
          return (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs gap-1 pr-1"
              style={cfg ? { backgroundColor: cfg.color + '20', color: cfg.color, borderColor: cfg.color + '40' } : {}}
            >
              {tag}
              <button type="button" onClick={() => remove(tag)} className="hover:opacity-70">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          );
        })}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Tags className="h-3.5 w-3.5" />
            Adicionar tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" align="start">
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tags.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma tag cadastrada</p>}
            {tags.map(t => {
              const selected = value.includes(t.name);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggle(t.name)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/50 transition-colors ${selected ? 'bg-muted' : ''}`}
                >
                  <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="flex-1 text-left">{t.name}</span>
                  {selected && <span className="text-primary text-[10px]">✓</span>}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
