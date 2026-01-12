import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Servers } from "./pages/Servers";
import { Customers } from "./pages/Customers";
import { Profiles } from "./pages/Profiles";
import { IpPools } from "./pages/IpPools";
import { Registration } from "./pages/Registration";
import { WorkingOrder } from "./pages/WorkingOrder";
import { Employees } from "./pages/Employees";
import { JobTitles } from "./pages/JobTitles";
import { ServerProvider } from "./context/ServerContext";
import { DataProvider } from "./context/DataContext";

function App() {
  return (
    <ServerProvider>
      <DataProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/servers" element={<Servers />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/registration" element={<Registration />} />
              <Route path="/working-order/progress" element={<WorkingOrder view="progress" />} />
              <Route path="/working-order/completed" element={<WorkingOrder view="completed" />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/master/profiles" element={<Profiles />} />
              <Route path="/master/ip-pools" element={<IpPools />} />
              <Route path="/master/job-titles" element={<JobTitles />} />
              <Route path="/settings" element={<div className="p-8">Settings (Coming Soon)</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </ServerProvider>
  );
}

export default App;
