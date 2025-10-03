import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
// import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/Layout";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import Dashboard from "@/pages/Dashboard";
import ProductSearch from "@/pages/ProductSearch";
import VendorComparison from "@/pages/VendorComparison";
import VendorOrders from "@/pages/VendorOrders";
import AdvancedShipNotices from "@/pages/AdvancedShipNotices";
import ShipNotices from "@/pages/ShipNotices";
import DetailedShipNotices from "@/pages/DetailedShipNotices";
import SupportedVendors from "@/pages/SupportedVendors";
import CompanyUsers from "@/pages/CompanyUsers";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminUsers from "@/pages/AdminUsers";
import SupportedVendorsAdmin from "@/pages/SupportedVendorsAdmin";
import AdminRetailVerticals from "@/pages/AdminRetailVerticals";
import AdminPlanSettings from "@/pages/AdminPlanSettings";
import AdminSettings from "@/pages/AdminSettings";
import AdminIntegrations from "@/pages/AdminIntegrations";

import MasterProductCatalog from "@/pages/MasterProductCatalog";
import MasterCatalogImport from "@/pages/MasterCatalogImport";
import StoreManagement from "@/pages/StoreManagement";
import Company from "@/pages/Company";
import Integrations from "@/pages/Integrations";
import PricingConfiguration from "@/pages/PricingConfiguration";
import ProductCategories from "@/pages/ProductCategories";
import BillingPage from "@/pages/BillingPage";
import AuthPage from "@/pages/AuthPage";
import UserActivation from "@/pages/UserActivation";
import PasswordReset from "@/pages/PasswordReset";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      {/* Organization-specific routes */}
      <Route path="/org/:slug/auth" component={AuthPage} />
      <Route path="/org/:slug/activate" component={UserActivation} />
      <Route path="/org/:slug/reset" component={PasswordReset} />
      <ProtectedRoute path="/org/:slug/" component={() => <Layout><Dashboard /></Layout>} />
      <ProtectedRoute path="/org/:slug/search" component={() => <Layout><ProductSearch /></Layout>} />
      <ProtectedRoute path="/org/:slug/compare" component={() => <Layout><VendorComparison /></Layout>} />
      <ProtectedRoute path="/org/:slug/orders" component={() => <Layout><VendorOrders /></Layout>} />
      <ProtectedRoute path="/org/:slug/asn" component={() => <Layout><AdvancedShipNotices /></Layout>} />
      <ProtectedRoute path="/org/:slug/ship-notices" component={() => <Layout><ShipNotices /></Layout>} />
      <ProtectedRoute path="/org/:slug/supported-vendors" component={() => <Layout><SupportedVendors /></Layout>} />
      <ProtectedRoute path="/org/:slug/users" component={() => <Layout><CompanyUsers /></Layout>} />
      <ProtectedRoute path="/org/:slug/stores" component={() => <Layout><StoreManagement /></Layout>} />
      <ProtectedRoute path="/org/:slug/company" component={() => <Layout><Company /></Layout>} />
      <ProtectedRoute path="/org/:slug/pricing" component={() => <Layout><PricingConfiguration /></Layout>} />
      <ProtectedRoute path="/org/:slug/categories" component={() => <Layout><ProductCategories /></Layout>} />
      <ProtectedRoute path="/org/:slug/integrations" component={() => <Layout><Integrations /></Layout>} />
      <ProtectedRoute path="/org/:slug/billing" component={BillingPage} />

      {/* Admin routes */}
      <Route path="/admin/auth" component={AuthPage} />
      <ProtectedRoute path="/admin/" component={() => <Layout><AdminDashboard /></Layout>} />
      <ProtectedRoute path="/admin/subscriptions" component={() => <Layout><AdminDashboard /></Layout>} />
      <ProtectedRoute path="/admin/administrators" component={() => <Layout><AdminUsers /></Layout>} />
      <ProtectedRoute path="/admin/integrations" component={() => <Layout><AdminIntegrations /></Layout>} />
      <ProtectedRoute path="/admin/supported-vendors" component={() => <Layout><SupportedVendorsAdmin /></Layout>} />
      <ProtectedRoute path="/admin/retail-verticals" component={() => <Layout><AdminRetailVerticals /></Layout>} />
      <ProtectedRoute path="/admin/master-catalog" component={() => <Layout><MasterProductCatalog /></Layout>} />
      <ProtectedRoute path="/admin/import" component={() => <Layout><MasterCatalogImport /></Layout>} />
      <ProtectedRoute path="/admin/plan-settings" component={() => <Layout><AdminPlanSettings /></Layout>} />
      <ProtectedRoute path="/admin/settings" component={() => <Layout><AdminSettings /></Layout>} />


      {/* Default redirect to admin login */}
      <Route path="/" component={() => <Redirect to="/admin/auth" />} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* <TooltipProvider> */}
          <Toaster />
          <Router />
        {/* </TooltipProvider> */}
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
