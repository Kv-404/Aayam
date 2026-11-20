import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { cohortLabel, cohortPrograms, cohortYears, cohortsInYear, type CohortChoice } from "@shared/cohort.ts";
import { signInFaculty } from "./api";
import type { FacultyPick, StudentPick, Who } from "./prefs";
import { useLook } from "./theme";
import { Logo } from "./Logo";
import { BackLink, ChoiceRow, LookControls, PrimaryButton, T } from "./ui";

// Copy and labels match client/src/components/HomePage.tsx.
const programLabel = (course: string) => (course.trim().toLowerCase() === "btech" ? "B.Tech" : course);
const batchLabel = (batch: string) => batch.replace("-", "–");

type Step = "role" | "program" | "batch" | "cohort" | "faculty" | "theme";

/** Who are you? → (student) course, batch, cohort | (faculty) Google sign-in → theme. */
export function Setup({ choices, onDone }: { choices: CohortChoice[]; onDone: (who: Who, token?: string) => void }) {
  const { theme } = useLook();
  const [step, setStep] = useState<Step>("role");
  const [program, setProgram] = useState("");
  const [batch, setBatch] = useState("");
  const [student, setStudent] = useState<StudentPick | null>(null);
  const [faculty, setFaculty] = useState<{ pick: FacultyPick; token: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading =
    step === "role" ? "I am" : step === "program" ? "Which course?" : step === "batch" ? "Which batch?" : step === "cohort" ? "Which cohort?" : step === "faculty" ? "Faculty sign-in" : "Pick a theme";
  const note =
    step === "program"
      ? "B.Tech or MCA."
      : step === "batch"
        ? programLabel(program)
        : step === "cohort"
          ? `${programLabel(program)} · ${batchLabel(batch)}`
          : step === "faculty"
            ? "Use your @itm.edu or @isu.ac.in Google account. Sign-in opens in your browser, then comes back here."
            : step === "theme"
              ? student
                ? `${programLabel(student.course)} · ${batchLabel(student.batch)} · ${cohortLabel(student.division)}`
                : (faculty?.pick.faculty ?? "")
              : "";

  const back = () => {
    setError(null);
    if (step === "theme") setStep(student ? "cohort" : "faculty");
    else if (step === "cohort") setStep("batch");
    else if (step === "batch") setStep("program");
    else setStep("role");
  };

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await signInFaculty();
      if (result) {
        setFaculty({ pick: result.faculty, token: result.token });
        setStep("theme");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    if (student) onDone({ role: "student", student });
    else if (faculty) onDone({ role: "faculty", faculty: faculty.pick }, faculty.token);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.top}>
        <Logo height={30} color={theme.fg} />
      </View>
      <ScrollView contentContainerStyle={[styles.body, step === "theme" && { paddingTop: 32 }]}>
        <T style={{ color: theme.fg, fontSize: 40, letterSpacing: -1 }}>{heading}</T>
        {note ? <T style={{ color: theme.mutedFg, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{note}</T> : null}
        <View style={styles.list}>
          {step === "role" ? (
            <>
              <ChoiceRow theme={theme} label="Student" onPress={() => setStep("program")} />
              <ChoiceRow theme={theme} label="Faculty" onPress={() => setStep("faculty")} />
            </>
          ) : null}
          {step === "program"
            ? cohortPrograms(choices).map((course) => <ChoiceRow key={course} theme={theme} label={programLabel(course)} onPress={() => (setProgram(course), setStep("batch"))} />)
            : null}
          {step === "batch" ? cohortYears(choices, program).map((year) => <ChoiceRow key={year} theme={theme} label={batchLabel(year)} onPress={() => (setBatch(year), setStep("cohort"))} />) : null}
          {step === "cohort"
            ? cohortsInYear(choices, program, batch).map((choice) => (
                <ChoiceRow
                  key={choice.division}
                  theme={theme}
                  label={cohortLabel(choice.division)}
                  onPress={() => {
                    setStudent({ division: choice.division, course: choice.course, batch: choice.batch });
                    setFaculty(null);
                    setStep("theme");
                  }}
                />
              ))
            : null}
          {step === "faculty" ? (
            busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={theme.mutedFg} />
                <T style={{ color: theme.mutedFg, fontSize: 14 }}>Waiting for Google sign-in…</T>
              </View>
            ) : (
              <ChoiceRow theme={theme} label="Sign in with Google" onPress={() => void signIn()} />
            )
          ) : null}
          {error ? (
            <View style={[styles.error, { borderColor: `${theme.danger}55`, backgroundColor: `${theme.danger}1a` }]}>
              <T style={{ color: theme.danger, fontSize: 13 }}>{error}</T>
            </View>
          ) : null}
          {step === "theme" ? <LookControls /> : null}
        </View>
      </ScrollView>
      {step !== "role" ? (
        <View style={styles.foot}>
          <BackLink theme={theme} onPress={back} />
          {step === "theme" ? <PrimaryButton theme={theme} label="Continue" onPress={finish} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 24, paddingTop: 24 },
  body: { paddingHorizontal: 24, paddingTop: 120, paddingBottom: 32 },
  list: { marginTop: 28, gap: 12 },
  foot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, paddingBottom: 16, paddingTop: 8 },
  busy: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 18 },
  error: { borderWidth: 1, borderRadius: 10, padding: 12 },
});
