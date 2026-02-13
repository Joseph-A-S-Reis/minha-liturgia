import { getUpcomingCatholicEvents } from "@/lib/liturgical-calendar";
import { CalendarIcon, CheckCircleIcon } from "./icons";

export function EventsPanel() {
  const events = getUpcomingCatholicEvents(5);

  return (
    <div className="w-72 bg-white/50 backdrop-blur-sm border-l border-sky-200 h-screen fixed right-0 top-0 p-6 overflow-y-auto hidden xl:block z-30 shadow-lg">
      <h3 className="text-xl font-serif font-bold mb-8 text-[#003366] border-b border-sky-200 pb-2 flex items-center gap-2">
        <CalendarIcon className="size-5" />
        Próximos Dias
      </h3>
      <div className="space-y-8">
        {events.map((event, i) => {
           // Parse date manually to avoid timezone issues with formatting if input is YYYY-MM-DD
           const [year, month, day] = event.date.split('-').map(Number);
           const dateObj = new Date(year, month - 1, day);
           
           return (
            <div key={i} className="group relative pl-4 border-l-2 border-sky-300 hover:border-[#003366] transition-colors">
                <div className="text-sm text-sky-700 font-bold mb-1 uppercase tracking-wider">
                    {dateObj.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'short' })}
                </div>
                {event.type === 'solenidade' && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 mb-2 border border-red-200">
                        SOLENIDADE
                    </span>
                )}
                {event.type === 'festa' && (
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 mb-2 border border-amber-200">
                        FESTA
                    </span>
                )}
                <div className="text-gray-900 font-serif text-lg leading-tight">
                  <CheckCircleIcon className="mr-1 inline size-4 text-sky-700" />
                    {event.title}
                </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
