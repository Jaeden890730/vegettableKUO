import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, isAfter, startOfDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { CalendarOff } from 'lucide-react';

interface Holiday {
  id: string;
  holiday_date: string;
  note: string | null;
}

export function HolidayBanner() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHolidays = async () => {
      const today = startOfDay(new Date());
      
      const { data, error } = await supabase
        .from('holiday_dates')
        .select('*')
        .gte('holiday_date', format(today, 'yyyy-MM-dd'))
        .order('holiday_date', { ascending: true })
        .limit(10);

      if (!error && data) {
        setHolidays(data);
      }
      setIsLoading(false);
    };

    fetchHolidays();
  }, []);

  if (isLoading || holidays.length === 0) {
    return null;
  }

  return (
    <div className="container py-2">
      <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 px-3 py-2">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <CalendarOff className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">休假日：</span>
          <div className="flex flex-wrap gap-2 text-sm">
            {holidays.map((holiday, index) => {
              const date = new Date(holiday.holiday_date);
              const dateStr = format(date, 'M/d (EEE)', { locale: zhTW });
              return (
                <span key={holiday.id} className="inline-flex items-center">
                  <span className="font-medium">{dateStr}</span>
                  {holiday.note && (
                    <span className="text-red-600/70 dark:text-red-400/70 ml-0.5">
                      ({holiday.note})
                    </span>
                  )}
                  {index < holidays.length - 1 && <span className="ml-2">、</span>}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
