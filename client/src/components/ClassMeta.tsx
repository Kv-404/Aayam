import { LectureRoom } from "@/components/MeetLink";
import type { MeetAction } from "@/lib/prefs";

export function ClassMeta({ faculty, room, meet }: { faculty: string; room: string; meet: MeetAction }) {
  if (!faculty && !room.trim()) return null;
  return (
    <div className="shrink-0 text-right leading-tight">
      {faculty && (
        <p className="max-w-28 sm:max-w-48 truncate text-[11px] text-muted-foreground" title={faculty}>
          {faculty}
        </p>
      )}
      {room.trim() && <LectureRoom room={room} action={meet} variant="meta" />}
    </div>
  );
}
