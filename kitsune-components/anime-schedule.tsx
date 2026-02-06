import Container from "./container";
import React, { useMemo, useRef, useEffect } from "react";
import { useGetAnimeSchedule } from "@/query/get-anime-schedule";
import { ROUTES } from "@/constants/routes";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Play } from "lucide-react";

function AnimeSchedule() {
  const currentDate = new Date();
  const currentDay = currentDate
    .toLocaleString("en-US", { weekday: "long" })
    .toLowerCase();
  const currentDayIndex = currentDate.getDay();
  const daysOfWeek = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const [currentSelectedTab, setCurrentSelectedTab] =
    React.useState<string>(currentDay);

  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedDate = useMemo(() => {
    const date = getDateForWeekday(currentSelectedTab);
    // Note: The original logic added 1 day, maintaining parity if needed
    date.setDate(date.getDate() + 1); 
    return date.toLocaleDateString("en-US");
  }, [currentSelectedTab]);

  const { isLoading, data } = useGetAnimeSchedule(selectedDate);

  function getDateForWeekday(targetDay: string) {
    const targetIndex = daysOfWeek.indexOf(targetDay);
    const date = new Date(currentDate);
    const diff = targetIndex - currentDayIndex;
    date.setDate(currentDate.getDate() + diff);
    return date;
  }

  // Auto-scroll to current day on mount
  useEffect(() => {
    if (scrollRef.current) {
        const activeElement = scrollRef.current.querySelector('[data-active="true"]');
        if (activeElement) {
            activeElement.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <h5 style={{ fontSize: '1.2rem', fontWeight: 900, margin: 0, letterSpacing: '-0.5px' }}>Weekly Schedule</h5>
        <span style={{ fontSize: '0.75rem', opacity: 0.5, fontWeight: 700 }}>{selectedDate}</span>
      </div>

      {/* Horizontal Day Selector */}
      <div 
        ref={scrollRef}
        style={{ 
            display: 'flex', 
            gap: '10px', 
            overflowX: 'auto', 
            paddingBottom: '8px',
            scrollSnapType: 'x mandatory'
        }} 
        className="no-scrollbar"
      >
        {daysOfWeek.map((day) => {
          const isActive = currentSelectedTab === day;
          const date = getDateForWeekday(day);
          return (
            <button
              key={day}
              data-active={isActive}
              onClick={() => setCurrentSelectedTab(day)}
              style={{
                flexShrink: 0,
                minWidth: '55px',
                height: '70px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                borderRadius: '16px',
                border: '1.5px solid',
                borderColor: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                background: isActive ? '#fff' : 'rgba(255, 255, 255, 0.05)',
                color: isActive ? '#000' : '#888',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                scrollSnapAlign: 'center',
              }}
            >
              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
                {day.substring(0, 3)}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Airing List */}
      <div style={{ minHeight: '200px' }}>
        <AnimatePresence mode="wait">
          {isLoading ? (
             <motion.div 
               key="loading"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}
             >
               {[1, 2, 3, 4].map(i => (
                 <div key={i} style={{ height: '60px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }} className="animate-pulse" />
               ))}
             </motion.div>
          ) : (
            <motion.div 
              key={currentSelectedTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {(data?.scheduledAnimes.length ?? 0) > 0 ? (
                data?.scheduledAnimes.map((anime) => (
                    <div
                      key={anime.id}
                      onClick={() => window.location.href = `${ROUTES.ANIME_DETAILS}/${anime.id}`}
                      style={{
                        padding: '12px 16px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                      className="active:scale-[0.98] hover:bg-white/[0.06]"
                    >
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                         <div style={{ 
                            padding: '6px 12px', 
                            background: 'rgba(255,255,255,0.08)', 
                            borderRadius: '10px',
                            minWidth: '70px',
                            textAlign: 'center'
                         }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 900, color: 'rgba(255,255,255,0.7)' }}>
                                {new Date(anime.airingTimestamp).toLocaleTimeString("en-US", {
                                    hour: "numeric",
                                    minute: "2-digit",
                                    hour12: true,
                                })}
                            </span>
                         </div>
                         <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: '#fff', lineHeight: '1.2' }}>{anime.name}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Play className="w-2.5 h-2.5 text-pink-500 fill-current" />
                                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                                    Episode {anime.episode}
                                </span>
                            </div>
                         </div>
                      </div>
                      <ChevronRight className="w-5 h-5 opacity-20" />
                    </div>
                  ))
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.3 }}>
                    <p style={{ fontWeight: 800, fontSize: '0.9rem' }}>NO BROADCASTS FOUND</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default AnimeSchedule;
