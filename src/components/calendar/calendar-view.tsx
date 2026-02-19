"use client";

import { useState, useRef, useCallback } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
// interactionPlugin removed — not needed since editable/selectable are false,
// and its document-level pointer listeners interfere with Radix popovers
import type { EventClickArg, DatesSetArg, EventContentArg } from "@fullcalendar/core";
import type { EventInput } from "@fullcalendar/core";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useCalendarStore, type CalendarViewType } from "@/store/calendar-store";
import type { CalendarTeam } from "./calendar-transformers";
import "./calendar-styles.css";

const VIEW_LABEL: Record<CalendarViewType, string> = {
  dayGridMonth: "Month",
  timeGridWeek: "Week",
  timeGridDay: "Day",
};

export interface CalendarViewProps {
  events: EventInput[];
  teams: CalendarTeam[];
  visibleTeamIds: string[];
  onToggleTeam: (teamId: string) => void;
  onShowAllTeams: () => void;
  onHideAllTeams: () => void;
  hasTeamTracks: boolean;
  onEventClick: (featureId: string, projectId: string) => void;
  onMilestoneClick?: (milestoneId: string) => void;
  initialViewType?: CalendarViewType;
}

/** Isolated Tracks popover — manages its own open state so parent re-renders don't close it */
function TracksPopover({
  teams,
  visibleTeamIds,
  onToggleTeam,
  onShowAllTeams,
  onHideAllTeams,
}: {
  teams: CalendarTeam[];
  visibleTeamIds: string[];
  onToggleTeam: (teamId: string) => void;
  onShowAllTeams: () => void;
  onHideAllTeams: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs gap-1.5"
        >
          <Users className="h-3.5 w-3.5" />
          Tracks
          {visibleTeamIds.length > 0 && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {visibleTeamIds.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-xs font-medium text-muted-foreground">Team Tracks</span>
          <button
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              if (visibleTeamIds.length === teams.length) {
                onHideAllTeams();
              } else {
                onShowAllTeams();
              }
            }}
          >
            {visibleTeamIds.length === teams.length ? 'Hide all' : 'Show all'}
          </button>
        </div>
        <div className="py-1 max-h-64 overflow-y-auto">
          {teams.map((team) => {
            const isVisible = visibleTeamIds.includes(team.id);
            return (
              <div
                key={team.id}
                role="button"
                onClick={() => onToggleTeam(team.id)}
                className="flex items-center gap-2.5 w-full px-3 py-1.5 text-xs hover:bg-muted transition-colors cursor-pointer select-none"
              >
                <div
                  className="h-2.5 w-2.5 rounded-full shrink-0 ring-1 ring-foreground/10"
                  style={{ backgroundColor: team.color }}
                />
                <span className="flex-1 text-left truncate">{team.name}</span>
                <Switch
                  size="sm"
                  checked={isVisible}
                  tabIndex={-1}
                  className="pointer-events-none"
                />
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CalendarView({
  events,
  teams,
  visibleTeamIds,
  onToggleTeam,
  onShowAllTeams,
  onHideAllTeams,
  hasTeamTracks,
  onEventClick,
  onMilestoneClick,
  initialViewType = "dayGridMonth",
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar>(null);
  const setStoreViewType = useCalendarStore((s) => s.setViewType);
  const [currentView, setCurrentView] = useState<CalendarViewType>(initialViewType);
  const [title, setTitle] = useState("");

  // Ref so the event renderer can access the callback without causing re-renders
  const milestoneClickRef = useRef(onMilestoneClick);
  milestoneClickRef.current = onMilestoneClick;

  const renderEventContent = useCallback((arg: EventContentArg) => {
    const { isTeamTrack, teamColor, milestoneColor, milestoneName, statusDotColor, progress, projectId } = arg.event.extendedProps;

    if (isTeamTrack) {
      return (
        <div className="calendar-event-content">
          <span className="calendar-event-dot" style={{ backgroundColor: teamColor }} />
          <span className="calendar-event-title calendar-team-track-title">{arg.event.title}</span>
        </div>
      );
    }

    return (
      <div className="calendar-event-content">
        {milestoneName && (
          <span
            className="calendar-milestone-badge"
            style={{ backgroundColor: milestoneColor }}
            onClick={(e) => {
              e.stopPropagation();
              milestoneClickRef.current?.(projectId);
            }}
          >
            {milestoneName}
          </span>
        )}
        <span className="calendar-event-dot" style={{ backgroundColor: statusDotColor }} />
        <span className="calendar-event-title">{arg.event.title}</span>
        {progress > 0 && progress < 100 && (
          <span className="calendar-event-progress">{progress}%</span>
        )}
      </div>
    );
  }, []);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setTitle(arg.view.title);
  }, []);

  const handleEventClick = useCallback(
    (arg: EventClickArg) => {
      const { featureId, projectId } = arg.event.extendedProps;
      if (featureId && projectId) {
        onEventClick(featureId, projectId);
      }
    },
    [onEventClick]
  );

  const handleToday = useCallback(() => {
    calendarRef.current?.getApi().today();
  }, []);

  const handlePrev = useCallback(() => {
    calendarRef.current?.getApi().prev();
  }, []);

  const handleNext = useCallback(() => {
    calendarRef.current?.getApi().next();
  }, []);

  const handleViewChange = useCallback((view: CalendarViewType) => {
    setCurrentView(view);
    setStoreViewType(view);
    calendarRef.current?.getApi().changeView(view);
  }, [setStoreViewType]);

  return (
    <div className="fc-calendar-root flex flex-col flex-1 min-h-0 border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs" style={{ height: '28px' }} onClick={handleToday}>
            Today
          </Button>

          <Select value={currentView} onValueChange={(v) => handleViewChange(v as CalendarViewType)}>
            <SelectTrigger className="w-[100px] text-xs" style={{ height: '28px' }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(VIEW_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {teams.length > 0 && hasTeamTracks && (
            <TracksPopover
              teams={teams}
              visibleTeamIds={visibleTeamIds}
              onToggleTeam={onToggleTeam}
              onShowAllTeams={onShowAllTeams}
              onHideAllTeams={onHideAllTeams}
            />
          )}

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center">
            <button
              onClick={handlePrev}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNext}
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <h2 className="text-sm font-semibold">{title}</h2>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 min-h-0 overflow-auto">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView={initialViewType}
          headerToolbar={false}
          events={events}
          editable={false}
          selectable={false}
          dayMaxEvents={4}
          moreLinkClick="popover"
          nowIndicator={true}
          firstDay={1}
          eventContent={renderEventContent}
          eventClick={handleEventClick}
          datesSet={handleDatesSet}
          eventOrder="-order,start,-duration,allDay,title"
          height="100%"
        />
      </div>
    </div>
  );
}
