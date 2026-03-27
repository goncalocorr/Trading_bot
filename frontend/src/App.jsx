import Dashboard from "./components/Dashboard";
import { I18nProvider } from "./i18n/I18nProvider";

function App() {
  return (
    <I18nProvider>
      <Dashboard />
    </I18nProvider>
  );
}

export default App;
