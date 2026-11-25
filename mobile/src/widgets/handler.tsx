import { Platform } from "react-native";
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from "react-native-android-widget";
import type { BootstrapResponse } from "@shared/types.ts";
import type { Look, Who } from "../prefs";
import { loadWidgetState, widgetState, type WidgetState } from "./data";
import { NextClassWidget, TodayWidget, widgetNames } from "./widgets";

function render(name: string, state: WidgetState) {
  return name === widgetNames.today ? <TodayWidget state={state} /> : <NextClassWidget state={state} />;
}

/**
 * Runs headless when a widget is added, resized, or its 30-minute update fires (app.json `updatePeriodMillis`).
 * Updates fetch from the API; added/resized redraw from the copy saved on the phone. A tap opens the app (OPEN_APP).
 */
export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget }: WidgetTaskHandlerProps) {
  if (widgetAction === "WIDGET_DELETED" || widgetAction === "WIDGET_CLICK") return;
  const state = await loadWidgetState(widgetAction === "WIDGET_UPDATE");
  renderWidget(render(widgetInfo.widgetName, state));
}

/** The app got a timetable (or the look changed): redraw both widgets from it, no extra request. */
export async function refreshWidgets(data: BootstrapResponse, who: Who, look: Look) {
  if (Platform.OS !== "android") return;
  const state = widgetState(data, who, look);
  for (const name of Object.values(widgetNames)) {
    await requestWidgetUpdate({ widgetName: name, renderWidget: () => render(name, state) }).catch(() => undefined);
  }
}
