import type { MouseEvent } from "react";
import { PitchClose } from "@/components/pitch/PitchClose";
import { PitchProduct } from "@/components/pitch/PitchProduct";
import { PitchStory } from "@/components/pitch/PitchStory";
import { PitchTop } from "@/components/pitch/PitchTop";

export interface HomePitchProps {
  hasSavedAccess: boolean;
  savedLabel: string;
  onContinue: () => void;
  onOpenStudent: () => void;
  onOpenFaculty: () => void;
  onOpenMcp?: () => void;
  onOpenPage: (event: MouseEvent, url: string) => void;
  sourceUrl: string;
}

export function HomePitch(props: HomePitchProps) {
  return (
    <div id="top" className="min-h-dvh overflow-x-clip bg-[#07080c] text-white" style={{ colorScheme: "dark" }}>
      <PitchTop {...props} />
      <PitchStory onOpenStudent={props.onOpenStudent} onOpenFaculty={props.onOpenFaculty} />
      <PitchProduct />
      <PitchClose
        onOpenStudent={props.onOpenStudent}
        onOpenFaculty={props.onOpenFaculty}
        onOpenMcp={props.onOpenMcp}
        onOpenPage={props.onOpenPage}
        sourceUrl={props.sourceUrl}
      />
    </div>
  );
}
