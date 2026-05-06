import { useEffect } from "react";
import { FluentProvider } from "@fluentui/react-components";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { dftTheme } from "./theme";
import { AppShell } from "./components/layout/AppShell";

function App() {
  useEffect(() => {
    if (import.meta.env.DEV) {
      getCurrentWindow().setTitle("[DEV] Daily Follow-ups Tool");
    }
  }, []);

  return (
    <FluentProvider theme={dftTheme}>
      <AppShell />
    </FluentProvider>
  );
}

export default App;


