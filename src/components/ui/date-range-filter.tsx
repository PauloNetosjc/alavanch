import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateRangeFilterProps {
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  onDateFromChange: (d: Date | undefined) => void;
  onDateToChange: (d: Date | undefined) => void;
  className?: string;
}

export function DateRangeFilter({ dateFrom, dateTo, onDateFromChange, onDateToChange, className }: DateRangeFilterProps) {
  const hasFilter = dateFrom || dateTo;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-9 text-xs gap-1.5', !dateFrom && 'text-muted-foreground')}>
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateFrom ? format(dateFrom, 'dd/MM/yy', { locale: ptBR }) : 'De'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateFrom} onSelect={onDateFromChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-9 text-xs gap-1.5', !dateTo && 'text-muted-foreground')}>
            <CalendarIcon className="h-3.5 w-3.5" />
            {dateTo ? format(dateTo, 'dd/MM/yy', { locale: ptBR }) : 'Até'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={dateTo} onSelect={onDateToChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {hasFilter && (
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { onDateFromChange(undefined); onDateToChange(undefined); }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
