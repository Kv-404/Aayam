import { Eyebrow, Reveal, Section } from "@/components/pitch/bits";

const next = [
  { title: "Assignments", note: "Coursework beside the timetable, with a deadline for each subject." },
  { title: "Fees", note: "Totals, receipts, and the next instalment. View only. Paying online is outside this." },
  { title: "Marks", note: "Subject marks, assessment scores, and the report card for the semester." },
  { title: "Library", note: "Find a book, see if a copy is free, and see when yours is due." },
  { title: "Faculty tools", note: "A directory, subject assignments, and a view of each teacher's load." },
  { title: "Inside Aayam", note: "Edit the timetable, rooms, and batches here, with a look at a change before it goes out." },
];

export function PitchProduct() {
  return (
    <Section id="next">
      <Reveal>
        <Eyebrow>What's next</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-3xl font-medium tracking-tight text-balance sm:text-4xl">
          The timetable is the product. The rest of campus life can plug into it.
        </h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/60">
          These modules are planned. You cannot open them yet. The timetable, batch and section choice, and faculty sign-in are what work today.
        </p>
      </Reveal>
      <ul className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
        {next.map((item, index) => (
          <li key={item.title} className="bg-[#07080c]">
            <Reveal delay={index * 40} className="h-full">
              <article className="h-full px-5 py-5">
                <h3 className="text-base font-medium">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/55">{item.note}</p>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
    </Section>
  );
}
