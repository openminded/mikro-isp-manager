import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Servers } from "./pages/Servers";
import { Customers } from "./pages/Customers";
import { Profiles } from "./pages/Profiles";
import { IpPools } from "./pages/IpPools";
import { ServerProvider } from "./context/ServerContext";

function App() {
  return (
    <ServerProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/servers" element={<Servers />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/master/profiles" element={<Profiles />} />
            <Route path="/master/ip-pools" element={<IpPools />} />
            <Route path="/settings" element={<div className="p-8">Settings (Coming Soon)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ServerProvider>
  );
}

export default App;
