import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Servers } from "./pages/Servers";
import { Customers } from "./pages/Customers";
import { Profiles } from "./pages/Profiles";
import { IpPools } from "./pages/IpPools";
import { DamageTypes } from './pages/DamageTypes';
import { SubAreas } from './pages/SubAreas';
import { SupportTickets } from './pages/SupportTickets';
import { Registration } from "./pages/Registration";
import { WorkingOrder } from "./pages/WorkingOrder";
import { Employees } from "./pages/Employees";
import { JobTitles } from "./pages/JobTitles";
import { PaymentMethods } from "./pages/PaymentMethods";
import { ServerProvider } from "./context/ServerContext";
import { DataProvider } from "./context/DataContext";

import { Login } from "./pages/Login";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ThemeProvider } from "./context/ThemeContext";
import { Settings } from "./pages/Settings";
import { ActivityLogs } from "./pages/ActivityLogs";
import { Monitoring } from "./pages/Monitoring";
import { WhatsappManager } from "./pages/WhatsappManager";
import { WhatsappSender } from "./pages/WhatsappSender";
import { WhatsappTemplates } from "./pages/WhatsappTemplates";
import { WhatsappBroadcast } from "./pages/WhatsappBroadcast";
import { Finance } from "./pages/Finance";

function App() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <ServerProvider>
          <DataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/servers" element={<Servers />} />
                    <Route path="/monitoring" element={<Monitoring />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/registration/active" element={<Registration view="active" />} />
                    <Route path="/registration/completed" element={<Registration view="completed" />} />
                    <Route path="/working-order/progress" element={<WorkingOrder view="progress" />} />
                    <Route path="/working-order/completed" element={<WorkingOrder view="completed" />} />
                    <Route path="/employees" element={<Employees />} />
                    <Route path="/master/profiles" element={<Profiles />} />
                    <Route path="/master/ip-pools" element={<IpPools />} />
                    <Route path="/master/damage-types" element={<DamageTypes />} />
                    <Route path="/tickets" element={<SupportTickets />} />
                    <Route path="/whatsapp/manager" element={<WhatsappManager />} />
                    <Route path="/whatsapp/send" element={<WhatsappSender />} />
                    <Route path="/whatsapp/templates" element={<WhatsappTemplates />} />
                    <Route path="/whatsapp/broadcast" element={<WhatsappBroadcast />} />
                    <Route path="/master/job-titles" element={<JobTitles />} />
                    <Route path="/master/payment-methods" element={<PaymentMethods />} />
                    <Route path="/master/sub-areas" element={<SubAreas />} />
                    <Route path="/logs" element={<ActivityLogs />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/finance" element={<Finance />} />
                  </Route>
                </Route>

              </Routes>
            </BrowserRouter>
          </DataProvider>
        </ServerProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
