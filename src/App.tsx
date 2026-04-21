import { FluentProvider } from "@fluentui/react-components";
import { dftTheme } from "./theme";
import { AppShell } from "./components/layout/AppShell";

function App() {
  return (
    <FluentProvider theme={dftTheme}>
      <AppShell />
    </FluentProvider>
  );
}

export default App;


