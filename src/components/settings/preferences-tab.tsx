"use client";

import { usePreferencesStore } from "@/store/preferences-store";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TIMEZONE_GROUPS: Record<string, string[]> = {
  "North America": [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "America/Phoenix",
    "America/Toronto",
    "America/Vancouver",
  ],
  Europe: [
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Madrid",
    "Europe/Rome",
    "Europe/Amsterdam",
    "Europe/Moscow",
  ],
  Asia: [
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Singapore",
    "Asia/Seoul",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Bangkok",
  ],
  "Australia & Pacific": [
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Perth",
    "Pacific/Auckland",
    "Pacific/Honolulu",
  ],
  "South America": [
    "America/Sao_Paulo",
    "America/Buenos_Aires",
    "America/Santiago",
    "America/Bogota",
  ],
  Africa: [
    "Africa/Cairo",
    "Africa/Lagos",
    "Africa/Johannesburg",
    "Africa/Nairobi",
  ],
};

function formatTimezone(tz: string) {
  return tz.replace(/_/g, " ").split("/").pop() || tz;
}

const allListedZones = new Set(Object.values(TIMEZONE_GROUPS).flat());

export function PreferencesTab() {
  const { timezone, showDisplayName, setTimezone, setShowDisplayName } =
    usePreferencesStore();

  const showDetected = timezone && !allListedZones.has(timezone);

  return (
    <div className="space-y-6">
      {/* Display Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Display
        </h3>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <Label htmlFor="show-display-name" className="text-sm font-medium">
                Show display name
              </Label>
              <p className="text-xs text-muted-foreground">
                Use your display name instead of your full name in the sidebar
              </p>
            </div>
            <Switch
              id="show-display-name"
              checked={showDisplayName}
              onCheckedChange={setShowDisplayName}
            />
          </div>
        </div>
      </div>

      {/* Regional Section */}
      <div>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Regional
        </h3>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <Label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </Label>
              <p className="text-xs text-muted-foreground">
                Used for displaying dates and times
              </p>
            </div>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger id="timezone" className="w-48">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {showDetected && (
                  <SelectGroup>
                    <SelectLabel>Detected</SelectLabel>
                    <SelectItem value={timezone}>
                      {formatTimezone(timezone)}
                    </SelectItem>
                  </SelectGroup>
                )}
                {Object.entries(TIMEZONE_GROUPS).map(([group, zones]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {zones.map((tz) => (
                      <SelectItem key={tz} value={tz}>
                        {formatTimezone(tz)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
