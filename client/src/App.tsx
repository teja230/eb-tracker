import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { SeoPage } from "./pages/SeoPage";

const EB1Guide = () => <SeoPage kind="category" category="EB1" />;
const EB2Guide = () => <SeoPage kind="category" category="EB2" />;
const EB3Guide = () => <SeoPage kind="category" category="EB3" />;
const MethodologyGuide = () => <SeoPage kind="methodology" />;
const HistoryGuide = () => <SeoPage kind="history" />;


function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/eb-1-india"} component={EB1Guide} />
      <Route path={"/eb-2-india"} component={EB2Guide} />
      <Route path={"/eb-3-india"} component={EB3Guide} />
      <Route path={"/methodology"} component={MethodologyGuide} />
      <Route path={"/visa-bulletin-history"} component={HistoryGuide} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
